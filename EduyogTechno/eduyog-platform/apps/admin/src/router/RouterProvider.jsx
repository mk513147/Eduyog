import { useCallback, useEffect, useMemo, useState } from 'react'
import { RouterContext } from './RouterContext'

// Minimal History API router: the app has a handful of flat routes, so a
// routing library is not needed. The Vite dev server serves index.html for
// unknown paths, so deep links and reloads work.
export function RouterProvider({ children }) {
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((to, { replace = false } = {}) => {
    if (to === window.location.pathname) return
    window.history[replace ? 'replaceState' : 'pushState'](null, '', to)
    setPath(to)
    window.scrollTo(0, 0)
  }, [])

  const value = useMemo(() => ({ path, navigate }), [path, navigate])

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}
