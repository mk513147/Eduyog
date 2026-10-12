// Admin integration tests (node:test): route inventory against the ORIGINAL app's source, route prefixing
// and constraints, the access guard, session/token isolation between Admin, Eduyarp and the rest of the
// app, 401/403 handling, source parity with the original auth code, and the pure Admin helpers. The Admin
// auto-refresh tests are in test/admin-autorefresh.test.js (ported unchanged). No browser, no network:
// fetch and storage are fakes. Flows against a mock API run in a real browser (see README); nothing here
// talks to the real backend or database.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createApiClient } from '../src/api/createClient.js'
import { resolveAdminAccess } from '../src/features/admin/access.js'
import { ADMIN_NOT_FOUND, NOT_FOUND, ROUTES, eduyarpDestination, resolveRoute, safeNextPath } from '../src/routes.js'

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..')
const ORIGINAL = join(WEB, '..', 'admin', 'src')
const FEATURE = join(WEB, 'src', 'features', 'admin')
const read = (file) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
const adminRoutes = ROUTES.filter((route) => route.module === 'admin')

const walk = (dir, filter = () => true) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full, filter) : filter(full) ? [full] : []
  })

// ---------- Route inventory (against the original source) ----------

function originalRoutes() {
  const app = read(join(ORIGINAL, 'App.jsx'))
  const table = app.slice(app.indexOf('const PROTECTED_ROUTES'), app.indexOf('const PARAM_ROUTES'))
  const protectedRoutes = [...table.matchAll(/^ {2}'([^']+)': (\w+),$/gm)].map(([, path, page]) => ({ path, page }))
  const param = app.match(/pattern: \/\^\\\/eduyarp\\\/courses\\\/\(\\d\+\)\$\/, Page: (\w+)/)
  return { protectedRoutes, courseDetailPage: param?.[1], loginPath: app.includes("path === '/login'") ? '/login' : null }
}

function unifiedPages() {
  const app = read(join(FEATURE, 'AdminApp.jsx'))
  return Object.fromEntries([...app.matchAll(/^ {2}'([\w-]+)': (\w+),$/gm)].map(([, id, page]) => [id, page]))
}

test('every one of the original Admin routes (11 protected + course detail + login) is registered with the same page', () => {
  assert.equal(adminRoutes.some((route) => route.id === 'admin-registrations'), true, 'the one added route is the registrations review')
  const original = originalRoutes()
  assert.equal(original.protectedRoutes.length, 11, 'the original has 11 flat protected routes')
  assert.equal(original.courseDetailPage, 'CourseDetailPage')
  assert.equal(original.loginPath, '/login')
  const pages = unifiedPages()
  assert.equal(adminRoutes.length, 14, '11 + course detail + login + registrations (approval workflow)')
  for (const old of original.protectedRoutes) {
    const route = adminRoutes.find((candidate) => candidate.adminLegacy === old.path)
    assert.ok(route, `no unified route for ${old.path}`)
    assert.equal(route.access, 'admin', old.path)
    assert.equal(pages[route.id], old.page, `${old.path}: page`)
  }
  const detail = adminRoutes.find((route) => route.adminLegacy === '/eduyarp/courses/:id')
  assert.equal(pages[detail.id], 'CourseDetailPage')
  assert.deepEqual(adminRoutes.find((route) => route.adminLegacy === '/login'), { ...adminRoutes.find((route) => route.id === 'admin-login') })
  assert.equal(adminRoutes.find((route) => route.id === 'admin-login').access, 'guest')
  assert.equal(pages['admin-not-found'], 'NotFoundPage')
  assert.equal(new Set(adminRoutes.map((route) => route.id)).size, 14)
  assert.equal(new Set(adminRoutes.map((route) => route.path)).size, 14)
})

