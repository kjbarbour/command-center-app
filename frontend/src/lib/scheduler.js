// src/lib/scheduler.js
// Normalizes Airtable records and schedules them into provided time blocks.

const PRI_RANK = { 'P1-Critical': 1, 'P2-High': 2, 'P3-Medium': 3, 'P4-Low': 4 }

export function normalizeTask(rec) {
  const f = rec?.fields || rec || {}
  const id = rec?.id || f.id
  const name = f['Task Name'] ?? f.name ?? '(untitled)'

  const status = f['Status'] ?? f.status ?? 'Inbox'
  const priority = f['Priority'] ?? f.priority ?? 'P3-Medium'
  const context = f['Context'] ?? f.context ?? 'Admin'
  const energy = f['Energy Level'] ?? f.energy ?? 'Medium'
  const project = f['Project'] ?? f.project ?? null
  const auto = coerceBool(f['Auto-Schedule'] ?? f.autoSchedule ?? false) // base defaults to false

  // Default 30m if missing
  const minutesRaw = f['Time Estimate'] ?? f.time ?? f.estimate
  const minutes = clampInt(Number(minutesRaw), 30, 1, 8 * 60)

  const dueStr = f['Due Date'] ?? f.due ?? null
  const due = parseDateOnly(dueStr)

  return {
    id, name,
    status, priority, priorityRank: PRI_RANK[priority] || 999,
    context, energy, project,
    minutes,
    due, dueStr,
    auto,
    raw: rec,
  }
}

function coerceBool(v) {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return ['true','1','yes','y','on'].includes(v.toLowerCase())
  if (typeof v === 'number') return v !== 0
  return false
}

function clampInt(n, fallback, min, max) {
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

function parseDateOnly(s) {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s))
  if (!m) return null
  return new Date(+m[1], +m[2] - 1, +m[3])
}

/**
 * schedule(tasks, { blocks, ignoreAuto = false, includeScheduled = false })
 * - ignoreAuto: if true, don't require Auto-Schedule = true
 * - includeScheduled: if true, allow tasks already in "Scheduled" to be replanned
 */
export function schedule(tasks, { blocks, ignoreAuto = false, includeScheduled = false }) {
  const eligible = []
  const ineligible = []

  for (const t of tasks) {
    const reasons = []
    const s = String(t.status || '').toLowerCase()

    if (!ignoreAuto && !t.auto) reasons.push('Auto-Schedule is off')
    if (['done', 'someday'].includes(s)) reasons.push(`Status is ${t.status}`)
    if (!includeScheduled && s === 'scheduled') reasons.push('Already scheduled')
    if (!t.minutes || t.minutes <= 0) reasons.push('No duration')

    const isActiveStatus = ['inbox', 'today', 'this week'].includes(s) || (includeScheduled && s === 'scheduled')

    if (reasons.length) ineligible.push({ ...t, reasons })
    else if (isActiveStatus) eligible.push(t)
    else ineligible.push({ ...t, reasons: ['Unsupported status'] })
  }

  // Sort: priority → due date → status → longer tasks first
  const statusRank = s => (s === 'Today' ? 0 : s === 'This Week' ? 1 : s === 'Scheduled' ? 2 : 3)
  eligible.sort((a, b) => {
    if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank
    const ad = a.due?.getTime?.() ?? Infinity
    const bd = b.due?.getTime?.() ?? Infinity
    if (ad !== bd) return ad - bd
    const asr = statusRank(a.status); const bsr = statusRank(b.status)
    if (asr !== bsr) return asr - bsr
    return b.minutes - a.minutes
  })

  // Greedy fit
  const assignments = []
  const unscheduled = []
  const blockSlots = blocks.map(b => ({ ...b, cursor: new Date(b.start) }))

  for (const task of eligible) {
    let placed = false
    for (const slot of blockSlots) {
      const freeMs = slot.end - slot.cursor
      if (freeMs <= 0) continue
      const needMs = task.minutes * 60 * 1000
      if (needMs <= freeMs) {
        const start = new Date(slot.cursor)
        const end = new Date(slot.cursor.getTime() + needMs)
        assignments.push({ id: task.id, name: task.name, start, end, minutes: task.minutes, raw: task.raw })
        slot.cursor = end
        placed = true
        break
      }
    }
    if (!placed) unscheduled.push(task)
  }

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
  return { today: todayStr, assignments, unscheduled, ineligible }
}