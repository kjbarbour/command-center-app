// src/components/SubtasksBlock.jsx
import { useEffect, useMemo, useState } from 'react'
import { updateTask, fetchTasksByIds } from '../api/airtable'
import { orderSubtasks, promoteNextOnComplete } from '../utils/subtasks'

/**
 * Props:
 * - parent: Airtable record (must have id, fields.Subtasks (ids or objects))
 * - compact: boolean (cards = true, modal = false)
 * - onChanged?: () => void  (ask parent to refresh, optional)
 */
export default function SubtasksBlock({ parent, compact = false, onChanged }) {
  const pid = parent?.id
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [children, setChildren] = useState([])
  const [expanded, setExpanded] = useState(false)

  // Persist expand per parent
  useEffect(() => {
    if (!pid) return
    const k = `cc.subtasks.expanded.${pid}`
    const v = localStorage.getItem(k)
    setExpanded(v === '1')
  }, [pid])
  useEffect(() => {
    if (!pid) return
    const k = `cc.subtasks.expanded.${pid}`
    localStorage.setItem(k, expanded ? '1' : '0')
  }, [expanded, pid])

  // Fetch children by IDs if needed
  useEffect(() => {
    let mounted = true
    async function run() {
      setErr(''); setLoading(true)
      try {
        let subs = parent?.fields?.Subtasks
        if (!Array.isArray(subs) || subs.length === 0) {
          setChildren([]); return
        }
        // If array is already records (has .fields), use as-is
        const isRecords = subs.some((x) => x && x.fields)
        if (isRecords) {
          setChildren(subs)
        } else {
          // Assume IDs
          const ids = subs.map((x) => (typeof x === 'string' ? x : x?.id)).filter(Boolean)
          const recs = await fetchTasksByIds(ids)
          if (mounted) setChildren(recs)
        }
      } catch (e) {
        if (mounted) setErr(String(e?.message || e))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    run()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid, JSON.stringify(parent?.fields?.Subtasks || [])])

  const { next, rest } = useMemo(() => orderSubtasks(children), [children])
  const pendingCount = useMemo(
    () => children.filter((c) => (c?.fields?.Status || 'Inbox') !== 'Done').length,
    [children]
  )

  async function markNextDone() {
    if (!next) return
    try {
      const todayStr = new Date().toISOString().slice(0, 10)
      await updateTask(next.id, { 'Status': 'Done', 'Completed Time': todayStr })
      setChildren((prev) => {
        const { next: n2, rest: r2 } = promoteNextOnComplete(prev, next.id)
        // Rebuild children list preserving completed order
        const completed = prev.filter((x) => x.id === next.id)
        return n2 ? [n2, ...r2] : [...r2, ...completed]
      })
      onChanged?.()
    } catch (e) {
      setErr(String(e?.message || e))
    }
  }

  if (loading) {
    return (
      <div className={compact ? "text-xs opacity-60" : "text-sm opacity-70"}>
        Loading subtasks…
      </div>
    )
  }

  if (!children.length) {
    return <div className={compact ? "text-xs opacity-60" : "text-sm opacity-70"}>No subtasks.</div>
  }

  const restCount = rest.filter(r => (r?.fields?.Status || 'Inbox') !== 'Done').length

  return (
    <div className={compact ? "mt-1" : "mt-2"}>
      {/* next subtask only */}
      {next ? (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="rounded"
            checked={(next.fields?.Status || 'Inbox') === 'Done'}
            onChange={markNextDone}
          />
          <span className={compact ? "text-xs" : "text-sm"}>
            {next.fields?.['Task Name'] || '(untitled subtask)'}
          </span>
        </label>
      ) : (
        <div className={compact ? "text-xs opacity-60" : "text-sm opacity-70"}>All subtasks complete.</div>
      )}

      {/* chevron to reveal rest */}
      {rest.length > 0 && (
        <button
          className="mt-1 text-xs opacity-70 hover:opacity-100 underline"
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? 'Hide upcoming' : `View upcoming (${restCount})`}
        </button>
      )}

      {expanded && rest.length > 0 && (
        <ul className="mt-1 ml-4 space-y-1">
          {rest.map((r) => (
            <li key={r.id} className="text-xs opacity-80">
              {r.fields?.['Task Name']}{' '}
              {(r.fields?.Status || 'Inbox') === 'Done' ? <span className="opacity-50">(Done)</span> : null}
            </li>
          ))}
        </ul>
      )}

      {err ? <div className="text-xs text-red-600 mt-1">{err}</div> : null}
    </div>
  )
}