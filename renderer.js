/*
Auto-scheduling Test Checklist
================================

1) ✅ App launch with 0 Today tasks → Auto-fills 3 tasks
   - Precondition: No tasks have Status = "Today"
   - Expect: Exactly 3 tasks promoted to Today respecting priority and project balance

2) ✅ Complete 1 task → Auto-promotes 1 task
   - Action: Mark one Today task Done via completeTask()
   - Expect: Exactly 1 new task promoted to keep Today at 3 total

3) ✅ Complete all 3 tasks → Auto-promotes 3 tasks
   - Action: Mark all Today tasks Done
   - Expect: Three tasks promoted (if available), keeping Today at 3

4) ✅ Sync adds new Inbox tasks → Auto-fills if Today < 3
   - Precondition: Today < 3, then run Sync
   - Expect: Newly added Inbox tasks are eligible; Today auto-fills up to 3

5) ✅ Mixed priorities (P1, P2, P3) → P1 always goes first
   - Precondition: Candidates include P1, P2, P3
   - Expect: P1 tasks are selected before lower priorities

6) ✅ All same priority → Diversifies by project type
   - Precondition: Candidates all P2 (or same tier) across multiple projects
   - Expect: Round-robin selection across Work/Personal/Project categories

7) ✅ Only 1 project type available → Fills with available tasks
   - Precondition: Candidates are only from a single project/category
   - Expect: Fill exclusively from that project without errors

8) ✅ Only 2 tasks total → Promotes both, doesn't error on 3rd
   - Precondition: Only 2 eligible candidates exist
   - Expect: Promote both; no error for the missing 3rd

9) ✅ No eligible tasks → Today remains empty, no errors
   - Precondition: No candidates (all Done/Today)
   - Expect: No promotion, no errors

10) ✅ Project badges display correctly
   - Visual: Badge color + abbreviation match project mapping

Notes
-----
- DEBUG logging can be toggled with `DEBUG` at the top of this file
- Use `testAutoScheduling()` to view distributions and a quick test run
- See console test script (paste into DevTools) to simulate scenarios safely
*/
const AIRTABLE_TOKEN = 'AIRTABLE_TOKEN_REDACTED.44d1b12f6a83e20f6d2e8cce95f0a11ca620fc63833988186259775151510950';
const BASE_ID = 'appQlPzbpST2aQ3ca';
const TABLE_NAME = 'Tasks';

const CLAUDE_API_KEY = 'ANTHROPIC_KEY_REDACTED';
const DEBUG = true; // Set to false for production
const ENABLE_SWEEPS = false; // Feature flag: toggle Slack/Email sweeps

let tasks = [];
let lastFetchTime = null;
let lastAutoFillDebug = null; // captures last auto-fill debug snapshot when DEBUG

