export function formatValue(value, type = 'default') {
    if (value == null || value === '') return '—'
    switch (type) {
      case 'count':
        return Number(value).toLocaleString()
      case 'date': {
        const d = new Date(value)
        if (Number.isNaN(d.getTime())) return '—'
        return d.toLocaleDateString()
      }
      case 'timeMin':
        return `${value} min`
      default:
        return String(value)
    }
  }