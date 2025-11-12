// Zero-dependency time helpers for America/Chicago (CST/CDT)
const TZ = 'America/Chicago'

function toDate(input) {
  if (!input) return null
  if (input instanceof Date) return new Date(input.getTime())
  if (typeof input === 'string') {
    const d = new Date(input)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

export function toCST(d) {
  // Returns a Date representing the same instant in time; use fmtTime/isSameDayCST for CST interpretation.
  return toDate(d)
}

export function fmtTime(date) {
  const d = toDate(date)
  if (!d) return ''
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: TZ,
  }).formatToParts(d)

  let hour = ''
  let minute = ''
  let dayPeriod = ''
  for (const p of parts) {
    if (p.type === 'hour') hour = p.value
    else if (p.type === 'minute') minute = p.value
    else if (p.type === 'dayPeriod') dayPeriod = p.value.toLowerCase()
  }
  // Build "h:mma" (e.g., "1:30pm")
  return `${hour}:${minute}${dayPeriod}`
}

function ymdInChicago(dateLike) {
  const d = toDate(dateLike)
  if (!d) return null
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  let y = '', m = '', d2 = ''
  for (const p of parts) {
    if (p.type === 'year') y = p.value
    else if (p.type === 'month') m = p.value
    else if (p.type === 'day') d2 = p.value
  }
  return `${y}-${m}-${d2}`
}

export function isSameDayCST(aISO, bDateLocal) {
  const aYmd = ymdInChicago(aISO)
  const bYmd = ymdInChicago(bDateLocal)
  if (!aYmd || !bYmd) return false
  return aYmd === bYmd
}


