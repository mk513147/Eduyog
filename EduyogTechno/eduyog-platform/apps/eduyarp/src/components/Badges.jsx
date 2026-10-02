import { LEVEL_LABELS } from '../utils/format'

export function LevelBadge({ level }) {
  return <span className={`badge badge--level-${level}`}>{LEVEL_LABELS[level] ?? level}</span>
}

const COURSE_STATUS = {
  published: { label: 'Open for enrolment', tone: 'success' },
  draft: { label: 'Draft', tone: 'muted' },
  archived: { label: 'Archived', tone: 'muted' },
}

export function CourseStatusBadge({ status }) {
  const { label, tone } = COURSE_STATUS[status] ?? { label: status, tone: 'muted' }
  return <span className={`badge badge--${tone}`}>{label}</span>
}

export function EnrolmentStatusBadge({ status }) {
  return status === 'completed' ? (
    <span className="badge badge--success">Completed</span>
  ) : (
    <span className="badge badge--primary">In progress</span>
  )
}

const CLASS_STATUS = {
  scheduled: { label: 'Scheduled', tone: 'primary' },
  completed: { label: 'Completed', tone: 'muted' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
}

export function ClassStatusBadge({ status }) {
  const { label, tone } = CLASS_STATUS[status] ?? { label: status, tone: 'muted' }
  return <span className={`badge badge--${tone}`}>{label}</span>
}
