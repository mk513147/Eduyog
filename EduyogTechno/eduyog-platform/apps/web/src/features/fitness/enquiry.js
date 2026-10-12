// Fitness enquiry form logic that does not depend on React or Vite: field definitions, validation and
// the mapping of API outcomes to user-facing results. Unit tested in test/fitness.test.js.
// Adapted from apps/fitness/src/components/EnquiryForm.jsx; field names match the
// POST /api/fitness-leads request body and limits match the fitness_leads table. The backend
// validates again and is authoritative.

export const FIELDS = [
  { name: 'businessName', label: 'Business Name', type: 'text', autoComplete: 'organization', maxLength: 200, required: true },
  { name: 'contactName', label: 'Contact Person', type: 'text', autoComplete: 'name', maxLength: 150, required: true },
  { name: 'email', label: 'Work Email', type: 'email', autoComplete: 'email', maxLength: 254, required: true },
  { name: 'phone', label: 'Phone', type: 'tel', autoComplete: 'tel', maxLength: 30, required: false },
  { name: 'businessType', label: 'Business Type', type: 'text', maxLength: 100, required: true },
  { name: 'location', label: 'Location', type: 'text', maxLength: 200, required: true },
  { name: 'servicesOffered', label: 'Services Offered', type: 'textarea', maxLength: 2000, required: true, full: true },
  {
    name: 'marketingRequirements',
    label: 'Current Marketing Requirements',
    type: 'textarea',
    maxLength: 2000,
    required: true,
    full: true,
  },
  { name: 'websiteLinks', label: 'Website / Social Media Links', type: 'text', maxLength: 2000, required: false, full: true },
  { name: 'marketingObjectives', label: 'Marketing Objectives', type: 'textarea', maxLength: 2000, required: true, full: true },
  { name: 'message', label: 'Additional Requirements', type: 'textarea', maxLength: 5000, required: false, full: true },
]

export const EMPTY_VALUES = Object.fromEntries(FIELDS.map((field) => [field.name, '']))
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^\+?[\d\s().-]+$/

export const GENERIC_ERROR = 'Sorry, we could not send your enquiry. Please try again in a moment.'
export const FIELD_ERRORS_MESSAGE = 'Please check the highlighted fields and try again.'

export function notConfiguredMessage(contactEmail) {
  return `Enquiries cannot be sent from this site right now. Please email ${contactEmail} instead.`
}

export function validateField(field, rawValue) {
  const value = rawValue.trim()
  if (!value) return field.required ? `Please enter your ${field.label.toLowerCase()}.` : null
  if (value.length > field.maxLength) return `Please keep this under ${field.maxLength} characters.`
  if (field.type === 'email' && !EMAIL_PATTERN.test(value)) return 'Please enter a valid email address.'
  if (field.type === 'tel') {
    const digits = value.replace(/\D/g, '').length
    if (!PHONE_PATTERN.test(value) || digits < 7 || digits > 15) return 'Please enter a valid phone number.'
  }
  return null
}

export function validate(values) {
  return Object.fromEntries(
    FIELDS.map((field) => [field.name, validateField(field, values[field.name])]).filter(([, error]) => error),
  )
}

/**
 * Sends the enquiry. `post` is the API client's post(path, body); `contactEmail` is shown when the
 * API is not configured. Resolves when the backend accepted the enquiry (a 2xx response). Otherwise
 * rejects with an Error whose message is safe to show, plus `details` (backend field errors, 400 only).
 * Never reports success for a failed request, and sends nothing when the API is not configured.
 */
export async function submitEnquiry(values, { post, contactEmail }) {
  try {
    await post('/fitness-leads', values)
  } catch (error) {
    const failure = new Error(GENERIC_ERROR)
    failure.details = null
    if (error?.kind === 'not-configured') {
      failure.message = notConfiguredMessage(contactEmail)
    } else if (error?.kind === 'http') {
      // Same semantics as the original app: field errors only for 400, the server's own message
      // only for 429 (rate limit), a generic message otherwise.
      const details = error.status === 400 ? error.details : null
      if (details) {
        failure.message = FIELD_ERRORS_MESSAGE
        failure.details = details
      } else if (error.status === 429) {
        failure.message = error.serverMessage || GENERIC_ERROR
      }
    }
    throw failure
  }
}
