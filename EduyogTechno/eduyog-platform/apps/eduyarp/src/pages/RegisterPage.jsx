import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { TextField } from '../components/Fields'
import { Alert, Spinner } from '../components/States'
import { usePageTitle } from '../hooks/usePageTitle'
import { Link } from '../router/Link'
import { safeNextPath } from '../router/match'
import { useRouter } from '../router/useRouter'
import { splitApiError } from '../utils/errors'

const FIELDS = ['fullName', 'email', 'password']

// Registration always creates a Student account (enforced by the backend).
export default function RegisterPage() {
  usePageTitle('Create account')
  const { register } = useAuth()
  const { query, navigate } = useRouter()
  const next = safeNextPath(query.get('next'))
  const [form, setForm] = useState({ fullName: '', email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setFormError(null)
    setFieldErrors({})
    try {
      await register(form.fullName, form.email, form.password)
      navigate(next, { replace: true })
    } catch (err) {
      const split = splitApiError(err, FIELDS)
      // 409: an account with this email already exists.
      if (err.status === 409) {
        split.fieldErrors.email = err.message
        split.formError = null
      }
      setFieldErrors(split.fieldErrors)
      setFormError(split.formError)
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth__card card">
        <h1 className="auth__title">Create your account</h1>
        <p className="auth__text">Join Eduyarp to enrol in courses and track your progress.</p>
        {formError && <Alert>{formError}</Alert>}
        <form className="form" onSubmit={handleSubmit} noValidate>
          <TextField
            label="Full name"
            autoComplete="name"
            value={form.fullName}
            onChange={update('fullName')}
            error={fieldErrors.fullName}
            maxLength={150}
            required
            autoFocus
          />
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={update('email')}
            error={fieldErrors.email}
            maxLength={254}
            required
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={update('password')}
            error={fieldErrors.password}
            hint="At least 8 characters."
            minLength={8}
            required
          />
          <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy}>
            {busy && <Spinner size="sm" />}
            Create account
          </button>
        </form>
        <p className="auth__switch">
          Already have an account? <Link to={`/login?next=${encodeURIComponent(next)}`}>Log in</Link>
        </p>
      </div>
    </div>
  )
}
