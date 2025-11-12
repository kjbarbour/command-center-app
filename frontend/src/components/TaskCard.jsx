import React, { useMemo } from 'react'
import clsx from 'clsx'
import Tooltip from './ui/Tooltip'
import { formatValue } from '../utils/formatValue'
import Progress from './ui/Progress'

function priorityClasses(priority) {
  switch (priority) {
    case 'P1-Critical':
      return 'bg-red-100 text-red-700 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800/60'
    case 'P2-High':
      return 'bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800/60'
    case 'P3-Medium':
      return 'bg-yellow-100 text-yellow-700 ring-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:ring-yellow-800/60'
    case 'P4-Low':
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:ring-slate-700/70'
  }
}

function energyDotClasses(level) {
  switch (level) {
    case 'High':
      return 'bg-emerald-500'
    case 'Medium':
      return 'bg-blue-500'
    case 'Low':
    default:
      return 'bg-slate-400'
  }
}

function formatDue(due) {
  if (!due) return null
  try {
    const d = new Date(due)
    if (Number.isNaN(d.getTime())) return null
    const today = new Date()
    const sameYear = d.getFullYear() === today.getFullYear()
    const opts = sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }
    return d.toLocaleDateString(undefined, opts)
  } catch {
    return null
  }
}

function minutesToLabel(min) {
  if (!min && min !== 0) return null
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function getNumber(val) {
  const n = Number(val)
  return Number.isFinite(n) ? n : 0
}

export default function TaskCard({
  task,
  onToggleComplete,
  onOpenDetails,
  dense = true,
  clickable = true,
}) {
  const {
    id,
    name,
    priority,
    energyLevel,
    timeEstimate,
    dueDate,
    project,
  } = task || {}

  // ----- Subtasks (support camelCase or Airtable-field names) -----
  // Prefer camelCase if present; fall back to Airtable field labels.
  const subtaskCount =
    task?.subtaskCount ??
    task?.subtasksCount ??
    task?.['Subtask Count'] ??
    0

  const subtasksCompleted =
    task?.subtasksCompleted ??
    task?.['Subtasks Completed'] ??
    0

  // If an explicit progress percentage exists, use it; else compute from completed/total.
  const rawProgress =
    task?.subtasksProgress ??
    task?.['Subtasks Progress']

  const total = getNumber(subtaskCount)
  const completed = Math.min(getNumber(subtasksCompleted), total)
  const computedPct = total > 0 ? Math.round((completed / total) * 100) : null
  const pct = Number.isFinite(Number(rawProgress))
    ? Math.max(0, Math.min(100, Number(rawProgress)))
    : (computedPct ?? 0)

  const showSubtasks = total > 0

  // ----- Computed labels -----
  const dueLabel = useMemo(() => formatDue(dueDate), [dueDate])
  const estLabel = useMemo(() => minutesToLabel(timeEstimate), [timeEstimate])
  const subtaskA11yLabel = showSubtasks
    ? `Subtasks ${completed} of ${total} complete (${pct}%)`
    : undefined

  return (
    <div
      className={clsx(
        'group relative w-full rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900',
        'hover:shadow-md hover:ring-1 hover:ring-slate-300/60 dark:hover:ring-slate-600/60',
        clickable && 'cursor-pointer'
      )}
      onClick={() => clickable && onOpenDetails && onOpenDetails(task)}
      data-task-id={id}
      role={clickable ? 'button' : 'article'}
      tabIndex={0}
    >
      {/* top row: checkbox + title + priority + kebab */}
      <div className={clsx('flex items-start gap-2', dense ? 'mb-1' : 'mb-2')}>
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-700"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onToggleComplete && onToggleComplete(id, e.target.checked)}
          aria-label="Mark complete"
        />
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            {/* Title */}
            <h3
              className={clsx(
                'text-sm font-medium text-slate-900 dark:text-slate-100',
                dense ? 'leading-snug' : 'leading-normal'
              )}
              title={name}
            >
              <span className="line-clamp-2">{name || 'Untitled task'}</span>
            </h3>
            {/* Priority badge with tooltip */}
            <Tooltip label={`Priority: ${priority || 'P4-Low'}`}>
              <span
                className={clsx(
                  'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1',
                  priorityClasses(priority)
                )}
              >
                {priority || 'P4-Low'}
              </span>
            </Tooltip>
          </div>

          {/* meta row chips */}
          <div className={clsx(
            'mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300'
          )}>
            {energyLevel && (
              <Tooltip label={`Energy: ${energyLevel}`}>
                <span className="inline-flex items-center gap-1">
                  <span className={clsx('h-2 w-2 rounded-full', energyDotClasses(energyLevel))} />
                  <span className="opacity-80">{energyLevel}</span>
                </span>
              </Tooltip>
            )}
            {estLabel && (
              <Tooltip label={`Estimate: ${estLabel}`}>
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {estLabel}
                </span>
              </Tooltip>
            )}
            {dueLabel && (
              <Tooltip label={`Due ${formatValue(dueDate, 'date')}`}>
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  Due {dueLabel}
                </span>
              </Tooltip>
            )}
            {project && (
              <Tooltip label={`Project: ${project}`}>
                <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900/40 dark:text-slate-300/90 dark:ring-slate-700">
                  {project}
                </span>
              </Tooltip>
            )}
          </div>

          {/* subtask progress block (only if the task actually has subtasks) */}
          {showSubtasks && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                <span>Subtasks</span>
                <span aria-hidden="true">
                  {completed} / {total} ({pct}%)
                </span>
              </div>
              <Tooltip label={subtaskA11yLabel}>
                <div onClick={(e) => e.stopPropagation()}>
                  <Progress value={pct} label={subtaskA11yLabel} />
                </div>
              </Tooltip>
            </div>
          )}
        </div>

        {/* kebab */}
        <button
          className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:hover:bg-slate-800"
          onClick={(e) => {
            e.stopPropagation()
            onOpenDetails && onOpenDetails(task)
          }}
          aria-label="Open task menu"
        >
          ⋯
        </button>
      </div>
    </div>
  )
}