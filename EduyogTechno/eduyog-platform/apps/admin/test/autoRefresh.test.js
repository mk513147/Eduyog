// Unit tests for the Admin auto-refresh core (src/hooks/autoRefresh.js) with node:test.
// Time, the document and the window are faked, so nothing here waits for real timers.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { setImmediate } from 'node:timers'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAutoRefresher } from '../src/hooks/autoRefresh.js'

const flush = () => new Promise((resolve) => setImmediate(resolve))

function fakeEnv() {
  let time = 0
  let nextId = 1
  const queue = new Map()
  const listeners = { doc: new Map(), win: new Map() }
  const target = (name) => ({
    addEventListener: (type, fn) => listeners[name].set(type, fn),
    removeEventListener: (type) => listeners[name].delete(type),
  })
  const doc = { visibilityState: 'visible', ...target('doc') }
  const win = target('win')
  const timers = {
    setTimeout: (fn, ms) => {
      const id = nextId++
      queue.set(id, { fn, at: time + ms })
      return id
    },
    clearTimeout: (id) => queue.delete(id),
  }
  return {
    doc,
    win,
    timers,
    now: () => time,
    pending: () => queue.size,
    listenerCount: () => listeners.doc.size + listeners.win.size,
    // Moves the clock forward, running due timers in order (each may schedule more).
    async advance(ms) {
      const end = time + ms
      for (;;) {
        const due = [...queue.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        queue.delete(due[0])
        time = due[1].at
        due[1].fn() // not awaited: a refresh may stay pending on purpose
        await flush()
      }
      time = end
    },
    fire(name, type) {
      return listeners[name].get(type)?.()
    },
  }
}

function setup(refresh, intervalMs = 30_000) {
  const env = fakeEnv()
  const refresher = createAutoRefresher({ refresh, intervalMs, doc: env.doc, win: env.win, timers: env.timers, now: env.now })
  return { env, refresher }
}

test('refreshes on a schedule while the tab is visible', async () => {
  let calls = 0
  const { env, refresher } = setup(async () => {
    calls += 1
  })
  refresher.start()
  assert.equal(calls, 0, 'no request at start (the page has just loaded)')
  await env.advance(29_999)
  assert.equal(calls, 0)
  await env.advance(1)
  assert.equal(calls, 1)
  await env.advance(30_000)
  await env.advance(30_000)
  assert.equal(calls, 3)
  refresher.stop()
})

test('uses the configured interval', async () => {
  let calls = 0
  const { env, refresher } = setup(async () => {
    calls += 1
  }, 5_000)
  refresher.start()
  await env.advance(15_000)
  assert.equal(calls, 3)
  refresher.stop()
})

test('does not overlap: the next run waits for the previous one to finish', async () => {
  let calls = 0
  let release
  const { env, refresher } = setup(() => {
    calls += 1
    return new Promise((resolve) => {
      release = resolve
    })
  })
  refresher.start()
  await env.advance(30_000)
  assert.equal(calls, 1)
  await env.advance(120_000)
  assert.equal(calls, 1, 'still waiting for the first refresh; nothing else started')
  env.fire('doc', 'visibilitychange')
  env.fire('win', 'focus')
  assert.equal(calls, 1, 'returning to the tab does not start a second request either')
  release()
  await flush()
  assert.equal(env.pending(), 1, 'next run scheduled after completion')
  await env.advance(30_000)
  assert.equal(calls, 2)
  refresher.stop()
})

test('pauses while hidden and refreshes immediately when visible again', async () => {
  let calls = 0
  const { env, refresher } = setup(async () => {
    calls += 1
  })
  refresher.start()
  await env.advance(30_000)
  assert.equal(calls, 1)

  env.doc.visibilityState = 'hidden'
  env.fire('doc', 'visibilitychange')
  assert.equal(env.pending(), 0, 'timer cancelled while hidden')
  await env.advance(300_000)
  assert.equal(calls, 1, 'no polling in the background')

  env.doc.visibilityState = 'visible'
  env.fire('doc', 'visibilitychange')
  await flush()
  assert.equal(calls, 2, 'refreshed right away on return')
  await env.advance(30_000)
  assert.equal(calls, 3, 'periodic polling resumed')
  refresher.stop()
})

test('a due timer that fires while the tab is hidden does nothing and is not rescheduled', async () => {
  let calls = 0
  const { env, refresher } = setup(async () => {
    calls += 1
  })
  refresher.start()
  env.doc.visibilityState = 'hidden' // no visibilitychange delivered yet
  await env.advance(30_000)
  assert.equal(calls, 0)
  assert.equal(env.pending(), 0)
  refresher.stop()
})

test('visibilitychange and focus together cause a single refresh', async () => {
  let calls = 0
  const { env, refresher } = setup(async () => {
    calls += 1
  })
  refresher.start()
  await env.advance(45_000)
  assert.equal(calls, 1)
  env.doc.visibilityState = 'hidden'
  env.fire('doc', 'visibilitychange')
  await env.advance(60_000)
  env.doc.visibilityState = 'visible'
  env.fire('doc', 'visibilitychange')
  env.fire('win', 'focus')
  await flush()
  assert.equal(calls, 2)
  refresher.stop()
})

test('a failing refresh does not stop polling and is not thrown', async () => {
  let calls = 0
  const { env, refresher } = setup(async () => {
    calls += 1
    throw new Error('network down')
  })
  refresher.start()
  await env.advance(30_000)
  await env.advance(30_000)
  assert.equal(calls, 2)
  refresher.stop()
})

test('stop() removes the timer and listeners, and an in-flight refresh cannot reschedule', async () => {
  let calls = 0
  let release
  const { env, refresher } = setup(() => {
    calls += 1
    return new Promise((resolve) => {
      release = resolve
    })
  })
  refresher.start()
  assert.equal(env.listenerCount(), 2)
  await env.advance(30_000)
  refresher.stop()
  assert.equal(env.listenerCount(), 0)
  assert.equal(env.pending(), 0)
  release()
  await flush()
  assert.equal(env.pending(), 0, 'nothing rescheduled after stop')
  await env.advance(300_000)
  assert.equal(calls, 1)
  env.fire('doc', 'visibilitychange')
  assert.equal(calls, 1)
})

test('start() is idempotent and a restarted refresher polls again', async () => {
  let calls = 0
  const { env, refresher } = setup(async () => {
    calls += 1
  })
  refresher.start()
  refresher.start()
  assert.equal(env.pending(), 1)
  refresher.stop()
  refresher.start()
  await env.advance(30_000)
  assert.equal(calls, 1)
  refresher.stop()
})

// ---- Integration: the hook and representative pages (source-level checks; the running behaviour
// ---- was exercised in Chrome, see the task report).

const src = (...parts) => readFileSync(join(import.meta.dirname, '..', 'src', ...parts), 'utf8')

test('useResource.reload returns a promise and keeps data when a refetch fails', () => {
  const code = src('hooks', 'useResource.js')
  assert.match(code, /new Promise\(\(resolve\) =>/)
  assert.match(code, /setState\(\(prev\) => \(\{ data: prev\.data, error, loading: false \}\)\)/)
})

test('each polled Admin page registers its own reload with useAutoRefresh', () => {
  const pages = {
    'pages/UsersPage.jsx': 'users',
    'pages/FitnessLeadsPage.jsx': 'leads',
    'pages/eduyarp/CoursesPage.jsx': 'courses',
    'pages/eduyarp/CourseDetailPage.jsx': 'course',
    'pages/eduyarp/EnrolmentsPage.jsx': 'enrolments',
    'pages/eduyarp/ClassesPage.jsx': 'classes',
    'pages/eduyarp/TrainersPage.jsx': 'trainers',
    'pages/eduyarp/AnnouncementsPage.jsx': 'announcements',
    'pages/eduyarp/CertificatesPage.jsx': 'certificates',
  }
  for (const [file, variable] of Object.entries(pages)) {
    const code = src(...file.split('/'))
    assert.match(code, /import \{ useAutoRefresh \} from/, file)
    assert.match(code, new RegExp(`useAutoRefresh\\(reload, \\{ enabled: Boolean\\(${variable}\\) \\}\\)`), file)
  }
  assert.match(src('pages', 'OverviewPage.jsx'), /useAutoRefresh\(\(\) => Promise\.all\(\[users, courses, enrolments, classes, leads\]/)
  const content = src('pages', 'eduyarp', 'CourseContent.jsx')
  assert.match(content, /useAutoRefresh\(reload, \{ enabled: Boolean\(assignments\) \}\)/)
  assert.match(content, /useAutoRefresh\(reload, \{ enabled: Boolean\(resources\) \}\)/)
  assert.match(src('pages', 'eduyarp', 'AssignmentModals.jsx'), /useAutoRefresh\(reload, \{ enabled: Boolean\(data\) \}\)/)
})

test('pages that poll no longer also refetch on focus (one request per tab return)', () => {
  for (const file of ['pages/UsersPage.jsx', 'pages/FitnessLeadsPage.jsx', 'pages/eduyarp/CertificatesPage.jsx']) {
    assert.doesNotMatch(src(...file.split('/')), /refetchOnFocus/, file)
  }
})

test('static pages and forms do not poll', () => {
  for (const file of ['LoginPage.jsx', 'PlatformFormModal.jsx', 'ServiceFormModal.jsx', 'UserProfileModal.jsx']) {
    assert.doesNotMatch(src('pages', file), /useAutoRefresh/, file)
  }
})
