import { useCallback, useEffect, useMemo, useState } from 'react'
import { RouterContext } from './RouterContext'

function currentLocation() {
  return { path: window.location.pathname, search: window.location.search }
}

// Minimal History API router, as in the Admin app, plus query strings. The
// Vite dev server serves index.html for unknown paths, so deep links and
// reloads work.
export function RouterProvider({ children }) {
  const [location, setLocation] = useState(currentLocation)

  useEffect(() => {
    const onPopState = () => setLocation(currentLocation())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // `to` may include a query string, e.g. "/login?next=/dashboard".
  const navigate = useCallback((to, { replace = false } = {}) => {
    if (to === window.location.pathname + window.location.search) return
    window.history[replace ? 'replaceState' : 'pushState'](null, '', to)
    setLocation(currentLocation())
    window.scrollTo(0, 0)
  }, [])

  const value = useMemo(
    () => ({
      path: location.path,
      fullPath: location.path + location.search,
      query: new URLSearchParams(location.search),
      navigate,
    }),
    [location, navigate],
  )

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}
