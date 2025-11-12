// morning-triage-service.js
// Uses your Airtable schema + Claude JSON-or-bust with a deterministic fallback.

const {
  AIRTABLE_TOKEN,
  AIRTABLE_BASE_ID,
  AIRTABLE_TABLE_NAME,
  ANTHROPIC_API_KEY,
} = require('./config');

const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

/* ---------------- Airtable helpers ---------------- */

const AT_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
  AIRTABLE_TABLE_NAME
)}`;
const AT_HEADERS = {
  Authorization: `Bearer ${AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
};

// Pull only Inbox tasks
async function getInboxTasks() {
  const url = new URL(AT_URL);
  url.searchParams.set('filterByFormula', `Status="Inbox"`);
  const r = await fetch(url, { headers: AT_HEADERS });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || 'Airtable fetch failed');
  return j.records || [];
}

// Bulk set Status="Today" for a list of record ids
async function updatePromotedTasks(ids) {
  if (!ids?.length) return { updated: 0 };
  const r = await fetch(AT_URL, {
    method: 'PATCH',
    headers: AT_HEADERS,
    body: JSON.stringify({
      records: ids.map(id => ({ id, fields: { Status: 'Today' } })),
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || 'Airtable update failed');
  return { updated: j.records?.length || 0 };
}

/* ---------------- Prompt construction ---------------- */

function buildPrompt(inboxTasks, calendarSummary = '') {
  // Render a compact list for the model; include each Airtable record id.
  const list = (inboxTasks || [])
    .map((rec, i) => {
      const f = rec.fields || {};
      return `${i + 1}. ${f['Task Name'] || '(unnamed)'}
Priority: ${f.Priority || 'Not set'}
Energy Level: ${f['Energy Level'] || 'Not set'}
Time Estimate: ${f['Time Estimate'] ?? 'Not set'}
Due Date: ${f['Due Date'] || 'No deadline'}
Context: ${f.Context || 'Not set'}
Project: ${f.Project || 'Not set'}
Id: ${rec.id}`;
    })
    .join('\n\n');

  return `You are Kevin's AI task manager. It's morning planning time.

CALENDAR TODAY:
${calendarSummary || '(no calendar provided)'}

INBOX TASKS:
${list || '(empty)'}

Goals:
- Choose up to 3 tasks to set Status="Today".
- Use Kevin's priority scale: P1-Critical > P2-High > P3-Medium > P4-Low.
- Prefer high priority, low effort (smaller Time Estimate), and include at least one "Quick Wins" when appropriate.
- If fewer than 3 are appropriate, return fewer.

Return ONLY valid minified JSON in this exact shape and nothing else:
{"today_task_ids":["recXXXX","recYYYY"]}`;
}

/* ---------------- Claude call with JSON enforcement ---------------- */

function tryParseJson(s = '') {
  if (!s) return null;
  const fence = s.match(/```json\s*([\s\S]*?)```/i);
  if (fence) {
    try { return JSON.parse(fence[1].trim()); } catch {}
  }
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(s.slice(first, last + 1)); } catch {}
  }
  try { return JSON.parse((s || '').trim()); } catch {}
  return null;
}

async function analyzeTasksWithClaude(inboxTasks, calendarSummary) {
  // Cap to keep prompt small and consistent
  const capped = Array.isArray(inboxTasks) ? inboxTasks.slice(0, 20) : [];
  const prompt = buildPrompt(capped, calendarSummary);

  async function callClaude(instruction) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 800,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content:
              'Return ONLY valid minified JSON. No prose. No code fences.\n' +
              instruction,
          },
        ],
      }),
    });
    const j = await r.json();
    const text =
      (j && j.content && j.content[0] && j.content[0].text) ||
      (Array.isArray(j.content) ? j.content.map(p => p.text || '').join('\n') : '') ||
      '';
    return { raw: j, text };
  }

  // Try 1
  let { raw, text } = await callClaude(prompt);
  let parsed = tryParseJson(text);

  // Try 2 (repair)
  if (!parsed) {
    ({ raw, text } = await callClaude(
      `Output exactly this shape and nothing else: {"today_task_ids":["recXXXX"]}\n` + prompt
    ));
    parsed = tryParseJson(text);
  }

  if (!parsed) {
    console.error('[claude] Could not parse JSON. Raw response:', JSON.stringify(raw).slice(0, 2000));
    throw new Error('Claude did not return JSON');
  }
  return parsed;
}

/* ---------------- Deterministic fallback (P1..P4) ---------------- */

function pickFallbackToday(inbox, count = 3) {
  const priorityRank = {
    'P1-Critical': 0,
    'P2-High': 1,
    'P3-Medium': 2,
    'P4-Low': 3,
  };

  return [...inbox]
    .sort((a, b) => {
      const fa = a.fields || {};
      const fb = b.fields || {};
      const pa = priorityRank[fa.Priority] ?? 99;
      const pb = priorityRank[fb.Priority] ?? 99;
      if (pa !== pb) return pa - pb;

      // Smaller time estimate first
      const ta = Number(fa['Time Estimate'] ?? 9999);
      const tb = Number(fb['Time Estimate'] ?? 9999);
      if (ta !== tb) return ta - tb;

      // Prefer Quick Wins as final tie-breaker
      const qa = fa.Context === 'Quick Wins' ? 0 : 1;
      const qb = fb.Context === 'Quick Wins' ? 0 : 1;
      return qa - qb;
    })
    .slice(0, count)
    .map(r => r.id);
}

/* ---------------- Orchestrator ---------------- */

async function runMorningRoutine({ calendarSummary = '' } = {}) {
  const inbox = await getInboxTasks();
  if (!inbox.length) {
    return { success: true, promoted: [], decision: { today_task_ids: [] }, note: 'No inbox tasks' };
  }

  let decision;
  try {
    decision = await analyzeTasksWithClaude(inbox, calendarSummary);
  } catch (e) {
    console.warn('[routine] Claude JSON failed, using fallback:', e.message);
    decision = { today_task_ids: pickFallbackToday(inbox, 3) };
  }

  const ids = decision.today_task_ids || [];
  if (ids.length) await updatePromotedTasks(ids);

  return { success: true, promoted: ids, decision };
}

module.exports = { runMorningRoutine };