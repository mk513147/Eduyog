import { useRef, useState } from 'react'
import { API_URL } from '../config'
import { Icon } from './Icon'

// Field names match the POST /api/fitness-leads request body and limits match
// the fitness_leads table. The backend validates again and is authoritative.
const FIELDS = [
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

const EMPTY_VALUES = Object.fromEntries(FIELDS.map((field) => [field.name, '']))
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^\+?[\d\s().-]+$/
const GENERIC_ERROR = 'Sorry, we could not send your enquiry. Please try again in a moment.'

function validateField(field, rawValue) {
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

function validate(values) {
  return Object.fromEntries(
    FIELDS.map((field) => [field.name, validateField(field, values[field.name])]).filter(([, error]) => error),
  )
}

// Resolves on 201. Rejects with an Error whose message is safe to show, plus
// field errors from the backend's { error: { message, details } } format.
async function submitLead(values) {
  if (!API_URL) throw new Error(GENERIC_ERROR)

  let response
  try {
    response = await fetch(`${API_URL}/api/fitness-leads`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
  } catch {
    throw new Error(GENERIC_ERROR)
  }
  if (response.ok) return

  let data = null
  try {
    data = await response.json()
  } catch {
    // Non-JSON body; use the generic message.
  }
  const details = response.status === 400 ? data?.error?.details : null
  let message = GENERIC_ERROR
  if (details) message = 'Please check the highlighted fields and try again.'
  else if (response.status === 429) message = data?.error?.message || GENERIC_ERROR

  const error = new Error(message)
  error.details = details
  throw error
}

export function EnquiryForm() {
  const formRef = useRef(null)
  const submittingRef = useRef(false)
  const [values, setValues] = useState(EMPTY_VALUES)
  const [errors, setErrors] = useState({})
  // idle | submitting | success | error
  const [status, setStatus] = useState('idle')
  const [submitError, setSubmitError] = useState('')

  function handleChange(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    if (status === 'success' || status === 'error') setStatus('idle')
    if (errors[name]) {
      const field = FIELDS.find((item) => item.name === name)
      setErrors((current) => {
        const next = { ...current }
        const error = validateField(field, value)
        if (error) next[name] = error
        else delete next[name]
        return next
      })
    }
  }

  function focusFirstInvalid(fieldErrors) {
    const firstInvalid = FIELDS.find((field) => fieldErrors[field.name])
    if (firstInvalid) formRef.current.elements[firstInvalid.name].focus()
    return Boolean(firstInvalid)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submittingRef.current) return

    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (focusFirstInvalid(nextErrors)) {
      setStatus('idle')
      return
    }

    submittingRef.current = true
    setStatus('submitting')
    try {
      await submitLead(values)
      setValues(EMPTY_VALUES)
      setErrors({})
      setStatus('success')
    } catch (error) {
      // Keep the entered values; show backend field errors next to the fields.
      const fieldErrors = Object.fromEntries(
        Object.entries(error.details || {}).filter(([name]) => name in EMPTY_VALUES),
      )
      setErrors(fieldErrors)
      focusFirstInvalid(fieldErrors)
      setSubmitError(error.message)
      setStatus('error')
    } finally {
      submittingRef.current = false
    }
  }

  const submitting = status === 'submitting'

  return (
    <form className="form" ref={formRef} onSubmit={handleSubmit} noValidate aria-busy={submitting}>
      <div className="form__grid">
        {FIELDS.map((field) => {
          const id = `enquiry-${field.name}`
          const errorId = `${id}-error`
          const error = errors[field.name]
          const controlProps = {
            id,
            name: field.name,
            value: values[field.name],
            onChange: handleChange,
            maxLength: field.maxLength,
            autoComplete: field.autoComplete,
            required: field.required,
            'aria-invalid': error ? true : undefined,
            'aria-describedby': error ? errorId : undefined,
            className: 'input',
          }

          return (
            <div className={`field${field.full ? ' field--full' : ''}`} key={field.name}>
              <label className="field__label" htmlFor={id}>
                {field.label}
                {!field.required && <span className="field__optional"> (optional)</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea rows={5} {...controlProps} />
              ) : (
                <input type={field.type} {...controlProps} />
              )}
              {error && (
                <p className="field__error" id={errorId}>
                  {error}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <div className={`form__notice form__notice--${status}`} role="status">
        {status === 'success' && (
          <>
            <Icon name="check" size={20} />
            <p>Thank you. Your enquiry has been sent successfully.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <Icon name="info" size={20} />
            <p>{submitError}</p>
          </>
        )}
      </div>

      <div className="form__footer">
        <button className="btn btn--primary btn--lg" type="submit" disabled={submitting}>
          {submitting ? 'Sending…' : 'Submit enquiry'}
          <Icon name="arrow-right" size={18} />
        </button>
      </div>
    </form>
  )
}
