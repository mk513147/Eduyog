import { CLASS_STATUS_LABELS, COURSE_STATUS_LABELS, ROLE_LABELS } from '../utils/labels'

export function StatusBadge({ active }) {
  return (
    <span className={`badge ${active ? 'badge--success' : 'badge--muted'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

const ROLE_TONES = { admin: 'badge--primary', trainer: 'badge--success', student: 'badge--neutral' }

export function RoleBadge({ role }) {
  return (
    <span className={`badge ${ROLE_TONES[role] ?? 'badge--neutral'}`}>{ROLE_LABELS[role] ?? role}</span>
  )
}

// Eduyarp

const COURSE_STATUS_TONES = {
  draft: 'badge--neutral',
  published: 'badge--success',
  archived: 'badge--muted',
}

export function CourseStatusBadge({ status }) {
  return (
    <span className={`badge ${COURSE_STATUS_TONES[status] ?? 'badge--neutral'}`}>
      {COURSE_STATUS_LABELS[status] ?? status}
    </span>
  )
}

const CLASS_STATUS_TONES = {
  scheduled: 'badge--primary',
  completed: 'badge--muted',
  cancelled: 'badge--danger',
}

export function ClassStatusBadge({ status }) {
  return (
    <span className={`badge ${CLASS_STATUS_TONES[status] ?? 'badge--neutral'}`}>
      {CLASS_STATUS_LABELS[status] ?? status}
    </span>
  )
}

const ENROLMENT_STATUS = {
  active: { label: 'Active', tone: 'badge--primary' },
  completed: { label: 'Completed', tone: 'badge--success' },
  cancelled: { label: 'Cancelled', tone: 'badge--danger' },
}

export function EnrolmentStatusBadge({ status }) {
  const { label, tone } = ENROLMENT_STATUS[status] ?? { label: status, tone: 'badge--neutral' }
  return <span className={`badge ${tone}`}>{label}</span>
}
