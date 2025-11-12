import { useEffect, useMemo, useState } from 'react'
import { summarizeDay } from '../api/enrich'

function coerceDate(v) {
  try {
    if (!v) return null
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d
  } catch { return null }
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

function pickCompletionDate(task) {
  // Prefer explicit completion timestamp fields (any casing / label)
  return (
    coerceDate(task?.completedTime) ||
    coerceDate(task?.CompletedTime) ||
    coerceDate(task?.['Completed Time']) ||
    null
  )
}

function wasCompletedToday(task, today = new Date()) {
  const doneStatus = String(task?.status || task?.Status || '').toLowerCase() === 'done'
  const d = pickCompletionDate(task)
  if (d) return isSameDay(d, today)
  // fallback: treat "Done" updated today as completed today if you lack a completion timestamp
  const upd = coerceDate(task?.updatedAt) || coerceDate(task?.LastModifiedTime)
  if (doneStatus && upd) return isSameDay(upd, today)
  return false
}

export default function DailySummary({ tasks = [], className = '' }) {
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState('')
  const [err, setErr] = useState('')

  const completedToday = useMemo(() => {
    const today = new Date()
    return tasks.filter(t => wasCompletedToday(t, today))
  }, [tasks])

  const payloadText = useMemo(() => {
    if (!completedToday.length) return ''
    // Build a compact prompt body: title + (optional) notes
    const lines = completedToday.map((t, i) => {
      const title = t.name || t['Task Name'] || `Task ${i+1}`
      const notes = (t.notes || t['Notes'] || '').toString().trim()
      const proj = t.project || t['Project'] || ''
      const prio = t.priority || t['Priority'] || ''
      const due = t.due || t['Due Date'] || ''
      const parts = [title]
      if (proj) parts.push(`[Project: ${proj}]`)
      if (prio) parts.push(`[${prio}]`)
      if (due) parts.push(`[Due: ${due}]`)
      if (notes) parts.push(`Notes: ${notes}`)
      return `- ${parts.join(' ')}`
    })
    return lines.join('\n')
  }, [completedToday])

  async function runSummary() {
    if (!payloadText) {
      setSummary('')
      setErr('')
      return
    }
    setLoading(true); setErr('')
    try {
      const result = await summarizeDay(payloadText)
      setSummary(result?.summary || result?.text || '')
    } catch (e) {
      setErr(e?.message || 'Failed to generate summary')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Auto-run on mount and whenever completedToday changes
    runSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadText])

  return (
    <div className={`card p-4 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="heading-sm">Daily Summary</div>
        <button
          onClick={runSummary}
          disabled={loading}
          className="rounded-md px-2 py-1 text-sm border border-slate-300 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {loading ? 'Summarizing…' : 'Refresh'}
        </button>
      </div>

      {!completedToday.length && (
        <div className="text-sm text-slate-500 dark:text-slate-400">
          No completions today yet. Knock something out and come back!
        </div>
      )}

      {!!completedToday.length && !loading && !err && !summary && (
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Summary will appear here once generated.
        </div>
      )}

      {err && (
        <div className="text-sm text-red-600 dark:text-red-400">
          {err}
        </div>
      )}

      {summary && (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          {summary.split('\n').map((line, idx) => (
            <p key={idx} className="mb-1">{line}</p>
          ))}
        </div>
      )}

      {!!completedToday.length && (
        <div className="mt-3 rounded-md bg-slate-50 p-2 text-[12px] text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:ring-slate-700">
          <div className="mb-1 font-medium">Completed Today ({completedToday.length}):</div>
          <ul className="list-disc ml-4">
            {completedToday.slice(0, 6).map((t, i) => (
              <li key={t.id || i}>{t.name || t['Task Name']}</li>
            ))}
            {completedToday.length > 6 && (
              <li>+{completedToday.length - 6} more…</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}


