// frontend/src/components/MetricBar.jsx
import Tooltip from './ui/Tooltip'
import { formatValue } from '../utils/formatValue'

function isNumeric(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function Metric({ label, value }) {
  const isNum = isNumeric(value);
  const display = isNum ? formatValue(value, 'count') : String(value);
  const tooltipText = isNum ? `${label}: ${display}` : `${label}: ${value}`;

  return (
    <Tooltip label={tooltipText}>
      <div className="card px-4 py-3 card-hover cursor-default">
        <div className="text-xs text-muted">{label}</div>
        <div className="mt-1 text-xl font-semibold">{display}</div>
      </div>
    </Tooltip>
  )
}

export default function MetricBar({ metrics = [] }) {
  return (
    <div className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/90 border-b border-stem-light dark:bg-slate-900/80 dark:border-slate-800">
      <div className="container-narrow py-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {metrics.map((m) => (
          <Metric key={m.label} label={m.label} value={m.value} />
        ))}
      </div>
    </div>
  )
}