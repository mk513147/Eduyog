export const ROLES = ['student', 'trainer', 'admin']

export const ROLE_LABELS = { student: 'Student', trainer: 'Trainer', admin: 'Admin' }

// Eduyarp

export const COURSE_LEVELS = ['beginner', 'intermediate', 'advanced']

export const LEVEL_LABELS = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' }

export const COURSE_STATUS_LABELS = { draft: 'Draft', published: 'Published', archived: 'Archived' }

export const CLASS_STATUSES = ['scheduled', 'completed', 'cancelled']

export const CLASS_STATUS_LABELS = { scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled' }

// Course fees are stored in INR.
const feeFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

export function formatFee(fee) {
  return Number(fee) === 0 ? 'Free' : feeFormatter.format(fee)
}

export const ASSIGNMENT_STATUS_LABELS = { draft: 'Draft', published: 'Open', closed: 'Closed' }

export const RESOURCE_TYPES = [
  ['video', 'Video'],
  ['pdf', 'PDF'],
  ['document', 'Document'],
  ['presentation', 'Presentation'],
  ['external', 'External link'],
]

export const RESOURCE_TYPE_LABELS = Object.fromEntries(RESOURCE_TYPES)

export const STUDY_LEVELS = [
  ['school', 'School'],
  ['diploma', 'Diploma'],
  ['undergraduate', 'Undergraduate'],
  ['postgraduate', 'Postgraduate'],
  ['phd', 'PhD'],
  ['other', 'Other'],
]
