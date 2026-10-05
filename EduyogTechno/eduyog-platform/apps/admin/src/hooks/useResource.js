import { useCallback, useEffect, useState } from 'react'

/**
 * Loads data with `loader` (a stable function returning a promise) and
 * exposes { data, error, loading, reload }. reload() refetches; existing
 * data stays visible while it does. With { refetchOnFocus: true } the data is
 * also refetched when the tab/window becomes active again (no polling), so
 * changes made by other apps show up without a browser refresh.
 */
export function useResource(loader, { refetchOnFocus = false } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    loader().then(
      (data) => {
        if (!cancelled) setState({ data, error: null, loading: false })
      },
      (error) => {
        if (!cancelled) setState((prev) => ({ data: prev.data, error, loading: false }))
      },
    )
    return () => {
      cancelled = true
    }
  }, [loader, version])

  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, error: null, loading: prev.data === null }))
    setVersion((v) => v + 1)
  }, [])

  useEffect(() => {
    if (!refetchOnFocus) return undefined
    let last = 0
    const onActive = () => {
      if (document.visibilityState === 'hidden') return
      // focus and visibilitychange often fire together; fetch once.
      const now = Date.now()
      if (now - last < 1000) return
      last = now
      reload()
    }
    window.addEventListener('focus', onActive)
    document.addEventListener('visibilitychange', onActive)
    return () => {
      window.removeEventListener('focus', onActive)
      document.removeEventListener('visibilitychange', onActive)
    }
  }, [refetchOnFocus, reload])

  return { ...state, reload }
}