test('the unified Admin route map: everything is under /admin', () => {
  assert.deepEqual(Object.fromEntries(adminRoutes.map((route) => [route.adminLegacy, route.path])), {
    '/login': '/admin/login',
    '/': '/admin',
    '/platforms': '/admin/platforms',
    '/services': '/admin/services',
    '/users': '/admin/users',
    '/registrations': '/admin/registrations',
    '/fitness-leads': '/admin/fitness-leads',
    '/eduyarp/courses': '/admin/eduyarp/courses',
    '/eduyarp/courses/:id': '/admin/eduyarp/courses/:id',
    '/eduyarp/trainers': '/admin/eduyarp/trainers',
    '/eduyarp/enrolments': '/admin/eduyarp/enrolments',
    '/eduyarp/classes': '/admin/eduyarp/classes',
    '/eduyarp/announcements': '/admin/eduyarp/announcements',
    '/eduyarp/certificates': '/admin/eduyarp/certificates',
  })
  for (const route of adminRoutes) assert.ok(route.path === '/admin' || route.path.startsWith('/admin/'), route.path)
})

test('every Admin route resolves (trailing slash too); the course id must be digits only, as before', () => {
  for (const route of adminRoutes) {
    const path = route.path.replace(':id', '12')
    for (const candidate of [path, `${path}/`]) {
      const resolved = resolveRoute(candidate)
      assert.equal(resolved.id, route.id, candidate)
      assert.equal(resolved.layout, 'none')
      assert.equal(resolved.module, 'admin')
    }
  }
  assert.equal(resolveRoute('/admin/eduyarp/courses/12').params.id, '12')
  for (const bad of ['/admin/eduyarp/courses/abc', '/admin/eduyarp/courses/12abc', '/admin/eduyarp/courses/-1', '/admin/eduyarp/courses/1/2']) {
    assert.equal(resolveRoute(bad), ADMIN_NOT_FOUND, bad)
  }
})

test('unknown paths inside /admin get the Admin not-found (behind the login); look-alikes are the shell\'s', () => {
  for (const path of ['/admin/nope', '/admin/users/1', '/admin/eduyarp', '/admin/login/x']) assert.equal(resolveRoute(path), ADMIN_NOT_FOUND, path)
  assert.equal(ADMIN_NOT_FOUND.access, 'admin')
  for (const path of ['/administrator', '/admins', '/login', '/users', '/platforms', '/fitness-leads', '/eduyarp/courses/1/admin']) {
    assert.notEqual(resolveRoute(path).module, 'admin', path)
  }
  assert.equal(resolveRoute('/users'), NOT_FOUND, 'the old unprefixed Admin paths are not routes')
})

test('Admin is not reachable through Eduyarp\'s ?next= or notification-link handling', () => {
  for (const path of ['/admin', '/admin/users', '/admin/login', '/admin/eduyarp/courses/1']) {
    assert.equal(eduyarpDestination(path), null, path)
    assert.equal(safeNextPath(path, '/fallback'), '/fallback', path)
  }
})

test('every internal Admin link and nav entry resolves to an Admin route', () => {
  const offenders = []
  const unprefixed = []
  for (const file of walk(FEATURE, (f) => /\.(jsx?|js)$/.test(f) && !f.includes(join('features', 'admin', 'api')))) {
    read(file).split('\n').forEach((line, index) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return
      for (const [, literal] of line.matchAll(/[`'"](\/admin(?:\/[\w${}.[\]()-]*)*)[`'"]/g)) {
        const sample = literal.replace(/\$\{[^}]*\}/g, '12')
        const route = resolveRoute(sample)
        if (route.module !== 'admin' || route.id === 'admin-not-found') offenders.push(`${file.replace(WEB, '')}:${index + 1}: ${literal}`)
      }
      if (/["'`]\/(platforms|services|users|fitness-leads|eduyarp)(?=[/"'`?]|\$\{)/.test(line) || /(to=|to:|navigate\()\s*\{?["'`]\/["'`]/.test(line)) unprefixed.push(`${file.replace(WEB, '')}:${index + 1}: ${line.trim()}`)
    })
  }
  assert.deepEqual(offenders, [])
  assert.deepEqual(unprefixed, [], 'no unprefixed legacy Admin path may remain')
  const layout = read(join(FEATURE, 'components', 'Layout.jsx'))
  const navTargets = [...layout.matchAll(/to: '([^']+)'/g)].map((m) => m[1])
  assert.equal(navTargets.length, 12, 'the sidebar has 11 original entries plus Registrations')
  for (const target of navTargets) assert.equal(resolveRoute(target).module, 'admin', target)
})

