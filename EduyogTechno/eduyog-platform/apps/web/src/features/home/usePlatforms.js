import { useCallback, useEffect, useState } from 'react'
import { fetchPlatforms } from '../../api/fetchPlatforms'
import { API_BASE_URL } from '../../config'

const REQUEST_TIMEOUT_MS = 10000

// Loads GET /api/platforms (active platforms only). status:
//   'loading'     request in flight
//   'ready'       platforms is the (possibly empty) list returned by the API
//   'error'       the request failed, timed out or returned an unexpected body; retry() tries again
//   'unavailable' no API address is configured, so no request is made (nothing to retry)
// `enabled: false` (no card depends on the API) makes no request at all.
export function usePlatforms({ enabled = true } = {}) {
  const active = enabled && Boolean(API_BASE_URL)
  const [state, setState] = useState(() =>
    active ? { status: 'loading', platforms: [] } : { status: 'unavailable', platforms: [] },
  )
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!active) return undefined
    let cancelled = false
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    fetchPlatforms({ signal: controller.signal })
      .then((platforms) => {
        if (!cancelled) setState({ status: 'ready', platforms })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', platforms: [] })
      })
      .finally(() => clearTimeout(timer))

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timer)
    }
  }, [active, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading', platforms: [] })
    setAttempt((count) => count + 1)
  }, [])

  return { ...state, retry }
}