// Load tasks from Airtable
async function loadTasks() {
    try {
        // Fetch all tasks (no view filter needed). The Airtable "view" parameter is optional
        // and can cause errors if the named view doesn't exist in the base.
        const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}`;
        
        const https = require('https');
        const options = {
            hostname: 'api.airtable.com',
            path: `/v0/${BASE_ID}/${TABLE_NAME}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`
            }
        };

        const { statusCode, body } = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
            });
            req.on('error', reject);
            req.end();
        });

        let responseJson = null;
        try {
            responseJson = JSON.parse(body || '{}');
        } catch (e) {
            console.error('Airtable JSON parse error:', e, body);
        }

        if (statusCode !== 200) {
            throw new Error(`Airtable HTTP ${statusCode}: ${body}`);
        }

        if (responseJson && Array.isArray(responseJson.records)) {
            tasks = responseJson.records
                .map(record => ({
                    id: record.id,
                    name: record.fields['Task Name'] || 'Untitled',
                    status: record.fields['Status'] || 'Inbox',
                    priority: record.fields['Priority'] || 'P3-Medium',
                    energy: record.fields['Energy Level'] || 'Medium',
                    timeEstimate: record.fields['Time Estimate'] || '',
                    project: record.fields['Project'] || 'Personal',
                    blockedByIds: Array.isArray(record.fields['Blocked By'])
                        ? record.fields['Blocked By'].map(b => (typeof b === 'string' ? b : (b && b.id)))
                        : []
                }));
            
            lastFetchTime = new Date();
            localStorage.setItem('cachedTasks', JSON.stringify(tasks));
            localStorage.setItem('lastFetchTime', lastFetchTime.toISOString());
            
            renderTasks();
            
            // Auto-fill Today tasks after loading
            await autoFillTodayTasks();
        } else {
            // No records array returned; treat as empty
            console.warn('Airtable response did not include records:', responseJson);
            tasks = [];
            renderTasks();
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
        
        const cached = localStorage.getItem('cachedTasks');
        if (cached) {
            tasks = JSON.parse(cached);
            renderTasks();
        } else {
            // Ensure UI is not stuck at "Loading..."
            tasks = [];
            renderTasks();
            showNotification('⚠️ Could not load tasks from Airtable');
        }
    }
}


// Dependency helpers
function getTaskById(taskId) {
    return tasks.find(t => t.id === taskId);
}

function hasIncompleteBlockers(task) {
    if (!task || !Array.isArray(task.blockedByIds) || task.blockedByIds.length === 0) return false;
    for (const blockerId of task.blockedByIds) {
        const blocker = getTaskById(blockerId);
        if (!blocker) {
            if (DEBUG) console.warn('[DEBUG][Deps] Missing blocker record', blockerId, 'assuming incomplete');
            return true;
        }
        if (blocker.status !== 'Done') return true;
    }
    return false;
}

function isBlocking(task) {
    if (!task) return false;
    return tasks.some(t => Array.isArray(t.blockedByIds) && t.blockedByIds.includes(task.id) && t.status !== 'Done');
}

function getBlockerNames(task) {
    if (!task || !Array.isArray(task.blockedByIds) || task.blockedByIds.length === 0) return '';
    const names = task.blockedByIds
        .map(id => getTaskById(id))
        .filter(Boolean)
        .map(t => t.name);
    return names.join(', ');
}

// Auto-fill Today with up to 3 tasks using priority-first, smart category balancing
async function autoFillTodayTasks() {
	const todayTasks = tasks.filter(t => t.status === 'Today');
	if (DEBUG) {
		console.group('[DEBUG][AutoFill] Start');
		console.log(`[DEBUG][AutoFill] Current Today count: ${todayTasks.length}`);
	}

	if (todayTasks.length >= 3) {
		return; // Already have 3 tasks
	}

	const needed = 3 - todayTasks.length;

	// 1) Build candidates: not Done, not already Today, and not blocked
	const candidates = tasks.filter(t => t.status !== 'Done' && t.status !== 'Today' && !hasIncompleteBlockers(t));
	if (DEBUG) {
		console.log(`[DEBUG][AutoFill] Candidates total (not Done/Today): ${candidates.length}`);
	}

	// Priority ordering
	const tiers = ['P1-Critical', 'P2-High', 'P3-Medium', 'P4-Low'];
	const categories = ['Work', 'Personal', 'Project'];

	// 2) Group by priority tier, preserving stable order within each tier
	const byTier = {
		'P1-Critical': [],
		'P2-High': [],
		'P3-Medium': [],
		'P4-Low': []
	};
	for (const t of candidates) {
		if (byTier[t.priority]) byTier[t.priority].push(t);
	}
	if (DEBUG) {
		console.log('[DEBUG][AutoFill] Candidates per tier:', {
			'P1-Critical': byTier['P1-Critical'].length,
			'P2-High': byTier['P2-High'].length,
			'P3-Medium': byTier['P3-Medium'].length,
			'P4-Low': byTier['P4-Low'].length
		});
	}

	// 3) Within each tier, group by project category
	const byTierAndCategory = {};
	for (const tier of tiers) {
		const tierTasks = byTier[tier] || [];
		byTierAndCategory[tier] = { Work: [], Personal: [], Project: [] };
		for (const t of tierTasks) {
			const cat = getProjectCategory(t.project);
			(byTierAndCategory[tier][cat] || byTierAndCategory[tier].Work).push(t);
		}
		if (DEBUG) {
			console.group(`[DEBUG][AutoFill] Tier ${tier}`);
			console.log('[DEBUG][AutoFill] Grouped by category:', {
				Work: byTierAndCategory[tier].Work.length,
				Personal: byTierAndCategory[tier].Personal.length,
				Project: byTierAndCategory[tier].Project.length
			});
			console.groupEnd();
		}
	}

	const selected = [];
	const debugSelections = [];

	// 4a) Always take P1 first (critical tasks trump diversity)
	if (byTier['P1-Critical'].length > 0 && selected.length < needed) {
		const take = Math.min(needed - selected.length, byTier['P1-Critical'].length);
		for (let i = 0; i < take; i++) {
			const t = byTier['P1-Critical'][i];
			selected.push(t);
			if (DEBUG) {
				console.log('[DEBUG][AutoFill] Selected P1 task (priority first)', {
					id: t.id, name: t.name, project: t.project, priority: t.priority
				});
			}
			debugSelections.push({ id: t.id, name: t.name, project: t.project, priority: t.priority, category: getProjectCategory(t.project), tier: 'P1-Critical', reason: 'P1 first' });
		}
	}

	// 4b) For remaining slots, rotate categories and prefer higher priorities
	let catIndex = 0; // Work -> Personal -> Project -> ...
	const remainingTiers = ['P2-High', 'P3-Medium', 'P4-Low'];
	while (selected.length < needed) {
		let chosenTask = null;
		let chosenTier = null;
		let desiredCategory = categories[catIndex];

		// Try to take from the highest available tier that has the desired category
		for (const tier of remainingTiers) {
			const queue = byTierAndCategory[tier][desiredCategory];
			if (queue && queue.length > 0) {
				chosenTask = queue.shift();
				chosenTier = tier;
				break;
			}
		}

		// If desired category not available at higher tier, allow mixing priorities for diversity
		if (!chosenTask) {
			for (const tier of remainingTiers) {
				const queues = byTierAndCategory[tier];
				const anyCat = categories.find(c => queues[c] && queues[c].length > 0);
				if (anyCat) {
					chosenTask = queues[anyCat].shift();
					chosenTier = tier;
					break;
				}
			}
		}

		if (!chosenTask) break; // No more tasks anywhere

		selected.push(chosenTask);
		if (DEBUG) {
			console.log('[DEBUG][AutoFill] Selected task (round-robin)', {
				id: chosenTask.id,
				name: chosenTask.name,
				project: chosenTask.project,
				priority: chosenTask.priority,
				category: getProjectCategory(chosenTask.project),
				fromTier: chosenTier,
				reason: `Round-robin category ${desiredCategory} with priority preference`
			});
		}
		debugSelections.push({
			id: chosenTask.id,
			name: chosenTask.name,
			project: chosenTask.project,
			priority: chosenTask.priority,
			category: getProjectCategory(chosenTask.project),
			tier: chosenTier,
			reason: 'Round-robin'
		});

		catIndex = (catIndex + 1) % categories.length;
	}

	// 5) Fallback: if we still need more, fill strictly by priority order across remaining tiers
	if (selected.length < needed) {
		for (const tier of remainingTiers) {
			for (const cat of categories) {
				const queue = byTierAndCategory[tier][cat];
				while (queue.length > 0 && selected.length < needed) {
					const t = queue.shift();
					selected.push(t);
					if (DEBUG) {
						console.log('[DEBUG][AutoFill] Fallback add (by priority)', {
							id: t.id, name: t.name, project: t.project, priority: t.priority, category: cat
						});
					}
					debugSelections.push({ id: t.id, name: t.name, project: t.project, priority: t.priority, category: cat, tier, reason: 'Fallback' });
				}
			}
		}
	}

	const tasksToPromote = selected.slice(0, needed);
	if (DEBUG) {
		console.log('[DEBUG][AutoFill] Tasks to promote:', tasksToPromote.map(t => ({ id: t.id, name: t.name, project: t.project, priority: t.priority })));
	}

	if (tasksToPromote.length > 0) {
        console.log(`Auto-promoting ${tasksToPromote.length} tasks to Today`);
        
        // 4) Update Airtable and local state
        for (const task of tasksToPromote) {
            await updateTaskStatus(task.id, 'Today');
            task.status = 'Today';
            if (DEBUG) {
                console.log('[DEBUG][AutoFill] Promoted', { id: task.id, name: task.name, project: task.project, priority: task.priority });
            }
        }
        
        // Preserve existing behaviors
        renderTasks();
        // Refresh from Airtable to ensure full sync after updates
        await loadTasks();
    }
    updateBalanceStatus();

    if (DEBUG) {
        const finalToday = tasks.filter(t => t.status === 'Today').slice(0, 3);
        const composition = finalToday.reduce((acc, t) => {
            const cat = getProjectCategory(t.project);
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
        }, {});
        console.log('[DEBUG][AutoFill] Final Today composition:', composition, 'Tasks:', finalToday.map(t => ({ id: t.id, name: t.name, project: t.project, priority: t.priority })));
        lastAutoFillDebug = {
            needed,
            debugSelections,
            tasksToPromote: tasksToPromote.map(t => ({ id: t.id, name: t.name, project: t.project, priority: t.priority })),
            finalComposition: composition
        };
        console.groupEnd();
    }
}

// Update task status in Airtable
async function updateTaskStatus(taskId, newStatus) {
    try {
        const https = require('https');
        const data = JSON.stringify({
            fields: {
                'Status': newStatus
            }
        });

        const options = {
            hostname: 'api.airtable.com',
            path: `/v0/${BASE_ID}/${TABLE_NAME}/${taskId}`,
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let responseData = '';
                res.on('data', chunk => responseData += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(JSON.parse(responseData));
                    } else {
                        reject(new Error(`Status ${res.statusCode}: ${responseData}`));
                    }
                });
            });
            req.on('error', reject);
            req.write(data);
            req.end();
        });
    } catch (error) {
        console.error('Error updating task:', error);
        throw error;
    }
}

// Complete a task and auto-promote next one
async function completeTask(taskId) {
    try {
        await updateTaskStatus(taskId, 'Done');
        
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            task.status = 'Done';
        }
        
        // Check if we need to promote another task
        const todayTasks = tasks.filter(t => t.status === 'Today');
        if (DEBUG) {
            console.group('[DEBUG][Complete] Task completion');
            console.log('[DEBUG][Complete] Completed:', task ? { id: task.id, name: task.name, project: task.project, priority: task.priority } : taskId);
            console.log(`[DEBUG][Complete] Today count after completion: ${todayTasks.length}`);
        }
        
        if (todayTasks.length < 3) {
            // NEW: Prefer promoting a newly unblocked task
            const unblockedTasks = tasks.filter(t => Array.isArray(t.blockedByIds) && t.blockedByIds.includes(taskId));
            const nowUnblocked = unblockedTasks.filter(t => !hasIncompleteBlockers(t));
            if (nowUnblocked.length > 0) {
                showNotification(`🔓 ${nowUnblocked.length} task(s) unblocked!`);
                const candidate = nowUnblocked.find(t => t.status !== 'Done' && t.status !== 'Today');
                if (candidate) {
                    await updateTaskStatus(candidate.id, 'Today');
                    candidate.status = 'Today';
                    if (DEBUG) {
                        console.log('[DEBUG][Complete] Promoted newly unblocked task:', { id: candidate.id, name: candidate.name, project: candidate.project, priority: candidate.priority });
                    }
                    renderTasks();
                    if (DEBUG) console.groupEnd();
                    updateBalanceStatus();
                    return;
                }
            }
            // Find next highest priority task
            const candidates = tasks
                .filter(t => t.status !== 'Done' && t.status !== 'Today')
                .sort((a, b) => {
                    const priorityOrder = {
                        'P1-Critical': 1,
                        'P2-High': 2,
                        'P3-Medium': 3,
                        'P4-Low': 4
                    };
                    return (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
                });
            
            if (candidates.length > 0) {
                const nextTask = candidates[0];
                await updateTaskStatus(nextTask.id, 'Today');
                nextTask.status = 'Today';
                
                showNotification(`✅ Task completed! Promoted: ${nextTask.name}`);
                if (DEBUG) {
                    console.log('[DEBUG][Complete] Promoted next highest priority task:', { id: nextTask.id, name: nextTask.name, project: nextTask.project, priority: nextTask.priority });
                }
            }
        }
        
        renderTasks();
        if (DEBUG) console.groupEnd();
        updateBalanceStatus();
    } catch (error) {
        console.error('Error completing task:', error);
        alert('Failed to complete task. Check console for details.');
    }
}

// Get project emoji
function getProjectEmoji(project) {
    const emojiMap = {
        'CRM Dashboard': '📊',
        'Stem Sales': '💼',
        'Command Center': '🎯',
        'Business Development': '🤝',
        'Personal': '🏠',
        'Home Improvement': '🔨',
        'Learning': '📚',
        'Health': '💪'
    };
    return emojiMap[project] || '📋';
}

// Small colored badge + abbreviated project name for visual project indicators
function getProjectBadge(project) {
    const colorMap = {
        'CRM Dashboard': '#3B82F6', // Blue
        'Stem Sales': '#10B981', // Green
        'Business Development': '#8B5CF6', // Purple
        'Command Center': '#F97316', // Orange
        'Personal': '#EF4444', // Red
        'Home Improvement': '#92400E', // Brown
        'Learning': '#EAB308', // Yellow
        'Health': '#059669' // Emerald
    };
    const abbrevMap = {
        'CRM Dashboard': 'CRM',
        'Stem Sales': 'Sales',
        'Business Development': 'BD',
        'Command Center': 'Cmd',
        'Personal': 'Personal',
        'Home Improvement': 'Home',
        'Learning': 'Learn',
        'Health': 'Health'
    };

    const color = colorMap[project] || '#6b7280';
    const label = abbrevMap[project] || (project || 'Other');

    return `
        <span style="
            display: inline-flex;
            align-items: center;
            gap: 6px;
            height: 12px;
            line-height: 12px;
            padding: 0 6px;
            border-radius: 9999px;
            background: rgba(255,255,255,0.06);
            opacity: 0.8;
            margin-right: 8px;
        ">
            <span style="
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: ${color};
            "></span>
            <span style="
                font-size: 10px;
                color: ${color};
                font-weight: 600;
                letter-spacing: 0.2px;
            ">${label}</span>
        </span>
    `;
}

// Get priority color
function getPriorityColor(priority) {
    switch(priority) {
        case 'P1-Critical': return '#ef4444';
        case 'P2-High': return '#f59e0b';
        case 'P3-Medium': return '#3b82f6';
        case 'P4-Low': return '#6b7280';
        default: return '#3b82f6';
    }
}

// Get energy icons
function getEnergyIcons(energy) {
    switch(energy) {
        case 'High': return '⚡⚡⚡';
        case 'Medium': return '⚡⚡';
        case 'Low': return '⚡';
        default: return '⚡⚡';
    }
}

// Map project to high-level category used for balance status
function getProjectCategory(project) {
    const work = new Set(['CRM Dashboard', 'Stem Sales', 'Business Development']);
    const personal = new Set(['Personal', 'Home Improvement', 'Learning', 'Health']);
    const projectSpecific = new Set(['Command Center']);
    if (work.has(project)) return 'Work';
    if (personal.has(project)) return 'Personal';
    if (projectSpecific.has(project)) return 'Project';
    return 'Work';
}

// Update the balance status line under the list
function updateBalanceStatus() {
    const el = document.getElementById('balance-status');
    if (!el) return;

    const todayTasks = tasks.filter(t => t.status === 'Today').slice(0, 3);
    if (todayTasks.length === 0) {
        el.textContent = '';
        return;
    }

    const counts = { Work: 0, Personal: 0, Project: 0 };
    for (const t of todayTasks) {
        counts[getProjectCategory(t.project)]++;
    }

    const parts = [];
    if (counts.Work > 0) parts.push(`${counts.Work} Work`);
    if (counts.Personal > 0) parts.push(`${counts.Personal} Personal`);
    if (counts.Project > 0) parts.push(`${counts.Project} Project`);

    el.textContent = parts.length ? `Today's focus: ${parts.join(' • ')}` : '';
    if (DEBUG) {
        console.log('[DEBUG][Balance] Updated balance status:', el.textContent || '(empty)');
    }
}

