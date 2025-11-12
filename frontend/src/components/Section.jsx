// src/components/Section.jsx
import { useMemo, useState } from 'react'
import SubtasksBlock from './SubtasksBlock'
import { fmtTime, isSameDayCST } from '../utils/timefmt'
import { updateTask } from '../api/airtable'

export default function Section({
  title,
  items = [],
  loading = false,
  collapsed = false,
  onToggleCollapse,
  onTaskClick,
  onAdd,
  onComplete,
  onMoveToToday, // optional handler (only used in Scheduled)
  dense = false,
  maxItems = 50,
}) {
  const shown = items.slice(0, maxItems)

  const get = (t, key, fallback = '') =>
    t?.[key] ?? t?.fields?.[mapKey(key)] ?? fallback

  function mapKey(k) {
    const m = {
      name: 'Task Name',
      status: 'Status',
      priority: 'Priority',
      context: 'Context',
      energy: 'Energy Level',
      due: 'Due Date',
    }
    return m[k] || k
  }

  const isScheduled = (t) => String(get(t, 'status', 'Inbox')).toLowerCase() === 'scheduled'

  // Bulk move-to-today (Scheduled-only)
  const isScheduledSection = String(title || '').toLowerCase() === 'scheduled'
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [locallyMovedIds, setLocallyMovedIds] = useState(() => new Set())
  const [bulkErr, setBulkErr] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)

  const visibleItems = useMemo(
    () => shown.filter((t) => !locallyMovedIds.has(t.id)),
    [shown, locallyMovedIds]
  )
  const visibleIds = useMemo(() => visibleItems.map((t) => t.id), [visibleItems])
  const visibleCount = visibleItems.length
  const selectedVisibleCount = useMemo(
    () => visibleItems.reduce((acc, t) => acc + (selectedIds.has(t.id) ? 1 : 0), 0),
    [visibleItems, selectedIds]
  )
  const allSelected = visibleCount > 0 && selectedVisibleCount === visibleCount
  const anySelected = selectedVisibleCount > 0

  function toggleSelectOne(id, checked) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleSelectAll(checked) {
    setSelectedIds((prev) => {
      if (!checked) {
        // Clear only those visible
        const next = new Set(prev)
        for (const id of visibleIds) next.delete(id)
        return next
      }
      const next = new Set(prev)
      for (const id of visibleIds) next.add(id)
      return next
    })
  }

  async function handleBulkMoveToToday() {
    if (!anySelected || bulkBusy) return
    setBulkBusy(true)
    setBulkErr('')
    let failures = 0
    // Process sequentially to optimistically update after each success
    for (const id of Array.from(selectedIds)) {
      if (!visibleIds.includes(id)) continue
      try {
        await updateTask(id, { 'Status': 'Today', 'Scheduled Start': null, 'Scheduled End': null })
        // Optimistically remove from local Scheduled view
        setLocallyMovedIds((prev) => {
          const next = new Set(prev); next.add(id); return next
        })
        // Also unselect it
        setSelectedIds((prev) => {
          const next = new Set(prev); next.delete(id); return next
        })
      } catch (e) {
        failures++
      }
    }
    if (failures > 0) {
      setBulkErr(`Failed to move ${failures} task${failures > 1 ? 's' : ''}. Others succeeded.`)
    }
    setBulkBusy(false)
  }

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="heading-sm">
          {title} <span className="opacity-50 text-sm">({items.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {onToggleCollapse && (
            <button className="px-2 py-1 rounded-lg border text-sm" onClick={onToggleCollapse}>
              {collapsed ? 'Expand' : 'Collapse'}
            </button>
          )}
          {onAdd && (
            <button className="px-2 py-1 rounded-lg border text-sm" onClick={() => onAdd(title)}>
              + Add
            </button>
          )}
        </div>
      </div>

      {isScheduledSection && (
        <div className="mb-3">
          {bulkErr && (
            <div className="mb-2 text-xs text-[color:var(--stem-orange)]">
              {bulkErr}
            </div>
          )}
          <div className="inline-flex items-center gap-3 rounded-full border px-3 py-1 text-xs bg-white dark:bg-neutral-900">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded border-stem-blue text-stem-blue focus:ring-[color:var(--stem-blue)]"
                checked={allSelected}
                onChange={(e) => toggleSelectAll(e.target.checked)}
                aria-label={`Select all (${visibleCount})`}
              />
              <span className="opacity-80">Select all ({visibleCount})</span>
            </label>
            <button
              className="px-2 py-1 rounded-md border text-xs disabled:opacity-50"
              disabled={!anySelected || bulkBusy}
              onClick={handleBulkMoveToToday}
              aria-label="Move selected scheduled tasks to Today"
              title="Move selected to Today"
            >
              Move selected to Today
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm opacity-70">Loading…</div>
      ) : collapsed ? (
        <div className="text-sm opacity-70">Collapsed.</div>
      ) : shown.length === 0 ? (
        <div className="text-sm opacity-70">No tasks.</div>
      ) : (
        <ul className="space-y-2">
          {visibleItems.map((t) => (
            <li
              key={t.id}
              className="rounded-xl border px-3 py-2 bg-white dark:bg-neutral-900 hover:shadow-sm transition cursor-pointer"
              onClick={(e) => {
                if ((e.target).closest && (e.target).closest('button')) return
                onTaskClick?.(t)
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  {isScheduledSection && isScheduled(t) && (
                    <label className="inline-flex items-center gap-2 mr-2 align-top">
                      <input
                        type="checkbox"
                        className="rounded border-stem-blue text-stem-blue focus:ring-[color:var(--stem-blue)]"
                        checked={selectedIds.has(t.id)}
                        onChange={(e) => {
                          e.stopPropagation()
                          toggleSelectOne(t.id, e.target.checked)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${get(t, 'name', t.fields?.['Task Name'] || 'task')}`}
                      />
                    </label>
                  )}
                  <div className="font-medium truncate">
                    {get(t, 'name', t.fields?.['Task Name'] || '(untitled)')}
                  </div>
                  <div className="text-xs opacity-70 flex flex-wrap gap-2">
                    {get(t, 'priority', '') && <span>{get(t, 'priority', '')}</span>}
                    {get(t, 'priority', '') && <span>•</span>}
                    {get(t, 'context', '') && <span>{get(t, 'context', '')}</span>}
                    {get(t, 'status', '') && (
                      <>
                        <span>•</span>
                        <span>{get(t, 'status', '')}</span>
                      </>
                    )}
                    {(() => {
                      const status = String(get(t, 'status', '')).toLowerCase()
                      if (status === 'done') return null
                      const section = String(title || '').toLowerCase()
                      const startISO = t?.fields?.['Scheduled Start'] || t?.['Scheduled Start'] || null
                      const endISO = t?.fields?.['Scheduled End'] || t?.['Scheduled End'] || null
                      const hasStart = !!startISO
                      const hasEnd = !!endISO
                      if (!hasStart && !hasEnd) return null

                      const inScheduledCol = section === 'scheduled' && (hasStart || hasEnd)
                      const inTodayCol = section === 'today' && hasStart && isSameDayCST(startISO, new Date())
                      if (!(inScheduledCol || inTodayCol)) return null

                      const startLabel = hasStart ? fmtTime(new Date(startISO)) : null
                      const endLabel = hasEnd ? fmtTime(new Date(endISO)) : null
                      const label = hasStart && hasEnd
                        ? `Scheduled ${startLabel}–${endLabel}`
                        : hasStart
                        ? `Scheduled ${startLabel}`
                        : `Scheduled until ${endLabel}`
                      return (
                        <span className="inline-flex items-center rounded-md bg-slate-50 px-1.5 py-0.5 text-slate-600 ring-1 ring-slate-200 dark:bg-neutral-900/40 dark:text-slate-300 dark:ring-slate-700">
                          {label}
                        </span>
                      )
                    })()}
                  </div>

                  {/* Progressive Subtasks (compact) */}
                  {(t.fields?.Subtasks && t.fields.Subtasks.length > 0) ? (
                    <div className="mt-2">
                      <SubtasksBlock parent={t} compact={true} />
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isScheduled(t) && onMoveToToday && (
                    <button
                      className="px-2 py-1 rounded-md border text-xs"
                      onClick={() => onMoveToToday(t)}
                      title="Move to Today"
                      aria-label="Move this scheduled task to Today"
                    >
                      ⇢ Today
                    </button>
                  )}
                  {onComplete && (
                    <button
                      className="px-2 py-1 rounded-md border text-xs"
                      onClick={() => onComplete(t)}
                      title="Mark Done"
                    >
                      ✓ Done
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}