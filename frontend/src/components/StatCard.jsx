import clsx from 'clsx'

export default function StatCard({ label, value, sub, variant }) {
  return (
    <div
      className={clsx(
        'rounded-xl p-4 bg-white shadow-soft border',
        variant === 'warn' && 'border-amber-300 bg-amber-50'
      )}
    >
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold leading-tight">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  )
}