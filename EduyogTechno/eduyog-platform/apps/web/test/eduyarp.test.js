// Eduyarp integration tests (node:test): route inventory against the ORIGINAL app's source, route
// mapping and ?next= safety, the auth/session contract, the API client's token handling, access
// guards, timer/listener cleanup and the pure learning/assignment/profile helpers. No browser and no
// network: fetch, storage and timers are fakes. (Flows against a mock API run in a real browser; see
// README. Nothing here talks to the real backend or database.)
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ApiError, createApiClient } from '../src/api/createClient.js'
import { resolveAccess } from '../src/features/eduyarp/access.js'
import { startVisibilityPolling, subscribeRefreshOnReturn } from '../src/features/eduyarp/utils/polling.js'
import { assignmentFixtures } from './fixtures.js'
import {
  EDUYARP_NOT_FOUND,
  NOT_FOUND,
  ROUTES,
  ROUTE_PATHS,
  eduyarpDestination,
  legacyToUnified,
  loginPath,
  resolveRoute,
  safeNextPath,
} from '../src/routes.js'

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..')
const PLATFORM = join(WEB, '..', '..')
const ORIGINAL = join(PLATFORM, 'apps', 'eduyarp', 'src')
const FEATURE = join(WEB, 'src', 'features', 'eduyarp')
const read = (file) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const eduyarpRoutes = ROUTES.filter((route) => route.module === 'eduyarp')

// ---------- Route inventory (against the original source) ----------