// ---------- Access guard ----------

test('guard: nothing renders and nothing private is requested until the stored token is verified', () => {
  for (const routeId of ['admin-login', 'admin-overview', 'admin-users', 'admin-not-found']) assert.deepEqual(resolveAdminAccess({ status: 'checking', routeId }), { type: 'loading' })
})

test('guard: signed-out visitors (and non-admins, whose session never becomes "authenticated") are sent to /admin/login', () => {
  for (const routeId of adminRoutes.filter((route) => route.id !== 'admin-login').map((route) => route.id).concat('admin-not-found')) {
    assert.deepEqual(resolveAdminAccess({ status: 'anonymous', routeId }), { type: 'redirect', to: '/admin/login' }, routeId)
  }
  assert.deepEqual(resolveAdminAccess({ status: 'anonymous', routeId: 'admin-login' }), { type: 'login' })
})

test('guard: an authenticated administrator gets the page; the login page redirects to the dashboard', () => {
  for (const route of adminRoutes.filter((r) => r.id !== 'admin-login')) assert.deepEqual(resolveAdminAccess({ status: 'authenticated', routeId: route.id }), { type: 'page' }, route.id)
  assert.deepEqual(resolveAdminAccess({ status: 'authenticated', routeId: 'admin-not-found' }), { type: 'page' })
  assert.deepEqual(resolveAdminAccess({ status: 'authenticated', routeId: 'admin-login' }), { type: 'redirect', to: '/admin' })
})

// ---------- Source parity with the original (auth, API contract, polling) ----------

test('auth, session, endpoints and polling code are unchanged from the original Admin app', () => {
  for (const file of [
    'auth/AuthProvider.jsx', 'auth/AuthContext.js', 'auth/useAuth.js', 'api/session.js',
    'hooks/autoRefresh.js', 'hooks/useAutoRefresh.js', 'hooks/useResource.js', 'utils/errors.js', 'utils/imageUrl.js', 'utils/dashboard.js',
    'toast/ToastProvider.jsx',
  ]) {
    assert.equal(read(join(FEATURE, file)), read(join(ORIGINAL, file)), `${file} differs from the original`)
  }
})


test('Admin endpoints: every original call is unchanged; only the documented approval, access-grant and certificate-request calls were added', () => {
  const current = read(join(FEATURE, 'api/endpoints.js'))
  // Remove exactly the added blocks; what is left must be the original file, byte for byte.
  const stripped = current
    .replace(/\n {2}\/\/ Student registrations awaiting[\s\S]*?d\.user\),\n(?=\}\n\nexport const leadsApi)/, '\n')
    .replace(/ {4}\/\/ Full-course access: creates[\s\S]*?d\.enrolment\),\n(?= {4}cancel:)/, '')
    .replace(/ {4}requests: \{[\s\S]*?\n {4}\},\n(?= {4}revoke:)/, '')
  assert.equal(stripped, read(join(ORIGINAL, 'api/endpoints.js')))
  for (const added of ['registrations:', 'decideApproval:', 'grant:', 'requests: {']) assert.ok(current.includes(added), added)
})

test('the original Admin login rules are intact: role from /auth/me, non-admins rejected, 401 vs 403 notices', () => {
  const code = read(join(FEATURE, 'auth', 'AuthProvider.jsx'))
  assert.match(code, /const NOT_ADMIN = 'This account does not have Admin access\.'/)
  assert.match(code, /user\.role === 'admin'/)
  assert.match(code, /if \(user\.role !== 'admin'\) \{\s*throw new ApiError\(403, NOT_ADMIN\)/)
  assert.match(code, /error\.status === 401\) logout\(SESSION_EXPIRED\)/)
  assert.match(code, /error\.status === 403\) logout\(ACCESS_REVOKED\)/)
  assert.match(code, /setToken\(token\)[\s\S]*setState\(\{ status: 'authenticated', user \}\)/)
  // the token is stored only after the role is confirmed
  assert.ok(code.indexOf("user.role !== 'admin'") < code.indexOf('setToken(token)'))
})

// ---------- Token isolation ----------