// Render tasks
function renderTasks() {
    const todayTasks = tasks.filter(t => t.status === 'Today').slice(0, 3);
    const container = document.getElementById('tasks-container');
    
    if (todayTasks.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.6);">No tasks for today.<br>Press Cmd+Shift+N to add one!</div>';
        return;
    }
    
    container.innerHTML = todayTasks.map((task, index) => {
        const blocked = hasIncompleteBlockers(task);
        const blocking = !blocked && isBlocking(task);
        const icon = blocked ? '🔒' : (blocking ? '🔓' : '');
        const iconTitle = blocked ? `Blocked by: ${getBlockerNames(task)}` : (blocking ? 'Blocking other tasks' : '');
        const itemClass = blocked ? 'task-blocked' : (blocking ? 'task-blocking' : '');
        return `
        <div class="task-item ${itemClass}">
            <div style="display: flex; align-items: flex-start; gap: 12px;">
                <input 
                    type="checkbox" 
                    class="task-checkbox"
                    onchange="completeTask('${task.id}')"
                >
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <span style="
                            font-weight: 600;
                            color: ${getPriorityColor(task.priority)};
                            font-size: 13px;
                        ">[P${task.priority.charAt(1)}]</span>
                        ${getProjectBadge(task.project)}
                        ${icon ? `<span title="${iconTitle}">${icon}</span>` : ''}
                        <span style="font-weight: 600; font-size: 15px;">${task.name}</span>
                    </div>
                    <div style="
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        font-size: 13px;
                        color: rgba(255,255,255,0.7);
                        flex-wrap: wrap;
                    ">
                        <span>${getProjectEmoji(task.project)} ${task.project}</span>
                        <span>|</span>
                        <span>${getEnergyIcons(task.energy)} ${task.energy}</span>
                        ${task.timeEstimate ? `<span>| ${task.timeEstimate}</span>` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
    }).join('');
    updateBalanceStatus();
}

// Show notification
function showNotification(message) {
    const notif = document.createElement('div');
    notif.textContent = message;
    notif.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(34, 197, 94, 0.9);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
}

// Trigger sync button
async function syncTasks() {
    console.log('🔄 Syncing tasks...');
    
    if (ENABLE_SWEEPS) {
        try {
            const slackResult = await fetch('http://localhost:3456/sweep', { method: 'POST' })
                .then(r => r.json())
                .catch(() => ({ tasksAdded: 0 }));

            const emailResult = await triggerEmailSweep();

            const slackCount = slackResult.tasksAdded || 0;
            const emailCount = emailResult.tasksAdded || 0;
            const totalCount = slackCount + emailCount;

            await loadTasks();

            if (totalCount > 0) {
                showNotification(`✅ Added ${totalCount} new tasks! (${slackCount} from Slack, ${emailCount} from Email)`);
            } else {
                showNotification('✅ Sync complete - no new tasks found');
            }
        } catch (error) {
            console.error('Sync error:', error);
            showNotification('⚠️ Sync failed - check console');
        }
    } else {
        console.log('⚠️ Sweeps disabled - only reloading from Airtable');
        await loadTasks();
        await autoFillTodayTasks();
        showNotification('✅ Tasks synced from Airtable');
    }
}

async function triggerSync() {
    const syncBtn = document.getElementById('sync-btn');
    syncBtn.textContent = '⏳ Syncing...';
    syncBtn.disabled = true;
    
    try {
        await syncTasks();
    } finally {
        syncBtn.textContent = '🔄 Sync';
        syncBtn.disabled = false;
    }
}

// Email sweep function
async function triggerEmailSweep() {
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': CLAUDE_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 4096,
                messages: [{
                    role: 'user',
                    content: `Search my Outlook emails from the last 2 days for action items. Look for keywords like: "can you", "need", "please", "deadline", "urgent", "action required", "follow up", "reminder", "asap", "waiting for", "pending".

Filter out marketing/newsletters by skipping emails with: unsubscribe links, from addresses like no-reply@, noreply@, newsletter, marketing@, promo@, notifications@, updates@, @mail., @email., or subjects containing "unsubscribe", "newsletter", "promo", "deal", "sale".

For each real action item found, return ONLY a JSON array like this:
[
  {
    "task": "Follow up with John about Q4 budget",
    "priority": "P2-High",
    "energy": "Medium",
    "estimate": "30m",
    "source_link": "email_uri_here"
  }
]

Return ONLY the JSON array, no other text.`
                }],
                tools: [{
                    type: 'mcp',
                    mcp_servers: [{
                        type: 'url',
                        url: 'https://microsoft365.mcp.claude.com/mcp',
                        name: 'microsoft365-mcp'
                    }]
                }]
            })
        });

        const result = await response.json();
        
        // Extract text from response
        let tasksText = '';
        if (result.content) {
            for (const block of result.content) {
                if (block.type === 'text') {
                    tasksText += block.text;
                }
            }
        }
        
        // Parse JSON
        const jsonMatch = tasksText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            console.log('No action items found in emails');
            return { tasksAdded: 0 };
        }
        
        const emailTasks = JSON.parse(jsonMatch[0]);
        
        // Add tasks to Airtable
        let addedCount = 0;
        for (const task of emailTasks) {
            await addTaskToAirtable({
                taskName: task.task,
                priority: task.priority,
                energy: task.energy,
                timeEstimate: task.estimate,
                source: 'Email',
                status: 'Inbox',
                sourceLink: task.source_link
            });
            addedCount++;
        }
        
        return { tasksAdded: addedCount };
        
    } catch (error) {
        console.error('Email sweep error:', error);
        return { tasksAdded: 0 };
    }
}

// Add task to Airtable
async function addTaskToAirtable(taskData) {
    try {
        const https = require('https');
        const data = JSON.stringify({
            fields: {
                'Task Name': taskData.taskName,
                'Status': taskData.status || 'Inbox',
                'Priority': taskData.priority || 'P3-Medium',
                'Energy Level': taskData.energy || 'Medium',
                'Time Estimate': taskData.timeEstimate || '',
                'Source': taskData.source || 'Manual',
                'Context': taskData.context || '',
                'Project': taskData.project || 'Personal'
            }
        });

        const options = {
            hostname: 'api.airtable.com',
            path: `/v0/${BASE_ID}/${TABLE_NAME}`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let responseData = '';
                res.on('data', chunk => responseData += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(JSON.parse(responseData));
                    } else {
                        reject(new Error(`Status ${res.statusCode}: ${responseData}`));
                    }
                });
            });
            req.on('error', reject);
            req.write(data);
            req.end();
        });
    } catch (error) {
        console.error('Error adding task:', error);
        throw error;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadTasks();
    setInterval(loadTasks, 5 * 60 * 1000); // Refresh every 5 minutes
    
    // Header click to open Airtable
    document.getElementById('header').addEventListener('click', () => {
        require('electron').shell.openExternal(`https://airtable.com/${BASE_ID}`);
    });
    
    // Sync button
    document.getElementById('sync-btn').addEventListener('click', triggerSync);
    
    if (DEBUG) {
        console.log('[DEBUG] App ready. Use testAutoScheduling() in console to run auto-scheduling test.');
    }
});

