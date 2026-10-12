// Framework-free core of the Admin auto-refresh (see useAutoRefresh.js for the React hook).
//
// Behaviour:
//   * While the tab is visible, `refresh` runs every `intervalMs`. The next run is scheduled
//     only AFTER the previous one has finished, so two refreshes never overlap and a slow
//     response cannot pile requests up.
//   * While the tab is hidden nothing is scheduled. Returning to the tab refreshes at once
//     (unless a refresh just happened) and the timer starts again.
//   * A refresh that throws or rejects is ignored: the page keeps the data it already has and
//     the next scheduled run tries again.
//   * stop() clears the timer and the listeners; a refresh still in flight cannot reschedule.
//
// The environment (document, window, timers) is injectable so the logic can be tested without a
// browser.

export const DEFAULT_INTERVAL_MS = 30_000
// Returning to the tab fires visibilitychange and focus together; refresh once.
const MIN_GAP_MS = 1_000

export function createAutoRefresher({
  refresh,
  intervalMs = DEFAULT_INTERVAL_MS,
  doc = typeof document === 'undefined' ? undefined : document,
  win = typeof window === 'undefined' ? undefined : window,
  timers = { setTimeout: (...args) => setTimeout(...args), clearTimeout: (id) => clearTimeout(id) },
  now = () => Date.now(),
} = {}) {
  let timer = null
  let running = false
  let stopped = true
  let lastRun = -Infinity

  const isHidden = () => Boolean(doc) && doc.visibilityState === 'hidden'

  function clearTimer() {
    if (timer !== null) {
      timers.clearTimeout(timer)
      timer = null
    }
  }

  function schedule() {
    clearTimer()
    if (stopped || isHidden()) return
    timer = timers.setTimeout(run, intervalMs)
  }

  async function run() {
    timer = null
    if (stopped || running || isHidden()) return
    running = true
    lastRun = now()
    try {
      await refresh()
    } catch {
      // Keep the existing data; try again on the next run.
    } finally {
      running = false
      schedule()
    }
  }

  function onActive() {
    if (stopped) return
    if (isHidden()) {
      clearTimer()
      return
    }
    if (running) return
    if (now() - lastRun < MIN_GAP_MS) {
      schedule()
      return
    }
    clearTimer()
    run()
  }

  return {
    start() {
      if (!stopped) return
      stopped = false
      doc?.addEventListener('visibilitychange', onActive)
      win?.addEventListener('focus', onActive)
      schedule()
    },
    stop() {
      stopped = true
      clearTimer()
      doc?.removeEventListener('visibilitychange', onActive)
      win?.removeEventListener('focus', onActive)
    },
  }
}