function fakeStorage(initial = {}) {
  const store = new Map(Object.entries(initial))
  globalThis.sessionStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) }
  return store
}

test('Admin and Eduyarp keep separate token keys: logging out of one never clears the other', async () => {
  const store = fakeStorage()
  const admin = await import('../src/features/admin/api/session.js')
  const eduyarp = await import('../src/features/eduyarp/api/session.js')
  admin.setToken('admin-token')
  eduyarp.setToken('student-token')
  assert.deepEqual([...store.keys()].sort(), ['eduyarp_token', 'eduyog_admin_token'])
  assert.equal(admin.getToken(), 'admin-token')
  assert.equal(eduyarp.getToken(), 'student-token')
  admin.clearToken() // Admin logout
  assert.equal(admin.getToken(), null)
  assert.equal(eduyarp.getToken(), 'student-token', 'Eduyarp session survives Admin logout')
  admin.setToken('admin-token')
  eduyarp.clearToken() // Eduyarp logout
  assert.equal(eduyarp.getToken(), null)
  assert.equal(admin.getToken(), 'admin-token', 'Admin session survives Eduyarp logout')
  delete globalThis.sessionStorage
})

test('a student/trainer (Eduyarp) token cannot act as an Admin session, and the Admin token never goes to Eduyarp', async () => {
  fakeStorage({ eduyarp_token: 'student-token' })
  const admin = await import('../src/features/admin/api/session.js')
  assert.equal(admin.getToken(), null, 'Admin reads only eduyog_admin_token')
  delete globalThis.sessionStorage
  fakeStorage({ eduyog_admin_token: 'admin-token' })
  const eduyarp = await import('../src/features/eduyarp/api/session.js')
  assert.equal(eduyarp.getToken(), null, 'Eduyarp reads only eduyarp_token')
  delete globalThis.sessionStorage
})

test('each feature\'s client sends only its own token; the default client and public calls send none', async () => {
  const sent = []
  const fetchImpl = async (url, init) => (sent.push({ url, auth: init.headers.Authorization ?? null }), { ok: true, status: 200, json: async () => ({}) })
  const base = 'https://api.test/api'
  const adminClient = createApiClient({ baseUrl: base, fetchImpl, getToken: () => 'ADMIN' })
  const eduyarpClient = createApiClient({ baseUrl: base, fetchImpl, getToken: () => 'STUDENT' })
  const defaultClient = createApiClient({ baseUrl: base, fetchImpl })
  await adminClient.request('/admin/users')
  await eduyarpClient.request('/eduyarp/me/courses')
  await defaultClient.get('/platforms')
  await defaultClient.post('/fitness-leads', {})
  await adminClient.request('/auth/login', { method: 'POST', body: {}, token: null })
  assert.deepEqual(sent.map((s) => s.auth), ['Bearer ADMIN', 'Bearer STUDENT', null, null, null])
  // the real wiring: each feature's client reads its own session module, and no file mixes them up
  const adminClientSource = read(join(FEATURE, 'api', 'client.js'))
  const eduyarpClientSource = read(join(WEB, 'src', 'features', 'eduyarp', 'api', 'client.js'))
  assert.match(adminClientSource, /import \{ getToken \} from '\.\/session'/)
  assert.match(eduyarpClientSource, /import \{ getToken \} from '\.\/session'/)
  assert.match(read(join(WEB, 'src', 'api', 'client.js')), /createApiClient\(\{ baseUrl: API_BASE_URL \}\)/, 'the default client has no token source')
})

