// src/api/enrich.js
// Utilities for AI enrichment used in Command Center
// Exposes: summarizeDay, enrichTasks, classifyTask, suggestTaskEnhancements, parseBrainDump

// ---------- Day summary ----------
export async function summarizeDay(text) {
  const key = import.meta.env.VITE_OPENAI_API_KEY
  if (!key) return { ok: false, error: 'Missing VITE_OPENAI_API_KEY' }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Summarize the user’s day succinctly with bullets and next-steps.' },
          { role: 'user', content: text }
        ],
        temperature: 0.3
      })
    })
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content ?? ''
    return { ok: true, content }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// ---------- Batch enrichment placeholder ----------
export async function enrichTasks(tasks) {
  return tasks
}

// ---------- Auto-triage ----------
export async function classifyTask(text) {
  const trimmed = (text || '').trim()
  if (!trimmed) return fallbackClassify('')

  const key = import.meta.env.VITE_OPENAI_API_KEY
  if (!key) return fallbackClassify(trimmed)

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: `Classify a single to-do into this schema. Return ONLY JSON:
{
  "Status": "Inbox|Today|This Week|Scheduled",
  "Priority": "P1-Critical|P2-High|P3-Medium|P4-Low",
  "EnergyLevel": "High|Medium|Low",
  "Context": "Deep Work|Meetings|Admin|Quick Wins",
  "DueDate": "YYYY-MM-DD|null",
  "Project": "CRM Dashboard|Stem Sales|Command Center|Business Development|Personal|Home Improvement|Learning|Health|null",
  "AutoSchedule": true|false
}
Timezone America/Chicago.`
          },
          { role: 'user', content: trimmed }
        ]
      })
    })

    const data = await res.json()
    const raw = data?.choices?.[0]?.message?.content
    const parsed = JSON.parse(raw ?? '{}')
    return sanitizeClassify({ ...fallbackClassify(trimmed), ...parsed })
  } catch {
    return fallbackClassify(trimmed)
  }
}

function sanitizeClassify(o) {
  const Statuses = ['Inbox','Today','This Week','Scheduled']
  const Priorities = ['P1-Critical','P2-High','P3-Medium','P4-Low']
  const Energy = ['High','Medium','Low']
  const Contexts = ['Deep Work','Meetings','Admin','Quick Wins']
  const Projects = ['CRM Dashboard','Stem Sales','Command Center','Business Development','Personal','Home Improvement','Learning','Health']
  const coerce = (v, arr, def) => arr.includes(v) ? v : def
  const out = {
    Status: coerce(o?.Status, Statuses, 'Inbox'),
    Priority: coerce(o?.Priority, Priorities, 'P3-Medium'),
    EnergyLevel: coerce(o?.EnergyLevel, Energy, 'Medium'),
    Context: coerce(o?.Context, Contexts, 'Admin'),
    DueDate: validISO(o?.DueDate) ? o.DueDate : null,
    Project: o?.Project && Projects.includes(o.Project) ? o.Project : null,
    AutoSchedule: Boolean(o?.AutoSchedule),
  }
  return out
}

function validISO(s) { return !!(s && typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)) }

