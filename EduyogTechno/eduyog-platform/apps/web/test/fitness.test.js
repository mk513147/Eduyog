// Tests for the Fitness integration with node:test: route registration, base-path handling, the
// "Become a Partner" destination, the API client and the enquiry logic. No browser and no network:
// fetch and the API's post() are fakes. Browser behaviour is covered separately (see README).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError, createApiClient } from '../src/api/createClient.js'
import { EMPTY_VALUES, FIELDS, GENERIC_ERROR, submitEnquiry, validate, validateField } from '../src/features/fitness/enquiry.js'
import { DEFAULT_PARTNER_PATH, resolvePartnerLink } from '../src/lib/partnerLink.js'
import { stripBase, withBase } from '../src/router/paths.js'
import { NOT_FOUND, ROUTES, ROUTE_PATHS, resolveRoute } from '../src/routes.js'

const EMAIL = 'team@example.test'

// ---------- Routes and base path ----------

test('the route table registers the homepage, /fitness and the Eduyarp routes', () => {
  const paths = ROUTES.map((route) => route.path)
  assert.deepEqual(paths.slice(0, 2), ['/', '/fitness'])
  assert.ok(paths.includes('/eduyarp') && paths.every((path) => !/^\/(saritex|studentaq)/.test(path)))
  assert.equal(resolveRoute('/').id, 'home')
  assert.equal(resolveRoute('/fitness').id, 'fitness')
  assert.equal(resolveRoute('/fitness/').id, 'fitness')
  assert.equal(resolveRoute('/fitness').layout, 'none')
  assert.equal(resolveRoute('/').layout, 'public')
})

test('unknown and future routes are not found', () => {
  for (const path of ['/fitness/x', '/administrator', '/studentaq', '/saritex', '/fitnessx', '/Fitness', '/eduyarpx', '/accounts', '/login']) {
    assert.equal(resolveRoute(path), NOT_FOUND, path)
  }
})

test('/fitness round-trips through a sub-path base', () => {
  for (const base of ['', '/eduyog', '/a/b']) {
    const href = withBase(ROUTE_PATHS.fitness, base)
    assert.equal(href, `${base}/fitness`)
    assert.equal(resolveRoute(stripBase(href, base)).id, 'fitness', base)
    assert.equal(resolveRoute(stripBase(`${href}/`, base)).id, 'fitness', base)
  }
  assert.equal(stripBase('/eduyog', '/eduyog'), '/')
  assert.equal(resolveRoute(stripBase('/eduyog/', '/eduyog')).id, 'home')
  assert.equal(stripBase('/fitness', '/eduyog'), null) // outside the base: not found
})

// ---------- Homepage partner links ----------

test('partner links resolve to the unified /fitness route by default', () => {
  for (const configuredUrl of [undefined, null, '', '   ', 'not a url', 'javascript:alert(1)', '//evil.test']) {
    assert.deepEqual(resolvePartnerLink({ configuredUrl }), { kind: 'internal', href: DEFAULT_PARTNER_PATH }, String(configuredUrl))
  }
  assert.equal(DEFAULT_PARTNER_PATH, ROUTE_PATHS.fitness)
})

test('partner link under a sub-path base is /<base>/fitness and never mailto or localhost', () => {
  const link = resolvePartnerLink({ configuredUrl: '' })
  assert.equal(link.kind, 'internal')
  assert.equal(withBase(link.href, '/eduyog'), '/eduyog/fitness')
  assert.ok(!JSON.stringify(link).includes('mailto'))
  assert.ok(!JSON.stringify(link).includes('localhost'))
})

test('VITE_FITNESS_URL can still override the destination', () => {
  assert.deepEqual(resolvePartnerLink({ configuredUrl: '/fitness-new' }), { kind: 'internal', href: '/fitness-new' })
  assert.deepEqual(resolvePartnerLink({ configuredUrl: 'https://fitness.example' }), {
    kind: 'external',
    href: 'https://fitness.example/',
  })
})

// ---------- API client ----------

function fakeFetch(responder) {
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url, init })
    return responder(url, init)
  }
  return { fetchImpl, calls }
}

const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

test('client: no request is made when the API is not configured', async () => {
  const { fetchImpl, calls } = fakeFetch(() => json(200, {}))
  for (const baseUrl of [null, '']) {
    const client = createApiClient({ baseUrl, fetchImpl })
    await assert.rejects(client.post('/fitness-leads', {}), { kind: 'not-configured' })
    await assert.rejects(client.get('/platforms'), { kind: 'not-configured' })
  }
  assert.equal(calls.length, 0)
})

test('client: POST sends JSON to the configured base, without credentials', async () => {
  const { fetchImpl, calls } = fakeFetch(() => json(201, { message: 'Enquiry received' }))
  const client = createApiClient({ baseUrl: 'https://api.example/api', fetchImpl })
  const body = await client.post('/fitness-leads', { email: 'a@b.co' })
  assert.deepEqual(body, { message: 'Enquiry received' })
  assert.equal(calls[0].url, 'https://api.example/api/fitness-leads')
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(calls[0].init.credentials, 'omit')
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json')
  assert.deepEqual(JSON.parse(calls[0].init.body), { email: 'a@b.co' })
})

test('client: a 2xx POST with a non-JSON body is still a success; a GET needs JSON', async () => {
  const noBody = { ok: true, status: 201, json: async () => { throw new SyntaxError('x') } }
  const client = createApiClient({ baseUrl: 'https://api.example/api', fetchImpl: async () => noBody })
  assert.equal(await client.post('/x', {}), null)
  await assert.rejects(client.get('/x'), { kind: 'format' })
})

