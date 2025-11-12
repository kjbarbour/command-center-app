import React from 'react'
import clsx from 'clsx'

export default function Progress({ value = 0, label, className = '' }) {
  // clamp to [0, 100]
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))

  return (
    <div
      className={clsx('w-full', className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || 'Progress'}
    >
      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-out dark:bg-emerald-400"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

