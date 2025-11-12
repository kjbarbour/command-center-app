// src/api/ai.js
const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini'

function requireKey() {
  if (!OPENAI_KEY) throw new Error('Missing VITE_OPENAI_API_KEY in .env')
}

/**
 * Parse free text into task objects (already installed earlier).
 */
export async function aiParseTasks(freeText) {
  requireKey()
  const system = `You are a task extraction engine. Output strict JSON {"tasks":[...]}.
Each task fields (null if unknown):
name, status("Inbox"|"Today"|"This Week"|"Scheduled"|"Done"|"Someday"),
priority("P1-Critical"|"P2-High"|"P3-Medium"|"P4-Low"),
energy("High"|"Medium"|"Low"),
time(number minutes), due(YYYY-MM-DD),
context("Deep Work"|"Meetings"|"Admin"|"Quick Wins"),
project("CRM Dashboard"|"Stem Sales"|"Command Center"|"Business Development"|"Personal"|"Home Improvement"|"Learning"|"Health"),
notes.
Prefer concise, imperative names.`
  const user = `Free text:\n${freeText}`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: 0.2,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content?.trim()
  const json = JSON.parse(content)

  if (!Array.isArray(json?.tasks)) throw new Error('AI returned no tasks')
  return json.tasks.map(normalizeTask)
}

/**
 * Enrich existing tasks (fill missing/weak fields ONLY).
 * Input: array of tasks (with name/status/priority/etc.)
 * Output strict JSON: {"tasks":[{index, updates:{...}}]}
 *  - "updates" includes ONLY fields we should set (e.g., time, context, energy, due, priority)
 */
export async function aiEnrichTasks(tasks) {
  requireKey()
  const system = `You are an assistant that suggests missing task metadata.
Given an array of tasks, respond JSON {"tasks":[{index, updates}]}.
- Only include fields that should be ADDED or IMPROVED.
- Never change a field that is already present and specific.
- Allowed fields in updates: status, priority, energy, time, due, context, notes.
- Constraints:
  status ∈ {"Inbox","Today","This Week","Scheduled","Done","Someday"}
  priority ∈ {"P1-Critical","P2-High","P3-Medium","P4-Low"}
  energy ∈ {"High","Medium","Low"}
  time is minutes (integer, typical 5–120)
  due is YYYY-MM-DD (date-only)
  context ∈ {"Deep Work","Meetings","Admin","Quick Wins"}
  notes: short helpful phrase if truly useful.
- Examples:
  "call", "email", "file", "schedule" → context "Admin"
  "draft, build, analyze, focus" → "Deep Work"
  meetings/calls → "Meetings"
  quick 5–10m items → time 5–15, context "Quick Wins"
Return ONLY the JSON.`
  const user = JSON.stringify({ tasks }, null, 2)

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: 0.2,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content?.trim()
  const json = JSON.parse(content)

  if (!Array.isArray(json?.tasks)) return []
  // Sanitize updates to allowed values
  return json.tasks.map((t) => ({
    index: Number(t.index),
    updates: sanitizeUpdates(t.updates || {}),
  }))
}

/* ---------- helpers ---------- */

function normalizeTask(t) {
  return {
    name: t.name ?? 'Untitled',
    status: t.status ?? 'Inbox',
    priority: t.priority ?? 'P3-Medium',
    energy: t.energy ?? 'Medium',
    time: t.time ?? null,
    due: t.due ?? null,
    context: t.context ?? null,
    project: t.project ?? 'Command Center',
    notes: t.notes ?? '',
  }
}

function sanitizeUpdates(u) {
  const statuses = new Set(['Inbox','Today','This Week','Scheduled','Done','Someday'])
  const priorities = new Set(['P1-Critical','P2-High','P3-Medium','P4-Low'])
  const energies = new Set(['High','Medium','Low'])
  const contexts = new Set(['Deep Work','Meetings','Admin','Quick Wins'])

  const out = {}
  if (u.status && statuses.has(u.status)) out.status = u.status
  if (u.priority && priorities.has(u.priority)) out.priority = u.priority
  if (u.energy && energies.has(u.energy)) out.energy = u.energy
  if (Number.isFinite(u.time)) {
    const n = Math.max(1, Math.min(240, Math.round(u.time)))
    out.time = n
  }
  if (typeof u.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(u.due)) out.due = u.due
  if (u.context && contexts.has(u.context)) out.context = u.context
  if (u.notes && typeof u.notes === 'string') out.notes = u.notes.slice(0, 200)
  return out
}