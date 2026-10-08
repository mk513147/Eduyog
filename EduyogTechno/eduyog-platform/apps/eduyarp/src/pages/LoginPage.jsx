import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { TextField } from '../components/Fields'
import { Alert, Spinner } from '../components/States'
import { usePageTitle } from '../hooks/usePageTitle'
import { Link } from '../router/Link'
import { safeNextPath } from '../router/match'
import { useRouter } from '../router/useRouter'

export default function LoginPage() {
  usePageTitle('Log in')
  const { login, notice } = useAuth()
  const { query, navigate } = useRouter()
  const next = safeNextPath(query.get('next'))
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const user = await login(form.email, form.password)
      // Students return to where they were (default: dashboard); Trainers land on
      // their dashboard unless they were heading for a Trainer page or their profile;
      // other roles return to where they were.
      const requested = query.get('next')
      let destination
      if (user.role === 'student') destination = next
      else if (user.role === 'trainer')
        destination = /^\/(trainer|profile)(\/|$)/.test(requested ?? '') ? safeNextPath(requested, '/trainer') : '/trainer'
      else destination = safeNextPath(requested, '/courses')
      navigate(destination, { replace: true })
    } catch (err) {
      setError(err.status === 400 ? 'Please enter your email and password.' : err.message)
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth__card card">
        <h1 className="auth__title">Welcome back</h1>
        <p className="auth__text">Log in to continue learning.</p>
        {notice && <Alert tone="info">{notice}</Alert>}
        {error && <Alert>{error}</Alert>}
        <form className="form" onSubmit={handleSubmit} noValidate>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={update('email')}
            required
            autoFocus
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={update('password')}
            required
          />
          <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy}>
            {busy && <Spinner size="sm" />}
            Log in
          </button>
        </form>
        <p className="auth__switch">
          New to Eduyarp?{' '}
          <Link to={`/register?next=${encodeURIComponent(next)}`}>Create an account</Link>
        </p>
      </div>
    </div>
  )
}
