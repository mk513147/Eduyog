export const ASSIGNMENT_STATUS_LABELS = { draft: 'Draft', published: 'Open', closed: 'Closed' }

// ISO instant -> "YYYY-MM-DDTHH:mm" in the browser's time zone, for <input type="datetime-local">.
export function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// The reverse: a local date-time to an ISO instant (UTC). Empty means no due date.
export function fromLocalInput(value) {
  return value ? new Date(value).toISOString() : null
}

// What a student's own row says, derived from their latest submission.
export function submissionState(assignment) {
  const latest = assignment.latestSubmission
  if (!latest) return { key: 'none', label: 'Not submitted' }
  if (latest.isLate) return { key: 'late', label: 'Submitted late' }
  return { key: 'submitted', label: 'Submitted' }
}