test('features never import each other\'s session or client, and only their own module names a token key', () => {
  const srcRoot = join(WEB, 'src')
  const problems = []
  for (const file of walk(srcRoot, (f) => /\.(jsx?|js)$/.test(f))) {
    const code = read(file)
    const rel = file.replace(srcRoot, '').replace(/\\/g, '/')
    const inAdmin = rel.startsWith('/features/admin/')
    const inEduyarp = rel.startsWith('/features/eduyarp/')
    if (!inAdmin && /eduyog_admin_token/.test(code)) problems.push(`${rel}: names the Admin token key`)
    if (!inEduyarp && /eduyarp_token/.test(code)) problems.push(`${rel}: names the Eduyarp token key`)
    if (inAdmin && /features\/eduyarp|\.\.\/eduyarp\/(api|auth)/.test(code)) problems.push(`${rel}: imports Eduyarp code`)
    if (inEduyarp && /features\/admin/.test(code)) problems.push(`${rel}: imports Admin code`)
    if (!inAdmin && !rel.startsWith('/features/admin') && /from '[./]*\/?(\.\.\/)*features\/admin\/(api|auth)/.test(code)) problems.push(`${rel}: imports Admin api/auth`)
    if (inAdmin && /\bgetToken\b/.test(code) && !/\/api\/(client|session)\.js$|\/auth\/AuthProvider\.jsx$/.test(rel)) problems.push(`${rel}: reads a token`)
  }
  assert.deepEqual(problems, [])
})

// ---------- 401/403 handling ----------

const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => { if (body === undefined) throw new SyntaxError('empty'); return body } })

test('Admin client: 401 and 403 on the stored token end the session; 400/404/409/500, explicit tokens and no token do not', async () => {
  const ended = []
  const make = (status, getToken = () => 'ADMIN') =>
    createApiClient({
      baseUrl: 'https://api.test/api',
      fetchImpl: async () => reply(status, { error: { message: 'nope', details: { f: 'bad' } } }),
      getToken,
      onUnauthorized: (error) => ended.push(error.status),
      authFailureStatuses: [401, 403],
    })
  await assert.rejects(make(401).request('/admin/users'), { status: 401, message: 'nope' })
  await assert.rejects(make(403).request('/admin/users'), { status: 403 })
  assert.deepEqual(ended, [401, 403])
  for (const status of [400, 404, 409, 500]) await assert.rejects(make(status).request('/admin/users'), { status })
  await assert.rejects(make(403).request('/auth/me', { token: 'explicit' }), { status: 403 })
  await assert.rejects(make(401).request('/admin/users', { token: null }), { status: 401 })
  await assert.rejects(make(403, () => null).request('/admin/users'), { status: 403 })
  assert.deepEqual(ended, [401, 403], 'nothing else triggered the handler')
})

test('Admin client: error details survive, the original network message is kept, an unset API address sends nothing', async () => {
  const client = createApiClient({
    baseUrl: 'https://api.test/api',
    fetchImpl: async () => reply(400, { error: { message: 'Validation failed', details: { name: 'Required' } } }),
    getToken: () => 'T',
    networkMessage: 'Cannot reach the server. Check that the backend is running.',
  })
  await assert.rejects(client.request('/admin/platforms', { method: 'POST', body: {} }), (error) => error.status === 400 && error.details.name === 'Required')
  const down = createApiClient({ baseUrl: 'https://api.test/api', fetchImpl: async () => { throw new TypeError('x') }, getToken: () => 'T', networkMessage: 'Cannot reach the server. Check that the backend is running.' })
  await assert.rejects(down.request('/admin/users'), (error) => error.kind === 'network' && error.message === 'Cannot reach the server. Check that the backend is running.')
  let called = 0
  const unset = createApiClient({ baseUrl: null, fetchImpl: async () => (called++, reply(200, {})), getToken: () => 'T' })
  await assert.rejects(unset.request('/admin/users'), { kind: 'not-configured' })
  assert.equal(called, 0, 'no request and the token is never sent')
  const noLocalhost = [join(FEATURE, 'api', 'client.js'), join(WEB, 'src', 'config.js')].map(read).join('\n').replace(/\/\/.*$/gm, '')
  assert.ok(!/localhost/.test(noLocalhost), 'no localhost fallback')
  assert.ok(read(join(ORIGINAL, 'config.js')).includes('localhost:5000'), 'sanity: the original did fall back')
})

test('the Admin ApiError constructor of the standalone app still works for AuthProvider', async () => {
  // client.js imports the app config (Vite-only), so check the shape the AuthProvider relies on by source.
  const code = read(join(FEATURE, 'api', 'client.js'))
  assert.match(code, /constructor\(status, message, details\)/)
  assert.match(code, /super\('http', message, status, details \|\| null\)/)
})

// ---------- Platform URL contract and Admin helpers ----------