// Temporary: developer test function for auto-scheduling logic
function testAutoScheduling() {
    if (!DEBUG) {
        console.warn('DEBUG is disabled. Enable DEBUG to run testAutoScheduling().');
        return;
    }
    console.group('[DEBUG][Test] Auto-scheduling test run');

    const candidates = tasks.filter(t => t.status !== 'Done' && t.status !== 'Today');
    const today = tasks.filter(t => t.status === 'Today');

    // Distribution by project (candidates)
    const byProject = candidates.reduce((acc, t) => {
        acc[t.project] = (acc[t.project] || 0) + 1;
        return acc;
    }, {});
    // Distribution by priority (candidates)
    const byPriority = candidates.reduce((acc, t) => {
        acc[t.priority] = (acc[t.priority] || 0) + 1;
        return acc;
    }, {});
    // Distribution by category (candidates)
    const byCategory = candidates.reduce((acc, t) => {
        const cat = getProjectCategory(t.project);
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
    }, {});

    console.log('[DEBUG][Test] Candidates distribution by project:', byProject);
    console.log('[DEBUG][Test] Candidates distribution by priority:', byPriority);
    console.log('[DEBUG][Test] Candidates distribution by category:', byCategory);
    console.log('[DEBUG][Test] Current Today list:', today.map(t => ({ id: t.id, name: t.name, project: t.project, priority: t.priority })));

    // Run auto-fill to observe decision logs
    autoFillTodayTasks().then(() => {
        console.log('[DEBUG][Test] Auto-fill finished. Last debug snapshot:', lastAutoFillDebug);
        const newToday = tasks.filter(t => t.status === 'Today').slice(0, 3);
        console.log('[DEBUG][Test] Updated Today list:', newToday.map(t => ({ id: t.id, name: t.name, project: t.project, priority: t.priority })));
        console.groupEnd();
    }).catch(err => {
        console.groupEnd();
        console.error('[DEBUG][Test] Auto-fill error:', err);
    });
}

