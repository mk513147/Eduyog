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
