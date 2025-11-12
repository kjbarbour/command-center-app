import { useState } from 'react'

export default function Tooltip({ label, children, position = 'top' }) {
  const [visible, setVisible] = useState(false)

  const positionClasses = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
  }

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className={`absolute z-50 ${positionClasses[position]} whitespace-nowrap rounded-md bg-slate-900/90 px-2 py-1 text-xs text-white shadow-lg transition-opacity duration-150 dark:bg-slate-700`}
        >
          {label}
        </div>
      )}
    </div>
  )
}