/**
 * Run morning routine manually
 * Triggers the morning-routine-service.js via API endpoint
 */
async function runMorningRoutine() {
	try {
		// Show loading state
		showNotification('☀️ Running morning routine...', 'info');

		// Call the morning routine endpoint
		const response = await fetch('http://localhost:3457/api/morning-routine', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const result = await response.json();

		if (result.success) {
			// Show success notification
			const message = `✅ ${result.tasksUpdated} tasks re-prioritized\n📅 ${result.dayType} day`;
			showNotification(message, 'success');

			// Reload tasks to show updated priorities
			await loadTasks();

			// Log insights if available
			if (result.insights) {
				console.log('Morning Routine Insights:', result.insights);
			}
		} else {
			throw new Error(result.error || 'Unknown error');
		}

	} catch (error) {
		console.error('Morning routine failed:', error);
		showNotification('⚠️ Morning routine failed. Check console for details.', 'error');
	}
}

/**
 * Show notification helper
 * @param {string} message - The message to display
 * @param {string} type - 'info', 'success', or 'error'
 */
function showNotification(message, type = 'info') {
	// If you already have a notification system, use it
	// Otherwise, this creates a simple toast notification

	const notification = document.createElement('div');
	notification.className = `notification notification-${type}`;
	notification.textContent = message;

	// Style the notification
	notification.style.position = 'fixed';
	notification.style.top = '20px';
	notification.style.right = '20px';
	notification.style.padding = '15px 20px';
	notification.style.borderRadius = '8px';
	notification.style.zIndex = '10000';
	notification.style.maxWidth = '300px';
	notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
	notification.style.fontSize = '14px';
	notification.style.lineHeight = '1.5';

	// Color based on type
	if (type === 'success') {
		notification.style.backgroundColor = '#10b981';
		notification.style.color = 'white';
	} else if (type === 'error') {
		notification.style.backgroundColor = '#ef4444';
		notification.style.color = 'white';
	} else {
		notification.style.backgroundColor = '#3b82f6';
		notification.style.color = 'white';
	}

	document.body.appendChild(notification);

	// Auto-remove after 5 seconds
	setTimeout(() => {
		notification.style.transition = 'opacity 0.3s';
		notification.style.opacity = '0';
		setTimeout(() => notification.remove(), 300);
	}, 5000);
}

// Make sure the function is available globally
window.runMorningRoutine = runMorningRoutine;