function originalRoutes() {
  const app = read(join(ORIGINAL, 'App.jsx'))
  return [...app.matchAll(/\{ pattern: '([^']+)', Page: (\w+), access: '(\w+)' \}/g)].map(([, pattern, page, access]) => ({ pattern, page, access }))
}

function unifiedPages() {
  const app = read(join(FEATURE, 'EduyarpApp.jsx'))
  return Object.fromEntries([...app.matchAll(/^ {2}'([\w-]+)': (\w+),$/gm)].map(([, id, page]) => [id, page]))
}

const params = (pattern) => (pattern.match(/:\w+/g) ?? []).sort()

test('every one of the original 17 Eduyarp routes is registered with the same page, access and params', () => {
  const original = originalRoutes()
  assert.equal(original.length, 17, 'the original app defines 17 routes')
  const pages = unifiedPages()
  assert.equal(eduyarpRoutes.length, 18, '17 original routes + the free preview (demo access)')
  assert.ok(eduyarpRoutes.some((route) => route.id === 'eduyarp-preview' && route.access === 'student'))
  for (const old of original) {
    const route = eduyarpRoutes.find((candidate) => candidate.legacy === old.pattern)
    assert.ok(route, `no unified route for ${old.pattern}`)
    assert.equal(route.access, old.access, `${old.pattern}: access`)
    assert.equal(pages[route.id], old.page, `${old.pattern}: page`)
    assert.deepEqual(params(route.path), params(old.pattern), `${old.pattern}: param names`)
  }
  assert.equal(pages['eduyarp-not-found'], 'NotFoundPage')
  assert.equal(new Set(eduyarpRoutes.map((route) => route.id)).size, 18)
  assert.equal(new Set(eduyarpRoutes.map((route) => route.path)).size, 18)
})

test('the unified route map', () => {
  const expected = {
    '/': '/eduyarp',
    '/courses': '/eduyarp/courses',
    '/courses/:slug': '/eduyarp/courses/:slug',
    '/login': '/eduyarp/login',
    '/register': '/eduyarp/register',
    '/dashboard': '/eduyarp/dashboard',
    '/preview/:courseId': '/eduyarp/preview/:courseId',
    '/my-courses/:courseId': '/eduyarp/my-courses/:courseId',
    '/my-courses/:courseId/assignments/:assignmentId': '/eduyarp/my-courses/:courseId/assignments/:assignmentId',
    '/certificates': '/eduyarp/certificates',
    '/certificates/:certificateId': '/eduyarp/certificates/:certificateId',
    '/trainer': '/eduyarp/trainer',
    '/trainer/courses/:courseId': '/eduyarp/trainer/courses/:courseId',
    '/trainer/courses/:courseId/assignments/:assignmentId': '/eduyarp/trainer/courses/:courseId/assignments/:assignmentId',
    '/trainer/courses/:courseId/students/:studentId': '/eduyarp/trainer/courses/:courseId/students/:studentId',
    '/profile': '/account/profile',
    '/notifications': '/account/notifications',
    '/announcements': '/account/announcements',
  }
  assert.deepEqual(Object.fromEntries(eduyarpRoutes.map((route) => [route.legacy, route.path])), expected)
})

test('every route resolves with its params, with or without a trailing slash, ignoring the query string', () => {
  const sample = { slug: 'data-science', courseId: '12', assignmentId: '7', certificateId: '3', studentId: '9', id: '12' }
  for (const route of ROUTES) {
    const path = route.path.replace(/:(\w+)/g, (_, name) => sample[name])
    for (const candidate of [path, path === '/' ? path : `${path}/`]) {
      const resolved = resolveRoute(candidate)
      assert.equal(resolved.id, route.id, candidate)
      for (const name of Object.keys(route.path.match(/:\w+/g) ? Object.fromEntries((route.path.match(/:\w+/g)).map((n) => [n.slice(1), 1])) : {})) {
        assert.equal(resolved.params[name], sample[name], `${candidate} :${name}`)
      }
    }
  }
  // Query strings are not part of the path the router matches (the shell splits them off).
  assert.equal(resolveRoute('/eduyarp/courses/a%20b').params.slug, 'a b')
})

test('unknown paths inside the Eduyarp and account areas get Eduyarp\'s own not-found page; others the shell\'s', () => {
  for (const path of ['/eduyarp/nope', '/eduyarp/courses/a/b', '/account', '/account/nope', '/eduyarp/trainer/x']) {
    assert.equal(resolveRoute(path), EDUYARP_NOT_FOUND, path)
  }
  for (const path of ['/eduyarpx', '/accounts', '/login', '/dashboard', '/courses', '/trainer', '/saritex/']) {
    assert.equal(resolveRoute(path), NOT_FOUND, path)
  }
})

test('access levels: public, guest, student, trainer, account', () => {
  const access = Object.fromEntries(eduyarpRoutes.map((route) => [route.id, route.access]))
  assert.equal(access['eduyarp-landing'], 'public')
  assert.equal(access['eduyarp-courses'], 'public')
  assert.equal(access['eduyarp-course'], 'public')
  assert.equal(access['eduyarp-login'], 'guest')
  assert.equal(access['eduyarp-register'], 'guest')
  for (const id of ['eduyarp-dashboard', 'eduyarp-learn', 'eduyarp-assignment', 'eduyarp-certificates', 'eduyarp-certificate']) assert.equal(access[id], 'student', id)
  for (const id of ['eduyarp-trainer', 'eduyarp-trainer-course', 'eduyarp-trainer-assignment', 'eduyarp-trainer-student']) assert.equal(access[id], 'trainer', id)
  for (const id of ['account-profile', 'account-notifications', 'account-announcements']) assert.equal(access[id], 'account', id)
})

// ---------- Legacy paths (the backend stores them in notifications) and ?next= safety ----------

test('legacy Eduyarp paths translate to the unified routes, keeping query and hash', () => {
  assert.equal(legacyToUnified('/my-courses/5'), '/eduyarp/my-courses/5')
  assert.equal(legacyToUnified('/announcements'), '/account/announcements')
  assert.equal(legacyToUnified('/trainer/courses/9/assignments/3?submission=2'), '/eduyarp/trainer/courses/9/assignments/3?submission=2')
  assert.equal(legacyToUnified('/courses/a%20b#x'), '/eduyarp/courses/a%20b#x')
  assert.equal(legacyToUnified('/'), '/eduyarp')
  assert.equal(legacyToUnified('/eduyarp/courses'), null)
  assert.equal(legacyToUnified('/fitness'), null)
})

test('every notification link path the backend can store resolves to a real unified route', () => {
  const dir = join(PLATFORM, 'backend', 'services')
  const found = []
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.js'))) {
    for (const [, , template] of read(join(dir, file)).matchAll(/linkPath:\s*(['`])(.*?)\1/g)) found.push(template.replace(/\$\{[^}]*\}/g, '7'))
  }
  assert.ok(found.length >= 4, `expected the backend's notification links, found ${found.length}`)
  for (const linkPath of found) {
    const destination = eduyarpDestination(linkPath)
    assert.ok(destination, `${linkPath} has no unified destination`)
    assert.notEqual(resolveRoute(destination.split(/[?#]/)[0]).id, 'eduyarp-not-found', linkPath)
  }
})

test('eduyarpDestination never accepts an external, protocol-relative or out-of-area target', () => {
  for (const bad of [
    'https://evil.test/', 'http://evil.test', '//evil.test', '/\\evil.test', '/ /x', 'javascript:alert(1)', 'data:text/html,x', '',
    null, undefined, 5, '/fitness', '/saritex/', '/studentaq/index.html', '/admin', '/eduyarp/nope', '/account/nope', 'eduyarp/courses', '/eduyarp/courses\n/x',
  ]) {
    assert.equal(eduyarpDestination(bad), null, String(bad))
  }
  assert.equal(eduyarpDestination('/eduyarp/courses?x=1'), '/eduyarp/courses?x=1')
  assert.equal(eduyarpDestination('/my-courses/4'), '/eduyarp/my-courses/4')
})

test('safeNextPath: safe destinations pass; everything else (and signed-out-only pages) falls back', () => {
  assert.equal(safeNextPath('/eduyarp/my-courses/4'), '/eduyarp/my-courses/4')
  assert.equal(safeNextPath('/my-courses/4'), '/eduyarp/my-courses/4') // a legacy value in an old link
  assert.equal(safeNextPath('/account/profile', '/x'), '/account/profile')
  assert.equal(safeNextPath(null), ROUTE_PATHS.dashboard)
  assert.equal(safeNextPath(undefined, '/eduyarp/trainer'), '/eduyarp/trainer')
  for (const bad of ['https://evil.test', '//evil.test', '/\\evil.test', 'javascript:alert(1)', '/fitness', '/eduyarp/nope']) {
    assert.equal(safeNextPath(bad, '/fallback'), '/fallback', bad)
  }
  // The login/register pages would bounce a signed-in visitor straight back to themselves.
  assert.equal(safeNextPath('/eduyarp/login', '/fallback'), '/fallback')
  assert.equal(safeNextPath('/login?next=/x', '/fallback'), '/fallback')
})

test('loginPath round-trips the return destination through ?next=', () => {
  for (const target of ['/eduyarp/my-courses/4?x=1&y=2#z', '/account/profile', '/eduyarp/trainer/courses/9/assignments/3?submission=2']) {
    const url = new URL(loginPath(target), 'http://x')
    assert.equal(url.pathname, '/eduyarp/login')
    assert.equal(url.searchParams.get('next'), target)
    assert.equal(safeNextPath(url.searchParams.get('next')), target)
  }
})

test('no unprefixed legacy path is left in the Eduyarp sources', () => {
  const offenders = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.(jsx?|js)$/.test(name) && !full.includes(`${join('eduyarp', 'api')}`)) {
        read(full).split('\n').forEach((line, index) => {
          if (/^\s*(\/\/|\*|\/\*)/.test(line)) return // comments may name the old paths
          if (/["'`]\/(courses|dashboard|my-courses|certificates|trainer|login|register|profile|notifications|announcements)(?=[/"'`?]|\$\{)/.test(line)) offenders.push(`${full.replace(WEB, '')}:${index + 1}: ${line.trim()}`)
          if (/(to=|navigate\()\s*\{?["'`]\/["'`]/.test(line)) offenders.push(`${full.replace(WEB, '')}:${index + 1}: ${line.trim()}`)
        })
      }
    }
  }
  walk(FEATURE)
  assert.deepEqual(offenders, [])
})

// ---------- Authentication and API contract preserved ----------

test('session and auth context logic are unchanged from the original app', () => {
  for (const file of ['api/session.js', 'auth/AuthContext.js', 'auth/useAuth.js', 'utils/errors.js']) {
    assert.equal(read(join(FEATURE, file)), read(join(ORIGINAL, file)), `${file} differs from the original`)
  }
})

// The approval workflow added a few lines to files that otherwise mirror the original app. Every original line
// must still be there, in the original order; anything else must be one of the documented additions.
function assertOnlyDocumentedAdditions(current, original, documented, label) {
  const cur = current.replace(/\r\n/g, '\n').split('\n')
  const orig = original.replace(/\r\n/g, '\n').split('\n')
  let at = 0
  const kept = new Set()
  for (const line of orig) {
    const found = cur.indexOf(line, at)
    assert.ok(found >= 0, `${label}: original line was removed or changed: ${line.trim()}`)
    kept.add(found)
    at = found + 1
  }
  const added = cur.filter((_, index) => !kept.has(index)).filter((line) => line.trim() !== '')
  for (const line of added) assert.ok(documented.test(line), `${label}: undocumented added line: ${line.trim()}`)
}

test('endpoints and AuthProvider: only the documented approval-workflow changes (no self-enrolment, no auto sign-in after registering)', () => {
  const endpoints = read(join(FEATURE, 'api/endpoints.js'))
  assertOnlyDocumentedAdditions(endpoints, read(join(ORIGINAL, 'api/endpoints.js')).replace(/ {2}enrol: \(courseId\) =>\n.*\n/, ''), /demoCourse|demo\)|The free preview|Certificate requests|certificateRequests|requestCertificate|certificate-request|d\.requests|d\.request\)/, 'api/endpoints.js')
  assert.doesNotMatch(endpoints, /\/enrol/, 'students no longer enrol themselves')
  const auth = read(join(FEATURE, 'auth/AuthProvider.jsx'))
  assert.match(auth, /const \{ user \} = await authApi\.register\(/, 'registering returns the pending user')
  assert.doesNotMatch(auth, /register[\s\S]{0,200}return login\(/, 'registering does not sign in')
})

test('the Eduyarp token keeps its own key and storage, and tolerates unavailable storage', async () => {
  const store = new Map()
  globalThis.sessionStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) }
  const { getToken, setToken, clearToken } = await import('../src/features/eduyarp/api/session.js')
  assert.equal(getToken(), null)
  setToken('abc')
  assert.deepEqual([...store.keys()], ['eduyarp_token'], 'only the eduyarp_token key is used')
  assert.equal(getToken(), 'abc')
  clearToken()
  assert.equal(getToken(), null)
  assert.equal(store.size, 0)
  // Storage that throws (private mode, blocked site data) is tolerated.
  const boom = () => { throw new Error('blocked') }
  globalThis.sessionStorage = { getItem: boom, setItem: boom, removeItem: boom }
  assert.equal(getToken(), null)
  assert.doesNotThrow(() => setToken('x'))
  assert.doesNotThrow(() => clearToken())
  delete globalThis.sessionStorage
})

function recorder(responder) {
  const calls = []
  return { calls, fetchImpl: async (url, init) => (calls.push({ url, init }), responder(url, init)) }
}
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => { if (body === undefined) throw new SyntaxError('empty'); return body } })

test('API client: stored token is sent as a Bearer header; token:null sends none; an explicit token wins', async () => {
  const { calls, fetchImpl } = recorder(() => reply(200, { ok: true }))
  const client = createApiClient({ baseUrl: 'https://api.test/api', fetchImpl, getToken: () => 'stored' })
  await client.request('/eduyarp/me/courses')
  await client.request('/eduyarp/courses', { token: null })
  await client.request('/auth/me', { token: 'explicit' })
  assert.equal(calls[0].init.headers.Authorization, 'Bearer stored')
  assert.equal(calls[1].init.headers.Authorization, undefined)
  assert.equal(calls[2].init.headers.Authorization, 'Bearer explicit')
  assert.equal(calls[0].url, 'https://api.test/api/eduyarp/me/courses')
  assert.equal(calls[0].init.credentials, 'omit')
  // No stored token: no header either.
  const anonymous = createApiClient({ baseUrl: 'https://api.test/api', fetchImpl, getToken: () => null })
  await anonymous.request('/eduyarp/me/courses')
  assert.equal(calls[3].init.headers.Authorization, undefined)
})

test('API client: JSON bodies, methods, 204 and non-JSON success bodies', async () => {
  const { calls, fetchImpl } = recorder((url) => (url.endsWith('/gone') ? reply(204, undefined) : reply(201, { enrolment: { id: 1 } })))
  const client = createApiClient({ baseUrl: 'https://api.test/api', fetchImpl, getToken: () => 't' })
  assert.deepEqual(await client.request('/eduyarp/courses/3/enrol', { method: 'POST' }), { enrolment: { id: 1 } })
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(calls[0].init.body, undefined)
  assert.equal(calls[0].init.headers['Content-Type'], undefined)
  await client.request('/me/profile', { method: 'PATCH', body: { fullName: 'A' } })
  assert.equal(calls[1].init.headers['Content-Type'], 'application/json')
  assert.equal(calls[1].init.body, '{"fullName":"A"}')
  assert.equal(await client.request('/gone', { method: 'DELETE' }), null)
})

test('API client: a 401 on the stored token calls the session-expired handler; explicit tokens, 403 and 404 do not', async () => {
  const expired = []
  const make = (status) => createApiClient({
    baseUrl: 'https://api.test/api',
    fetchImpl: async () => reply(status, { error: { message: 'nope', details: { field: 'bad' } } }),
    getToken: () => 'stored',
    onUnauthorized: (error) => expired.push(error),
  })
  await assert.rejects(make(401).request('/auth/me'), (error) => error instanceof ApiError && error.status === 401 && error.message === 'nope' && error.details.field === 'bad')
  assert.equal(expired.length, 1)
  await assert.rejects(make(401).request('/auth/me', { token: 'explicit' }), { status: 401 })
  await assert.rejects(make(401).request('/auth/login', { method: 'POST', body: {}, token: null }), { status: 401 })
  await assert.rejects(make(403).request('/x'), { status: 403 })
  await assert.rejects(make(404).request('/x'), { status: 404 })
  assert.equal(expired.length, 1, 'only the stored-token 401 triggers the handler')
  // No token stored: a 401 is just an error (nothing to expire).
  const anonymous = createApiClient({ baseUrl: 'https://api.test/api', fetchImpl: async () => reply(401, {}), getToken: () => null, onUnauthorized: (e) => expired.push(e) })
  await assert.rejects(anonymous.request('/x'), { status: 401 })
  assert.equal(expired.length, 1)
})

test('API client: unconfigured address sends nothing (and never falls back to localhost); network errors are explicit', async () => {
  const { calls, fetchImpl } = recorder(() => reply(200, {}))
  for (const baseUrl of [null, '', undefined]) {
    const client = createApiClient({ baseUrl, fetchImpl, getToken: () => 'secret' })
    await assert.rejects(client.request('/auth/me'), (error) => error.kind === 'not-configured' && error.status === null)
  }
  assert.equal(calls.length, 0, 'no request, so the token is never sent anywhere')
  const down = createApiClient({ baseUrl: 'https://api.test/api', fetchImpl: async () => { throw new TypeError('fetch failed') }, getToken: () => null })
  await assert.rejects(down.request('/x'), (error) => error.kind === 'network' && /Cannot reach the server/.test(error.message))
  const original = read(join(ORIGINAL, 'config.js'))
  assert.ok(original.includes('localhost:5000'), 'sanity: the original did fall back to localhost')
  const feature = [join(FEATURE, 'api', 'client.js'), join(WEB, 'src', 'config.js')].map(read).join('\n')
  assert.ok(!/localhost/.test(feature.replace(/\/\/.*$/gm, '')), 'the unified client has no localhost fallback')
})

// ---------- Access guards (decision only; the backend enforces roles) ----------

const base = { status: 'authenticated', isStudent: false, isTrainer: false, fullPath: '/eduyarp/dashboard?x=1', next: null }

test('guards: public pages never wait for or require a session', () => {
  for (const status of ['checking', 'anonymous', 'authenticated']) assert.deepEqual(resolveAccess({ ...base, access: 'public', status }), { type: 'page' })
})

test('guards: while the stored token is being verified, protected pages show a loader and nothing private renders', () => {
  for (const access of ['guest', 'student', 'trainer', 'account']) assert.deepEqual(resolveAccess({ ...base, access, status: 'checking' }), { type: 'loading' })
})

test('guards: signed-out visitors are sent to login with the page they wanted', () => {
  for (const access of ['student', 'trainer', 'account']) {
    assert.deepEqual(resolveAccess({ ...base, access, status: 'anonymous' }), { type: 'redirect', to: '/eduyarp/login?next=%2Feduyarp%2Fdashboard%3Fx%3D1' })
  }
  assert.deepEqual(resolveAccess({ ...base, access: 'guest', status: 'anonymous' }), { type: 'page' })
})

test('guards: signed-in users are bounced off login/register to their role home or a safe ?next=', () => {
  const student = { ...base, access: 'guest', isStudent: true }
  assert.deepEqual(resolveAccess(student), { type: 'redirect', to: '/eduyarp/dashboard' })
  assert.deepEqual(resolveAccess({ ...student, next: '/eduyarp/my-courses/4' }), { type: 'redirect', to: '/eduyarp/my-courses/4' })
  assert.deepEqual(resolveAccess({ ...student, next: 'https://evil.test' }), { type: 'redirect', to: '/eduyarp/dashboard' })
  assert.deepEqual(resolveAccess({ ...student, next: '/eduyarp/login' }), { type: 'redirect', to: '/eduyarp/dashboard' })
  assert.deepEqual(resolveAccess({ ...base, access: 'guest', isTrainer: true }), { type: 'redirect', to: '/eduyarp/trainer' })
  assert.deepEqual(resolveAccess({ ...base, access: 'guest' }), { type: 'redirect', to: '/eduyarp/courses' })
})

test('guards: role rules are not weakened', () => {
  const as = (role) => ({ ...base, isStudent: role === 'student', isTrainer: role === 'trainer' })
  assert.deepEqual(resolveAccess({ ...as('student'), access: 'student' }), { type: 'page' })
  assert.deepEqual(resolveAccess({ ...as('trainer'), access: 'student' }), { type: 'role-only', area: 'student' })
  assert.deepEqual(resolveAccess({ ...as('admin'), access: 'student' }), { type: 'role-only', area: 'student' })
  assert.deepEqual(resolveAccess({ ...as('trainer'), access: 'trainer' }), { type: 'page' })
  assert.deepEqual(resolveAccess({ ...as('student'), access: 'trainer' }), { type: 'role-only', area: 'trainer' })
  assert.deepEqual(resolveAccess({ ...as('admin'), access: 'trainer' }), { type: 'role-only', area: 'trainer' })
  for (const role of ['student', 'trainer', 'admin']) assert.deepEqual(resolveAccess({ ...as(role), access: 'account' }), { type: 'page' })
})

// ---------- Background behaviour: timers and listeners ----------

function fakeDocument(state = 'visible') {
  const listeners = new Map()
  return {
    visibilityState: state,
    addEventListener: (type, fn) => listeners.set(type, [...(listeners.get(type) ?? []), fn]),
    removeEventListener: (type, fn) => listeners.set(type, (listeners.get(type) ?? []).filter((x) => x !== fn)),
    count: (type) => (listeners.get(type) ?? []).length,
    fire: (type) => (listeners.get(type) ?? []).forEach((fn) => fn()),
  }
}

function fakeTimers() {
  let next = 1
  const active = new Map()
  return {
    setInterval: (fn, ms) => { const id = next++; active.set(id, { fn, ms }); return id },
    clearInterval: (id) => active.delete(id),
    active,
    tick: () => [...active.values()].forEach(({ fn }) => fn()),
  }
}

test('trainer polling: 30s interval while visible, one interval at a time, nothing while hidden', () => {
  const doc = fakeDocument('visible')
  const timers = fakeTimers()
  let refreshes = 0
  const stop = startVisibilityPolling({ doc, refresh: () => refreshes++, timers })
  assert.equal(timers.active.size, 1)
  assert.equal([...timers.active.values()][0].ms, 30_000)
  timers.tick()
  assert.equal(refreshes, 1)
  // Hidden: the interval is cleared and ticks (if any slipped through) refresh nothing.
  doc.visibilityState = 'hidden'
  doc.fire('visibilitychange')
  assert.equal(timers.active.size, 0)
  // Visible again: refresh immediately and restart a single interval.
  doc.visibilityState = 'visible'
  doc.fire('visibilitychange')
  assert.equal(refreshes, 2)
  assert.equal(timers.active.size, 1)
  doc.fire('visibilitychange')
  assert.equal(timers.active.size, 1, 'never more than one interval')
  assert.equal(refreshes, 3)
  stop()
  assert.equal(timers.active.size, 0, 'stopping clears the interval')
  assert.equal(doc.count('visibilitychange'), 0, 'stopping removes the listener')
})

test('trainer polling: a hidden tab starts no interval and does not refresh', () => {
  const doc = fakeDocument('hidden')
  const timers = fakeTimers()
  let refreshes = 0
  const stop = startVisibilityPolling({ doc, refresh: () => refreshes++, timers })
  assert.equal(timers.active.size, 0)
  assert.equal(doc.count('visibilitychange'), 1)
  stop()
  assert.equal(doc.count('visibilitychange'), 0)
  assert.equal(refreshes, 0)
})

test('trainer polling: remounting (leave and come back) leaves exactly one interval and one listener', () => {
  const doc = fakeDocument('visible')
  const timers = fakeTimers()
  for (let i = 0; i < 5; i++) startVisibilityPolling({ doc, refresh: () => {}, timers })()
  assert.equal(timers.active.size, 0)
  assert.equal(doc.count('visibilitychange'), 0)
  const stop = startVisibilityPolling({ doc, refresh: () => {}, timers })
  assert.equal(timers.active.size, 1)
  assert.equal(doc.count('visibilitychange'), 1)
  stop()
})

test('notification refresh: focus and visibility only while subscribed; fully removed on cleanup', () => {
  const doc = fakeDocument('visible')
  const win = fakeDocument()
  let refreshes = 0
  const stop = subscribeRefreshOnReturn({ win, doc, refresh: () => refreshes++ })
  win.fire('focus')
  assert.equal(refreshes, 1)
  doc.fire('visibilitychange')
  assert.equal(refreshes, 2)
  doc.visibilityState = 'hidden'
  doc.fire('visibilitychange')
  assert.equal(refreshes, 2, 'a hidden tab does not refresh')
  stop()
  assert.equal(win.count('focus'), 0)
  assert.equal(doc.count('visibilitychange'), 0)
  win.fire('focus')
  assert.equal(refreshes, 2)
})

// ---------- Learning, assignments, certificates-adjacent helpers, profile ----------

test('learning helpers: topic order, resume point and lookup (progress numbers come from the API)', async () => {
  const { defaultTopicEntry, findTopicEntry, flattenTopics } = await import('../src/features/eduyarp/utils/learning.js')
  const modules = [
    { id: 1, title: 'A', topics: [{ id: 10, completed: true }, { id: 11, completed: false }] },
    { id: 2, title: 'B', topics: [{ id: 20, completed: false }] },
  ]
  const flat = flattenTopics(modules)
  assert.deepEqual(flat.map((entry) => [entry.topic.id, entry.moduleIndex, entry.topicIndex, entry.position]), [[10, 0, 0, 0], [11, 0, 1, 1], [20, 1, 0, 2]])
  assert.equal(defaultTopicEntry(flat).topic.id, 11, 'resumes at the first incomplete topic')
  const done = flattenTopics(modules.map((m) => ({ ...m, topics: m.topics.map((t) => ({ ...t, completed: true })) })))
  assert.equal(defaultTopicEntry(done).topic.id, 10, 'all done: starts from the beginning')
  assert.equal(defaultTopicEntry([]), null)
  assert.equal(findTopicEntry(flat, 20).moduleTitle, 'B')
  assert.equal(findTopicEntry(flat, 99), null)
})

test('assignment helpers: submission state, local date-time conversion', async () => {
  const { fromLocalInput, submissionState, toLocalInput } = await import('../src/features/eduyarp/utils/assignments.js')
  assert.deepEqual(submissionState(assignmentFixtures.none), { key: 'none', label: 'Not submitted' })
  assert.deepEqual(submissionState(assignmentFixtures.onTime), { key: 'submitted', label: 'Submitted' })
  assert.deepEqual(submissionState(assignmentFixtures.late), { key: 'late', label: 'Submitted late' })
  assert.equal(toLocalInput(null), '')
  assert.equal(fromLocalInput(''), null)
  const iso = '2026-03-05T09:30:00.000Z'
  assert.equal(fromLocalInput(toLocalInput(iso)), iso)
})

test('resource and image URL checks mirror the backend rules', async () => {
  const { checkImageUrl } = await import('../src/features/eduyarp/utils/imageUrl.js')
  const { checkResourceUrl, groupResources, hostOf } = await import('../src/features/eduyarp/utils/resources.js')
  assert.equal(checkImageUrl(''), null)
  assert.equal(checkImageUrl('https://example.com/a.png'), null)
  for (const bad of ['ftp://x.test', 'https://user:pw@x.test', 'https://x.test/a b', 'javascript:alert(1)', `https://x.test/${'a'.repeat(2050)}`]) assert.ok(checkImageUrl(bad), bad)
  assert.equal(checkResourceUrl('  '), 'Address is required')
  assert.equal(hostOf('https://www.example.com/a/b'), 'example.com')
  assert.equal(hostOf('nope'), '')
  const groups = groupResources([{ id: 1, moduleId: null }, { id: 2, moduleId: 5, moduleTitle: 'M' }, { id: 3, moduleId: 5, moduleTitle: 'M' }])
  assert.deepEqual(groups.map((g) => [g.title, g.items.length]), [['Whole course', 1], ['M', 2]])
})

test('profile and password forms: validation, payload and the token-replacing password change contract', async () => {
  const { formToPayload, profileToForm, validatePasswordForm, validateProfileForm } = await import('../src/features/eduyarp/utils/profile.js')
  const form = profileToForm({ fullName: 'Asha Rao', phone: null, graduationYear: 2025, studyLevel: 'pg' })
  assert.equal(form.graduationYear, '2025')
  assert.deepEqual(validateProfileForm(form), {})
  assert.equal(formToPayload(form).phone, null)
  assert.equal(formToPayload(form).graduationYear, 2025)
  assert.ok(validateProfileForm({ ...form, fullName: ' ' }).fullName)
  assert.ok(validateProfileForm({ ...form, phone: 'abc' }).phone)
  assert.ok(validateProfileForm({ ...form, graduationYear: '1900' }).graduationYear)
  assert.deepEqual(validatePasswordForm({ currentPassword: 'old-password', newPassword: 'new-password', confirmPassword: 'new-password' }), {})
  assert.ok(validatePasswordForm({ currentPassword: 'a', newPassword: 'short', confirmPassword: 'short' }).newPassword)
  assert.ok(validatePasswordForm({ currentPassword: 'same-password', newPassword: 'same-password', confirmPassword: 'same-password' }).newPassword)
  assert.ok(validatePasswordForm({ currentPassword: 'a', newPassword: 'new-password', confirmPassword: 'different' }).confirmPassword)
  // Changing the password returns a fresh token that the page stores under the same key (ProfilePage).
  assert.match(read(join(FEATURE, 'pages', 'ProfilePage.jsx')), /setToken\(result\.token\)/)
  assert.match(read(join(FEATURE, 'api', 'endpoints.js')), /changePassword[\s\S]*\/me\/password/)
})

test('API error splitting keeps field errors and form-level messages (unchanged helper)', async () => {
  const { splitApiError } = await import('../src/features/eduyarp/utils/errors.js')
  assert.deepEqual(splitApiError({ details: { email: 'Bad', other: 'Extra' }, message: 'm' }, ['email']), { fieldErrors: { email: 'Bad' }, formError: 'Extra' })
  assert.deepEqual(splitApiError({ message: 'Down' }, ['email']), { fieldErrors: {}, formError: 'Down' })
})