function fallbackClassify(text) {
  const t = (text || '').toLowerCase()
  const urgent = /\burgent|asap|eod|today\b/.test(t)
  const meeting = /\bcall|meet|sync|demo|schedule|zoom|teams|calendar\b/.test(t)
  const admin = /\bemail|invoice|file|report|clean up|rename|export|import|docs?\b/.test(t)
  const deep = /\bcode|design|build|refactor|schema|api|query|etl|sql|prisma|react|next\b/.test(t)
  const quick = /\b5 ?min|ten minutes|quick|fast|tiny|rename|typo\b/.test(t)

  let Status = urgent ? 'Today' : meeting ? 'This Week' : 'Inbox'
  let Priority = urgent ? 'P2-High' : deep ? 'P3-Medium' : 'P3-Medium'
  if (/\bblocker|critical|prod|outage\b/.test(t)) Priority = 'P1-Critical'

  let Context = 'Admin'
  if (meeting) Context = 'Meetings'
  else if (deep) Context = 'Deep Work'
  else if (quick) Context = 'Quick Wins'

  let EnergyLevel = quick ? 'Low' : deep ? 'High' : 'Medium'

  let Project = null
  if (/\bcrm\b|dashboard/.test(t)) Project = 'CRM Dashboard'
  else if (/\bstem\b|quota|pipeline/.test(t)) Project = 'Stem Sales'
  else if (/\bcommand center\b|task board|pwa\b/.test(t)) Project = 'Command Center'
  else if (/\bhome|yard|paint|couch|garage\b/.test(t)) Project = 'Home Improvement'
  else if (/\bgolf|practice\b/.test(t)) Project = 'Personal'
  else if (/\blearn|course|read|study\b/.test(t)) Project = 'Learning'
  else if (/\bworkout|doctor|health\b/.test(t)) Project = 'Health'

  const AutoSchedule = Status === 'Today' || Status === 'This Week'
  return sanitizeClassify({ Status, Priority, EnergyLevel, Context, DueDate: null, Project, AutoSchedule })
}

// ---------- Contextual AI Suggestions ----------
export async function suggestTaskEnhancements(task) {
  const title = task?.fields?.['Task Name'] || task?.name || ''
  const notes = task?.fields?.['Notes'] || task?.notes || ''
  const status = task?.fields?.['Status'] || task?.status || ''
  const priority = task?.fields?.['Priority'] || task?.priority || ''
  const context = task?.fields?.['Context'] || task?.context || ''
  const due = task?.fields?.['Due Date'] || task?.due || ''
  const project = task?.fields?.['Project'] || task?.project || ''

  const key = import.meta.env.VITE_OPENAI_API_KEY
  if (!key) return fallbackSuggest({ title, notes, status, priority, context, due, project })

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: `You improve a single task by proposing concrete steps.
Return ONLY JSON:
{
  "nextSteps": string[],
  "subtasks": string[],
  "suggestedDueDate": "YYYY-MM-DD|null",
  "risks": string[],
  "note": string
}
Resolve vague dates to America/Chicago. Keep steps specific.`
          },
          {
            role: 'user',
            content: `Task:
Title: ${title}
Notes: ${notes}
Status: ${status} | Priority: ${priority} | Context: ${context} | Due: ${due || 'n/a'} | Project: ${project || 'n/a'}`
          }
        ]
      })
    })
    const data = await res.json()
    const raw = data?.choices?.[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw)

    const out = {
      nextSteps: arr(parsed.nextSteps).slice(0, 5),
      subtasks: arr(parsed.subtasks).slice(0, 5),
      suggestedDueDate: validISO(parsed.suggestedDueDate) ? parsed.suggestedDueDate : null,
      risks: arr(parsed.risks).slice(0, 5),
      note: typeof parsed.note === 'string' ? parsed.note.slice(0, 600) : ''
    }
    const fb = fallbackSuggest({ title, notes, status, priority, context, due, project })
    return {
      nextSteps: out.nextSteps.length ? out.nextSteps : fb.nextSteps,
      subtasks: out.subtasks.length ? out.subtasks : fb.subtasks,
      suggestedDueDate: out.suggestedDueDate || fb.suggestedDueDate,
      risks: out.risks.length ? out.risks : fb.risks,
      note: out.note || fb.note
    }
  } catch {
    return fallbackSuggest({ title, notes, status, priority, context, due, project })
  }
}

function arr(x) { return Array.isArray(x) ? x.filter(Boolean) : [] }

