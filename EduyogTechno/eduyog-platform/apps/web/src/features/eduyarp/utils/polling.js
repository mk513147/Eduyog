// Pure helpers for the two background behaviours of Eduyarp, extracted unchanged from the standalone
// app so that their timers and listeners can be unit tested (node:test, fake timers and targets).
// Both return a function that removes everything they added.

/**
 * Trainer dashboard refresh: while the tab is visible, call `refresh` every `intervalMs`; when the tab
 * becomes visible again, refresh immediately and restart the interval; while hidden, do nothing.
 * Never keeps more than one interval running.
 */
export function startVisibilityPolling({
  doc,
  refresh,
  intervalMs = 30_000,
  timers = { setInterval: (...args) => setInterval(...args), clearInterval: (...args) => clearInterval(...args) },
}) {
  let intervalId

  const run = () => {
    if (doc.visibilityState !== 'visible') return
    refresh()
  }

  const start = () => {
    timers.clearInterval(intervalId)
    if (doc.visibilityState !== 'visible') return
    intervalId = timers.setInterval(run, intervalMs)
  }

  const onVisibilityChange = () => {
    if (doc.visibilityState === 'visible') run()
    start()
  }

  start()
  doc.addEventListener('visibilitychange', onVisibilityChange)

  return () => {
    timers.clearInterval(intervalId)
    doc.removeEventListener('visibilitychange', onVisibilityChange)
  }
}

/**
 * Notification refresh (there is no polling): refresh when the window regains focus and when the tab
 * becomes visible.
 */
export function subscribeRefreshOnReturn({ win, doc, refresh }) {
  const onVisible = () => doc.visibilityState === 'visible' && refresh()
  win.addEventListener('focus', refresh)
  doc.addEventListener('visibilitychange', onVisible)
  return () => {
    win.removeEventListener('focus', refresh)
    doc.removeEventListener('visibilitychange', onVisible)
  }
}
