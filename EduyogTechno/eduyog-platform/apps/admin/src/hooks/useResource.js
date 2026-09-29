import { useCallback, useEffect, useState } from 'react'

/**
 * Loads data with `loader` (a stable function returning a promise) and
 * exposes { data, error, loading, reload }. reload() refetches; existing
 * data stays visible while it does.
 */
export function useResource(loader) {
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

  return { ...state, reload }
}
