const https = require('https');
const fs = require('fs');

// Airtable Configuration
const AIRTABLE_TOKEN = 'AIRTABLE_TOKEN_REDACTED.44d1b12f6a83e20f6d2e8cce95f0a11ca620fc63833988186259775151510950';
const BASE_ID = 'appQlPzbpST2aQ3ca';
const TABLE_NAME = 'Tasks';

// Read the markdown file
const markdownPath = process.argv[2] || './competitive-intel-checklist.md';
const markdown = fs.readFileSync(markdownPath, 'utf8');

// Parse markdown and extract tasks
function parseMarkdown(md) {
  const tasks = [];
  const lines = md.split('\n');
  
  let currentParentTask = null;
  let currentTaskName = '';
  let currentPriority = 'P3-Medium';
  let currentTimeEstimate = 60;
  let currentPhase = '';
  let inSubtasks = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Detect phase headers (e.g., "## 🔴 PHASE 1: DATA FOUNDATION")
    if (line.match(/^##\s+.*PHASE\s+\d+:/i)) {
      currentPhase = line.replace(/^##\s+/, '').replace(/[🔴🟢🎨🚀✨]/g, '').trim();
      continue;
    }
    
    // Detect main tasks (e.g., "### ✅ Task 1.1: Analyze Current Competitor Data")
    const taskMatch = line.match(/^###\s+.*Task\s+([\d.]+):\s+(.+)/i);
    if (taskMatch) {
      currentTaskName = `${taskMatch[1]}: ${taskMatch[2]}`;
      currentParentTask = {
        taskName: currentTaskName,
        phase: currentPhase,
        priority: 'P3-Medium',
        timeEstimate: 60,
        subtaskTexts: []
      };
      inSubtasks = false;
      continue;
    }
    
    // Detect priority (e.g., "**Priority**: 🔴 HIGH")
    const priorityMatch = line.match(/\*\*Priority\*\*:\s+.*?(HIGH|MEDIUM|LOW)/i);
    if (priorityMatch && currentParentTask) {
      const level = priorityMatch[1].toUpperCase();
      if (level === 'HIGH') currentParentTask.priority = 'P2-High';
      else if (level === 'MEDIUM') currentParentTask.priority = 'P3-Medium';
      else if (level === 'LOW') currentParentTask.priority = 'P4-Low';
      continue;
    }
    
    // Detect time estimate (e.g., "**Time**: 2 hours")
    const timeMatch = line.match(/\*\*Time\*\*:\s+(\d+)\s+hours?/i);
    if (timeMatch && currentParentTask) {
      currentParentTask.timeEstimate = parseInt(timeMatch[1]) * 60;
      continue;
    }
    
    // Detect subtasks section
    if (line.match(/^\*\*Subtasks\*\*:/i)) {
      inSubtasks = true;
      continue;
    }
    
    // Collect subtask items
    if (inSubtasks && line.match(/^-\s+\[\s*\]\s+(.+)/)) {
      const subtaskText = line.replace(/^-\s+\[\s*\]\s+/, '').trim();
      if (currentParentTask) {
        currentParentTask.subtaskTexts.push(subtaskText);
      }
      continue;
    }
    
    // End of subtasks section (when we hit completion criteria or other markers)
    if (inSubtasks && (line.match(/^\*\*Completion Criteria\*\*:/i) || line.match(/^\*\*Test/i))) {
      inSubtasks = false;
      
      // Save the parent task
      if (currentParentTask && currentParentTask.taskName) {
        tasks.push(currentParentTask);
        currentParentTask = null;
      }
    }
  }
  
  return tasks;
}

// Create task in Airtable
function createTask(taskData) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      records: [{
        fields: taskData
      }]
    });
    
    const options = {
      hostname: 'api.airtable.com',
      path: `/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const result = JSON.parse(body);
          resolve(result.records[0]);
        } else {
          reject(new Error(`Airtable API error: ${res.statusCode} - ${body}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Main execution
async function importTasks() {
  console.log('📖 Reading markdown file...');
  const parsedTasks = parseMarkdown(markdown);
  console.log(`Found ${parsedTasks.length} parent tasks\n`);
  
  let totalSubtasks = 0;
  
  for (const task of parsedTasks) {
    try {
      // Create parent task
      console.log(`Creating parent: ${task.taskName}`);
      const parentTaskData = {
        'Task Name': task.taskName,
        'Status': 'Inbox',
        'Priority': task.priority,
        'Time Estimate': task.timeEstimate,
        'Source': 'Manual',
        'Context': 'Deep Work',
        'AI Reasoning': `Phase: ${task.phase}`
      };
      
      const parentRecord = await createTask(parentTaskData);
      console.log(`✅ Created parent task: ${task.taskName} (ID: ${parentRecord.id})`);
      
      // Wait a bit to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 250));
      
      // Create subtasks
      if (task.subtaskTexts.length > 0) {
        console.log(`  Creating ${task.subtaskTexts.length} subtasks...`);
        
        for (const subtaskText of task.subtaskTexts) {
          const subtaskData = {
            'Task Name': subtaskText,
            'Status': 'Inbox',
            'Priority': task.priority,
            'Time Estimate': Math.round(task.timeEstimate / task.subtaskTexts.length),
            'Source': 'Manual',
            'Context': 'Deep Work',
            'Parent Task': [parentRecord.id]
          };
          
          await createTask(subtaskData);
          console.log(`    ✅ Created subtask: ${subtaskText}`);
          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        totalSubtasks += task.subtaskTexts.length;
      }
      // Extra spacing between parent tasks
      console.log('');
    } catch (err) {
      console.error(`Failed to import for parent "${task.taskName}":`, err.message || err);
      // Continue with next parent task
    }
  }

  console.log(`\n✅ Import complete. Parents: ${parsedTasks.length}, Subtasks: ${totalSubtasks}`);
}

if (require.main === module) {
  importTasks().catch(err => {
    console.error('Fatal import error:', err);
    process.exit(1);
  });
}