test('platform URLs must be absolute http(s): an internal path such as /fitness is rejected by the Admin form check', async () => {
  const { checkImageUrl } = await import('../src/features/admin/utils/imageUrl.js')
  for (const bad of ['/fitness', '/studentaq/', 'fitness', '//evil.test', 'ftp://x.test', 'https://user:pw@x.test', 'javascript:alert(1)']) assert.ok(checkImageUrl(bad), bad)
  assert.equal(checkImageUrl('https://example.com/fitness'), null)
  // The platform form sends the URL exactly as typed (type="url"); the backend validator and the database
  // constraint require an absolute http(s) URL, and nothing here rewrites it to an internal path.
  const form = read(join(FEATURE, 'pages', 'PlatformFormModal.jsx'))
  assert.match(form, /type="url"/)
  assert.doesNotMatch(form, /\/fitness|\/studentaq|\/saritex|\/eduyarp|ROUTE_PATHS/)
})

test('dashboard figures are derived from the data (no hard-coded values)', async () => {
  const d = await import('../src/features/admin/utils/dashboard.js')
  const e = (id, status, student = id, course = 1) => ({ id, status, student: { id: student }, course: { id: course, title: `C${course}` } })
  const enrolments = [e(1, 'active', 1), e(2, 'active', 1), e(3, 'completed', 2), e(4, 'cancelled', 3, 2), e(5, 'active', 4, 2)]
  assert.deepEqual(d.enrolmentStatusCounts(enrolments), { active: 3, completed: 1, cancelled: 1, total: 5 })
  assert.equal(d.activeStudentCount(enrolments), 2)
  assert.deepEqual(d.enrolmentsByCourse(enrolments).map((r) => [r.courseId, r.total]), [[1, 3], [2, 1]])
  const now = new Date('2026-03-18T12:00:00Z').getTime()
  const day = 86_400_000
  const leads = [{ createdAt: new Date(now - 2 * day).toISOString() }, { createdAt: new Date(now - 40 * day).toISOString() }]
  assert.equal(d.leadsInLastDays(leads, 7, now), 1)
  assert.equal(d.leadsByWeek(leads, 4, now).reduce((sum, w) => sum + w.count, 0), 1, 'the 40-day-old lead is outside 4 weeks')
  assert.equal(d.leadsByWeek(leads, 8, now).reduce((sum, w) => sum + w.count, 0), 2, 'and inside 8 weeks')
  const classes = [
    { id: 1, status: 'scheduled', scheduledAt: new Date(now + day).toISOString() },
    { id: 2, status: 'cancelled', scheduledAt: new Date(now + 2 * day).toISOString() },
    { id: 3, status: 'scheduled', scheduledAt: new Date(now - day).toISOString() },
  ]
  assert.deepEqual(d.upcomingClasses(classes, now).map((c) => c.id), [1])
})

test('enrolment filters and slug/format helpers', async () => {
  const f = await import('../src/features/admin/utils/enrolmentFilters.js')
  const { slugify } = await import('../src/features/admin/utils/format.js')
  const { formatFee, ROLES } = await import('../src/features/admin/utils/labels.js')
  const list = [
    { status: 'active', student: { fullName: 'Asha Rao', email: 'asha@x.test' }, course: { id: 1, title: 'Data Science' } },
    { status: 'cancelled', student: { fullName: 'Bo Lee', email: 'bo@x.test' }, course: { id: 2, title: 'React' } },
  ]
  assert.equal(f.filterEnrolments(list, { search: 'asha', status: '', courseId: '' }).length, 1)
  assert.equal(f.filterEnrolments(list, { search: '', status: 'cancelled', courseId: '' }).length, 1)
  assert.equal(f.filterEnrolments(list, { search: '', status: '', courseId: '2' })[0].course.title, 'React')
  assert.equal(f.hasActiveFilters(f.EMPTY_FILTERS), false)
  assert.deepEqual(f.courseOptions(list).map((c) => c.title), ['Data Science', 'React'])
  assert.equal(slugify('  Data Science & AI!  '), 'data-science-ai')
  assert.equal(formatFee(0), 'Free')
  assert.deepEqual(ROLES, ['student', 'trainer', 'admin'])
})