test('client: HTTP errors keep status, field details and the server message', async () => {
  const details = { email: 'Enter a valid email' }
  const client = createApiClient({
    baseUrl: 'https://api.example/api',
    fetchImpl: async () => json(400, { error: { message: 'Validation failed', details } }),
  })
  await assert.rejects(client.post('/x', {}), (error) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.kind, 'http')
    assert.equal(error.status, 400)
    assert.deepEqual(error.details, details)
    assert.equal(error.serverMessage, 'Validation failed')
    return true
  })
})

test('client: a network failure is an ApiError, an abort is passed through', async () => {
  const down = createApiClient({ baseUrl: 'https://api.example/api', fetchImpl: async () => { throw new TypeError('fetch failed') } })
  await assert.rejects(down.post('/x', {}), { kind: 'network' })
  const aborted = createApiClient({
    baseUrl: 'https://api.example/api',
    fetchImpl: async () => { throw Object.assign(new Error('aborted'), { name: 'AbortError' }) },
  })
  await assert.rejects(aborted.get('/x'), { name: 'AbortError' })
})

// ---------- Enquiry validation ----------

const VALID = {
  businessName: 'Acme Gym',
  contactName: 'Asha Rao',
  email: 'asha@acme.test',
  phone: '',
  businessType: 'Gym',
  location: 'Pune',
  servicesOffered: 'Group classes',
  marketingRequirements: 'Social media',
  websiteLinks: '',
  marketingObjectives: 'More members',
  message: '',
}

test('field definitions match the backend request body', () => {
  assert.deepEqual(FIELDS.map((field) => field.name), Object.keys(VALID))
  assert.deepEqual(Object.keys(EMPTY_VALUES), Object.keys(VALID))
})

test('validation: required fields, optional fields, email, phone and length limits', () => {
  assert.deepEqual(validate(VALID), {})
  const empty = validate(EMPTY_VALUES)
  assert.deepEqual(
    Object.keys(empty),
    FIELDS.filter((field) => field.required).map((field) => field.name),
  )
  assert.equal(empty.businessName, 'Please enter your business name.')
  assert.ok(validate({ ...VALID, email: 'nope' }).email)
  assert.ok(validate({ ...VALID, phone: 'abc' }).phone)
  assert.ok(validate({ ...VALID, phone: '123' }).phone)
  assert.equal(validate({ ...VALID, phone: '+91 98765 43210' }).phone, undefined)
  const tooLong = FIELDS.find((field) => field.name === 'businessName')
  assert.equal(validateField(tooLong, 'x'.repeat(201)), 'Please keep this under 200 characters.')
  assert.equal(validateField(tooLong, '   '), 'Please enter your business name.')
})

// ---------- Enquiry submission outcomes ----------

test('submit: success resolves only when the post resolves, and sends the form values', async () => {
  const sent = []
  await submitEnquiry(VALID, { post: async (path, body) => { sent.push([path, body]) }, contactEmail: EMAIL })
  assert.deepEqual(sent, [['/fitness-leads', VALID]])
})

test('submit: not configured gives a clear message and the contact e-mail', async () => {
  const client = createApiClient({ baseUrl: null, fetchImpl: async () => assert.fail('must not be called') })
  await assert.rejects(submitEnquiry(VALID, { post: client.post, contactEmail: EMAIL }), (error) => {
    assert.ok(error.message.includes(EMAIL))
    assert.ok(error.message.includes('cannot be sent'))
    assert.equal(error.details, null)
    return true
  })
})

test('submit: HTTP 400 with details shows field errors; 429 shows the server message', async () => {
  const bad = createApiClient({
    baseUrl: 'https://api.example/api',
    fetchImpl: async () => json(400, { error: { message: 'Validation failed', details: { email: 'Invalid' } } }),
  })
  await assert.rejects(submitEnquiry(VALID, { post: bad.post, contactEmail: EMAIL }), (error) => {
    assert.equal(error.message, 'Please check the highlighted fields and try again.')
    assert.deepEqual(error.details, { email: 'Invalid' })
    return true
  })

  const limited = createApiClient({
    baseUrl: 'https://api.example/api',
    fetchImpl: async () => json(429, { error: { message: 'Too many enquiries, please try again later' } }),
  })
  await assert.rejects(submitEnquiry(VALID, { post: limited.post, contactEmail: EMAIL }), {
    message: 'Too many enquiries, please try again later',
  })
  const limitedNoBody = createApiClient({
    baseUrl: 'https://api.example/api',
    fetchImpl: async () => ({ ok: false, status: 429, json: async () => { throw new Error('no json') } }),
  })
  await assert.rejects(submitEnquiry(VALID, { post: limitedNoBody.post, contactEmail: EMAIL }), { message: GENERIC_ERROR })
})

test('submit: 500, 400 without details and network failure give the generic error, never success', async () => {
  for (const fetchImpl of [
    async () => json(500, { error: { message: 'Internal detail that must not be shown' } }),
    async () => json(400, { error: { message: 'Validation failed' } }),
    async () => { throw new TypeError('offline') },
  ]) {
    const client = createApiClient({ baseUrl: 'https://api.example/api', fetchImpl })
    await assert.rejects(submitEnquiry(VALID, { post: client.post, contactEmail: EMAIL }), (error) => {
      assert.equal(error.message, GENERIC_ERROR)
      assert.equal(error.details, null)
      return true
    })
  }
})
