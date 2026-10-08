import { useCallback, useEffect, useMemo, useState } from 'react'
import { setSessionExpiredHandler } from '../api/client'
import { authApi } from '../api/endpoints'
import { clearToken, getToken, setToken } from '../api/session'
import { AuthContext } from './AuthContext'

// status: 'checking' | 'authenticated' | 'anonymous'.
// The user (and role) always comes from /auth/me, never from stored data.
export function AuthProvider({ children }) {
  const [state, setState] = useState(() => ({
    status: getToken() ? 'checking' : 'anonymous',
    user: null,
    notice: null,
  }))

  const logout = useCallback((notice = null) => {
    clearToken()
    setState({ status: 'anonymous', user: null, notice })
  }, [])

  useEffect(() => {
    setSessionExpiredHandler(() => logout('Your session has expired. Please log in again.'))
    return () => setSessionExpiredHandler(null)
  }, [logout])

  // Restore a session from a stored token.
  useEffect(() => {
    const token = getToken()
    if (!token) return
    let cancelled = false
    authApi.me(token).then(
      (user) => {
        if (!cancelled) setState({ status: 'authenticated', user, notice: null })
      },
      () => {
        if (!cancelled) logout()
      },
    )
    return () => {
      cancelled = true
    }
  }, [logout])

  const login = useCallback(async (email, password) => {
    const { token } = await authApi.login(email, password)
    const user = await authApi.me(token)
    setToken(token)
    setState({ status: 'authenticated', user, notice: null })
    return user
  }, [])

  // Registration always creates a Student account; then sign in.
  const register = useCallback(
    async (fullName, email, password) => {
      await authApi.register(fullName, email, password)
      return login(email, password)
    },
    [login],
  )

  // Keeps the header in step after a profile save (the display name can change).
  const updateUser = useCallback((changes) => {
    setState((prev) => (prev.user ? { ...prev, user: { ...prev.user, ...changes } } : prev))
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      isStudent: state.user?.role === 'student',
      isTrainer: state.user?.role === 'trainer',
      login,
      register,
      logout,
      updateUser,
    }),
    [state, login, register, logout, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