function fallbackSuggest({ title, notes, status, priority, context, due, project }) {
  const steps = []
  const subtasks = []
  const risks = []

  const hasDesign = /\b(ui|ux|design|mock|figma)\b/i.test(title+notes)
  const hasCode = /\b(code|api|prisma|schema|next|react|typescript|bug|fix|refactor)\b/i.test(title+notes)
  const hasMeeting = /\bcall|meet|demo|review|sync|agenda\b/i.test(title+notes)
  const quick = /\brename|typo|small|quick|5 ?min\b/i.test(title+notes)

  if (hasMeeting) {
    steps.push('Draft a 3-point agenda')
    steps.push('Collect links/screenshots needed for discussion')
  }
  if (hasCode) {
    steps.push('Define acceptance criteria (1–3 bullets)')
    steps.push('Create a dev branch and commit a stub')
    subtasks.push('Add lint/typecheck and run locally (≤20m)')
  }
  if (hasDesign) {
    steps.push('Sketch a rough wireframe')
    subtasks.push('Export a quick mock for feedback (≤30m)')
  }
  if (!steps.length) steps.push('Write 2–3 bullet acceptance criteria')

  if (quick) subtasks.push('Implement quick fix (≤15m)')
  if (!subtasks.length) subtasks.push('Break into 2–3 atomic steps (≤45m each)')

  if (!risks.length) risks.push('Ambiguous scope or missing acceptance criteria')

  const suggestedDueDate = validISO(due) ? due : null

  return {
    nextSteps: steps,
    subtasks,
    suggestedDueDate,
    risks,
    note: 'Generated offline by simple heuristics based on the task title/notes.'
  }
}

// ---------- Brain Dump parsing (multi-task) ----------
/**
 * parseBrainDump(text) -> { tasks: Array<CommandCenterTask>, errors?: string[] }
 * Where CommandCenterTask aligns to your Airtable fields:
 *  - Task Name, Status, Priority, Energy Level, Context, Due Date?, Project?, Auto-Schedule (bool), Notes, AI Reasoning
 */
export async function parseBrainDump(text) {
  const cleaned = String(text || '').trim()
  if (!cleaned) return { tasks: [] }

  const key = import.meta.env.VITE_OPENAI_API_KEY
  if (!key) {
    // Offline fallback: split by lines/semicolons, classify heuristically
    const lines = cleaned
      .split(/\n|;|\. (?=[A-Z(])/)
      .map(s => s.trim())
      .filter(Boolean)
    const tasks = await Promise.all(lines.map(async (ln) => {
      const c = fallbackClassify(ln)
      return toAirtablePayload(ln, c, '(offline heuristic)')
    }))
    return { tasks }
  }

  // With AI: extract tasks first, then classify each
  try {
    const extraction = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
`Extract distinct actionable tasks from the user's brain dump.
Return ONLY JSON:
{ "items": [ { "title": string, "reasoning": string } ] }
- Split combined lines if multiple tasks are present.
- Titles should be short, imperative, and self-contained.`
          },
          { role: 'user', content: cleaned }
        ]
      })
    })
    const data = await extraction.json()
    const raw = data?.choices?.[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw)
    const items = Array.isArray(parsed.items) ? parsed.items.filter(x => x && x.title) : []

    // Classify each task
    const result = []
    for (const it of items) {
      const cls = await classifyTask(it.title)
      result.push(toAirtablePayload(it.title, cls, it.reasoning || ''))
    }
    return { tasks: result }
  } catch (e) {
    // Fallback if extraction fails
    const lines = cleaned
      .split(/\n|;|\. (?=[A-Z(])/)
      .map(s => s.trim())
      .filter(Boolean)
    const tasks = await Promise.all(lines.map(async (ln) => {
      const c = await classifyTask(ln) // this itself falls back safely
      return toAirtablePayload(ln, c, '')
    }))
    return { tasks }
  }
}

// Map classifier result into Airtable field payload
function toAirtablePayload(title, cls, reasoning) {
  const payload = {
    'Task Name': title,
    'Status': cls.Status,
    'Priority': cls.Priority,
    'Energy Level': cls.EnergyLevel,
    'Context': cls.Context,
    'Auto-Schedule': Boolean(cls.AutoSchedule),
    'Notes': reasoning ? `AI Reasoning: ${reasoning}` : '',
    'AI Reasoning': reasoning || '',
  }
  if (cls.Project) payload['Project'] = cls.Project
  if (cls.DueDate) payload['Due Date'] = cls.DueDate
  return payload
}