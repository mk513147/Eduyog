import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, setAuthFailureHandler } from '../api/client'
import { authApi } from '../api/endpoints'
import { clearToken, getToken, setToken } from '../api/session'
import { AuthContext } from './AuthContext'

const NOT_ADMIN = 'This account does not have Admin access.'
const SESSION_EXPIRED = 'Your session has expired. Please sign in again.'
const ACCESS_REVOKED = 'Your account no longer has Admin access.'

// status: 'checking' (verifying a stored token) | 'authenticated' | 'anonymous'
export function AuthProvider({ children }) {
  const [state, setState] = useState(() => ({
    status: getToken() ? 'checking' : 'anonymous',
    user: null,
  }))
  // A message shown on the login page, e.g. after an expired session.
  const [notice, setNotice] = useState(null)

  const logout = useCallback((message = null) => {
    clearToken()
    setState({ status: 'anonymous', user: null })
    setNotice(message)
  }, [])

  // Re-verify a token left in sessionStorage (e.g. after a page reload).
  // The role is always taken from /auth/me, never from stored data.
  useEffect(() => {
    const token = getToken()
    if (!token) return
    let cancelled = false
    authApi
      .me(token)
      .then((user) => {
        if (cancelled) return
        if (user.role === 'admin') {
          setState({ status: 'authenticated', user })
        } else {
          logout(NOT_ADMIN)
        }
      })
      .catch((error) => {
        if (cancelled) return
        if (error.status === 401) logout(SESSION_EXPIRED)
        else if (error.status === 403) logout(ACCESS_REVOKED)
        else {
          // Server unreachable: keep the token so a reload can retry.
          setState({ status: 'anonymous', user: null })
          setNotice(error.message)
        }
      })
    return () => {
      cancelled = true
    }
  }, [logout])

  // Any authenticated API call that returns 401/403 ends the session.
  useEffect(() => {
    setAuthFailureHandler((error) => logout(error.status === 403 ? ACCESS_REVOKED : SESSION_EXPIRED))
    return () => setAuthFailureHandler(null)
  }, [logout])

  const login = useCallback(async (email, password) => {
    const { token } = await authApi.login(email, password)
    // Confirm the role with /auth/me before storing anything.
    const user = await authApi.me(token)
    if (user.role !== 'admin') {
      throw new ApiError(403, NOT_ADMIN)
    }
    setToken(token)
    setNotice(null)
    setState({ status: 'authenticated', user })
  }, [])

  const value = useMemo(
    () => ({ ...state, notice, login, logout: () => logout() }),
    [state, notice, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
