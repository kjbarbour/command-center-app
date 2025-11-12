export default function TaskItem({ task, onToggle }) {
  const meta = buildMeta(task)
  const checked = (task.status || '').toLowerCase() === 'done'

  const dueBadge = computeDueBadge(task)
  const badgeClass =
    dueBadge === 'Overdue'
      ? 'bg-rose-100 text-rose-700 border border-rose-200'
      : dueBadge === 'Due Today'
      ? 'bg-amber-100 text-amber-800 border border-amber-200'
      : dueBadge === 'Due Soon'
      ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
      : null

  return (
    <div className="flex items-start gap-3 bg-gray-50 hover:bg-gray-100 border rounded-lg px-3 py-2">
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        onChange={(e) => onToggle?.(task, e.target.checked)}
      />
      <div className="min-w-0 flex-1">
        <div className={`truncate font-medium ${checked ? 'line-through text-gray-400' : ''}`}>
          {task.name}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {meta && <div className="text-xs text-gray-500">{meta}</div>}
          {dueBadge && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${badgeClass}`}>
              {dueBadge}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function buildMeta(t) {
  const bits = []
  if (t.priority) bits.push(t.priority.replace('P', 'P '))
  if (t.time) bits.push(`${t.time}m`)
  if (t.context) bits.push(t.context)
  if (t.due) bits.push(formatDue(t.due))
  return bits.join(' • ')
}

function formatDue(d) {
  try {
    const date = new Date(d)
    if (isNaN(date)) return null
    return `Due ${date.toLocaleDateString()}`
  } catch {
    return null
  }
}

function computeDueBadge(task) {
  if (!task || !task.due) return null
  // Do not badge completed tasks
  if ((task.status || '').toLowerCase() === 'done') return null

  const now = toMidnight(new Date())
  const due = toMidnight(parseDate(task.due))
  if (!due) return null

  const diffDays = Math.floor((due - now) / 86400000)

  if (diffDays < 0) return 'Overdue'
  if (diffDays === 0) return 'Due Today'
  if (diffDays <= 3) return 'Due Soon'
  return null
}

function parseDate(d) {
  if (d instanceof Date) return d
  if (typeof d === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    return new Date(d)
  }
  return null
}

function toMidnight(date) {
  if (!date || isNaN(date)) return null
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}