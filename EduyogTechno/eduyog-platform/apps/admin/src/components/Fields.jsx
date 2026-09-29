import { useId } from 'react'

function describedBy(id, hint, error) {
  return [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
}

function FieldMessages({ id, hint, error }) {
  return (
    <>
      {hint && (
        <p id={`${id}-hint`} className="field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field__error">
          {error}
        </p>
      )}
    </>
  )
}

export function TextField({ label, hint, error, required, ...inputProps }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {label}
        {required && <span className="field__required" aria-hidden="true"> *</span>}
      </label>
      <input
        id={id}
        className="input"
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...inputProps}
      />
      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  )
}

export function TextAreaField({ label, hint, error, required, ...textareaProps }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {label}
        {required && <span className="field__required" aria-hidden="true"> *</span>}
      </label>
      <textarea
        id={id}
        className="input input--textarea"
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...textareaProps}
      />
      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  )
}

export function SelectField({ label, hint, error, children, ...selectProps }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      <select
        id={id}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...selectProps}
      >
        {children}
      </select>
      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  )
}

export function CheckboxField({ label, hint, error, ...inputProps }) {
  const id = useId()
  return (
    <div className="field field--checkbox">
      <input
        id={id}
        type="checkbox"
        className="checkbox"
        aria-describedby={describedBy(id, hint, error)}
        {...inputProps}
      />
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  )
}
