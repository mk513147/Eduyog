// Course fees are stored in INR.
const feeFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
const shortDateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

export function formatFee(fee) {
  return Number(fee) === 0 ? 'Free' : feeFormatter.format(fee)
}

export function formatDate(value) {
  return value ? dateFormatter.format(new Date(value)) : '—'
}

export function formatShortDate(value) {
  return value ? shortDateFormatter.format(new Date(value)) : '—'
}

export function formatTime(value) {
  return value ? timeFormatter.format(new Date(value)) : '—'
}

export const LEVEL_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

// Learning objectives are stored one per line.
export function splitLines(text) {
  return (text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

// "5 minutes ago", "yesterday"; older than a week falls back to the date.
export function formatRelative(value) {
  if (!value) return ''
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 45) return 'just now'
  if (abs < 3600) return relativeFormatter.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return relativeFormatter.format(Math.round(seconds / 3600), 'hour')
  if (abs < 7 * 86400) return relativeFormatter.format(Math.round(seconds / 86400), 'day')
  return shortDateFormatter.format(new Date(value))
}

export function formatDateTime(value) {
  return value ? `${shortDateFormatter.format(new Date(value))}, ${timeFormatter.format(new Date(value))}` : '—'
}

const longDateFormatter = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' })

export function formatLongDate(value) {
  return value ? longDateFormatter.format(new Date(value)) : '—'
}
