import { useEffect } from 'react'

// Minimal placeholder hook to keep API stable and lint clean.
// Accepts options but performs no scheduling logic yet.
export function useAutoSchedule({ tasks = [], onAfterRun = () => {}, cooldownMs = 60_000 } = {}) {
  useEffect(() => {
    // Intentionally no-op for now.
    // This preserves the public API and keeps dependencies tracked correctly.
    return undefined
  }, [tasks, onAfterRun, cooldownMs])
}