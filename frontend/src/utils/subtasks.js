// src/utils/subtasks.js
export function orderSubtasks(children) {
    const arr = Array.isArray(children) ? [...children] : []
    // Normalize created time for sort fallback
    const safeCreated = (r) =>
      r?.fields?.['Created Time'] ? new Date(r.fields['Created Time']).getTime() : 0
    arr.sort((a, b) => {
      const sa = Number(a?.fields?.Sequence ?? Infinity)
      const sb = Number(b?.fields?.Sequence ?? Infinity)
      if (sa !== sb) return sa - sb
      const ca = safeCreated(a)
      const cb = safeCreated(b)
      if (ca !== cb) return ca - cb
      // final stable-ish tie-breaker
      return String(a?.id || '').localeCompare(String(b?.id || ''))
    })
    const next = arr.find((r) => (r?.fields?.Status || 'Inbox') !== 'Done') || null
    const rest = arr.filter((r) => r !== next)
    return { next, rest }
  }
  
  // Recompute after a completion
  export function promoteNextOnComplete(children, completedId) {
    const updated = (children || []).map((c) =>
      c?.id === completedId ? { ...c, fields: { ...c.fields, Status: 'Done' } } : c
    )
    return orderSubtasks(updated)
  }