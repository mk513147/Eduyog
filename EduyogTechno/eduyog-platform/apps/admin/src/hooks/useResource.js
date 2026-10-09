import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Loads data with `loader` (a stable function returning a promise) and
 * exposes { data, error, loading, reload }. reload() refetches and returns a promise that
 * resolves once that fetch has finished (successfully or not); existing
 * data stays visible while it does, and also when a refetch fails. With { refetchOnFocus: true } the data is
 * also refetched when the tab/window becomes active again (no polling), so
 * changes made by other apps show up without a browser refresh.
 */
export function useResource(loader, { refetchOnFocus = false } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const [version, setVersion] = useState(0)
  // Resolvers of reload() promises, settled when the next fetch finishes.
  const waiters = useRef([])
  const settle = () => waiters.current.splice(0).forEach((resolve) => resolve())

  useEffect(() => {
    let cancelled = false
    loader().then(
      (data) => {
        if (cancelled) return
        setState({ data, error: null, loading: false })
        settle()
      },
      (error) => {
        if (cancelled) return
        setState((prev) => ({ data: prev.data, error, loading: false }))
        settle()
      },
    )
    return () => {
      cancelled = true
    }
  }, [loader, version])

  const reload = useCallback(
    () =>
      new Promise((resolve) => {
        waiters.current.push(resolve)
        setState((prev) => ({ ...prev, error: null, loading: prev.data === null }))
        setVersion((v) => v + 1)
      }),
    [],
  )

  // Never leave a caller waiting after the page is gone.
  useEffect(() => {
    const pending = waiters
    return () => pending.current.splice(0).forEach((resolve) => resolve())
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
