import { useRef, useState } from 'react'
import { apiPost } from '../../../api/client'
import { CONTACT_EMAIL } from '../../../config'
import { EMPTY_VALUES, FIELDS, submitEnquiry, validate, validateField } from '../enquiry'
import { Icon } from './Icon'

// Adapted from apps/fitness/src/components/EnquiryForm.jsx. Field definitions, validation and the
// mapping of API outcomes live in ../enquiry.js; the request goes through the shared API client
// (POST {VITE_API_BASE_URL}/fitness-leads).
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
    // A second submit while a request is pending (Enter key, double click) is ignored.
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
      await submitEnquiry(values, { post: apiPost, contactEmail: CONTACT_EMAIL })
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
