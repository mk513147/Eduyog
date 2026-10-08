import { checkImageUrl } from './imageUrl'

export const STUDY_LEVELS = [
  ['school', 'School'],
  ['diploma', 'Diploma'],
  ['undergraduate', 'Undergraduate'],
  ['postgraduate', 'Postgraduate'],
  ['phd', 'PhD'],
  ['other', 'Other'],
]

export const ROLE_LABELS = { student: 'Student', trainer: 'Trainer', admin: 'Admin' }

export const BIO_MAX = 1000
export const PASSWORD_MIN = 8
export const PASSWORD_MAX_BYTES = 72

// Form values (strings) from a saved profile.
export function profileToForm(profile) {
  return {
    fullName: profile.fullName ?? '',
    phone: profile.phone ?? '',
    institution: profile.institution ?? '',
    studyLevel: profile.studyLevel ?? '',
    fieldOfStudy: profile.fieldOfStudy ?? '',
    graduationYear: profile.graduationYear == null ? '' : String(profile.graduationYear),
    bio: profile.bio ?? '',
    avatarUrl: profile.avatarUrl ?? '',
  }
}

// Request body from the form: empty optional fields are sent as null so they are cleared.
export function formToPayload(form) {
  const text = (value) => (value.trim() === '' ? null : value.trim())
  return {
    fullName: form.fullName.trim(),
    phone: text(form.phone),
    institution: text(form.institution),
    studyLevel: form.studyLevel === '' ? null : form.studyLevel,
    fieldOfStudy: text(form.fieldOfStudy),
    graduationYear: form.graduationYear.trim() === '' ? null : Number(form.graduationYear),
    bio: text(form.bio),
    avatarUrl: text(form.avatarUrl),
  }
}

// Mirrors the backend rules so most mistakes are caught before sending; the server decides.
export function validateProfileForm(form) {
  const errors = {}
  if (form.fullName.trim() === '') errors.fullName = 'Full name is required'
  else if (form.fullName.trim().length > 150) errors.fullName = 'Full name must be at most 150 characters'

  const phone = form.phone.trim()
  if (phone !== '') {
    const digits = phone.replace(/\D/g, '').length
    if (!/^\+?[\d\s().-]+$/.test(phone) || digits < 7 || digits > 15) errors.phone = 'Enter a valid phone number'
  }
  if (form.institution.trim().length > 200) errors.institution = 'Institution must be at most 200 characters'
  if (form.fieldOfStudy.trim().length > 150) errors.fieldOfStudy = 'Field of study must be at most 150 characters'

  const year = form.graduationYear.trim()
  if (year !== '' && !(/^\d{4}$/.test(year) && Number(year) >= 1950 && Number(year) <= 2100)) {
    errors.graduationYear = 'Enter a year between 1950 and 2100'
  }
  if (form.bio.trim().length > BIO_MAX) errors.bio = `Bio must be at most ${BIO_MAX} characters`

  const avatarProblem = checkImageUrl(form.avatarUrl)
  if (avatarProblem) errors.avatarUrl = avatarProblem
  return errors
}

export function validatePasswordForm({ currentPassword, newPassword, confirmPassword }) {
  const errors = {}
  if (currentPassword === '') errors.currentPassword = 'Enter your current password'
  if (newPassword === '') errors.newPassword = 'Enter a new password'
  else if (newPassword.length < PASSWORD_MIN) errors.newPassword = `Password must be at least ${PASSWORD_MIN} characters`
  else if (new TextEncoder().encode(newPassword).length > PASSWORD_MAX_BYTES) errors.newPassword = `Password must be at most ${PASSWORD_MAX_BYTES} bytes`
  else if (newPassword === currentPassword) errors.newPassword = 'New password must be different from the current password'
  if (confirmPassword !== newPassword) errors.confirmPassword = 'The passwords do not match'
  return errors
}
