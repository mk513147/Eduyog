import { BrandLogo } from '../components/BrandLogo'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { Alert, Spinner } from '../components/States'
import { TextField } from '../components/Fields'

export default function LoginPage() {
  const { login, notice } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    document.title = 'Sign in · Eduyog Admin'
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email, password)
      // App redirects to the dashboard once authenticated.
    } catch (err) {
      setError(err.message)
      setPassword('')
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login__panel">
        <div className="brand brand--login">
          <BrandLogo size={44} />
          <span>
            <span className="brand__name">Eduyog Techno Solution</span>
            <span className="brand__sub">Admin Console</span>
          </span>
        </div>

        <h1 className="login__title">Sign in</h1>
        <p className="login__subtitle">Only Admin accounts can access this console.</p>

        {notice && !error && <Alert tone="info">{notice}</Alert>}
        {error && <Alert>{error}</Alert>}

        <form className="form" onSubmit={handleSubmit}>
          <TextField
            label="Email"
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <TextField
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy && <Spinner size="sm" />}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
