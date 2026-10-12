import { useEffect, useRef } from 'react'
import { DEFAULT_INTERVAL_MS, createAutoRefresher } from './autoRefresh'

/**
 * Re-runs `reload` (normally the `reload` of a useResource) every `interval` ms while the tab is
 * visible, pauses while it is hidden and refreshes immediately when the tab becomes visible again.
 * Refreshes never overlap (reload should return a promise, as useResource's does), and a failed
 * refresh leaves the loaded data alone.
 *
 * Each page passes only its own reload, so only the data it shows is polled. The latest `reload`
 * is always used without restarting the timer.
 *
 *   const users = useResource(usersApi.list)
 *   useAutoRefresh(users.reload)
 */
export function useAutoRefresh(reload, { interval = DEFAULT_INTERVAL_MS, enabled = true } = {}) {
  const reloadRef = useRef(reload)
  useEffect(() => {
    reloadRef.current = reload
  })

  useEffect(() => {
    if (!enabled) return undefined
    const refresher = createAutoRefresher({ refresh: () => reloadRef.current(), intervalMs: interval })
    refresher.start()
    return () => refresher.stop()
  }, [interval, enabled])
}
