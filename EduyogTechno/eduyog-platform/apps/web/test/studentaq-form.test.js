// StudentAQ enquiry form: submission behaviour (node:test, no browser, no network). The form script
// is loaded in a sandbox with a fake fetch, so nothing is ever sent anywhere. It covers the logic
// that decides success or failure; the DOM handlers around it are plain wiring.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const JS = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'studentaq', 'assets', 'js')
const source = (file) => readFileSync(join(JS, file), 'utf8')

const API = { enquiryPath: 'studentaq-enquiries', timeoutMs: 50 }
const FIELDS = [
  { name: 'fullName', type: 'text' },
  { name: 'email', type: 'email' },
  { name: 'services', type: 'checkbox' },
  { name: 'consent', type: 'consent' },
]
const VALUES = { fullName: 'Asha Rao', email: 'asha@example.com', services: ['LinkedIn profile'], consent: 'yes' }

// Loads enquiry-form.js with a fake window and fetch; returns its submit function and the fetch calls.
function load({ apiBaseUrl, respond }) {
  const calls = []
  const window = {
    EDUYOG_CONFIG: apiBaseUrl === undefined ? undefined : { apiBaseUrl },
    setTimeout,
    clearTimeout,
  }
  const stub = new Proxy({}, { get: () => () => '' })
  window.SAQ = { core: stub, icon: () => '', components: {} }
  const context = {
    window,
    AbortController,
    fetch: async (url, init) => {
      calls.push({ url, init })
      return respond(init)
    },
  }
  vm.runInNewContext(source('enquiry-form.js'), context)
  return { submit: window.SAQ.enquiryForm.submitToBackend, calls }
}

test('success only when the backend answers 201, posted as JSON to <apiBaseUrl>/studentaq-enquiries', async () => {
  const { submit, calls } = load({ apiBaseUrl: 'https://api.example.test/api/', respond: () => ({ status: 201 }) })
  await submit(API, FIELDS, VALUES, '')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://api.example.test/api/studentaq-enquiries')
  assert.equal(calls[0].init.method, 'POST')
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    website_url: '',
    fullName: 'Asha Rao',
    email: 'asha@example.com',
    services: ['LinkedIn profile'],
    consent: true,
  })
})

test('every non-201 answer is a failure (validation, rate limit, server error, even other 2xx)', async () => {
  for (const status of [200, 204, 400, 413, 429, 500]) {
    const { submit } = load({ apiBaseUrl: 'https://api.example.test/api', respond: () => ({ status }) })
    await assert.rejects(submit(API, FIELDS, VALUES, ''), /HTTP/, `status ${status}`)
  }
})

test('a network failure or a timeout is a failure', async () => {
  const offline = load({ apiBaseUrl: 'https://api.example.test/api', respond: () => Promise.reject(new TypeError('fetch failed')) })
  await assert.rejects(offline.submit(API, FIELDS, VALUES, ''), /fetch failed/)

  const slow = load({
    apiBaseUrl: 'https://api.example.test/api',
    respond: (init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))),
  })
  await assert.rejects(slow.submit(API, FIELDS, VALUES, ''), /aborted/)
})

test('without a configured API address nothing is sent and the submission fails', async () => {
  for (const apiBaseUrl of [undefined, '']) {
    const { submit, calls } = load({ apiBaseUrl, respond: () => ({ status: 201 }) })
    await assert.rejects(submit(API, FIELDS, VALUES, ''), /not configured/)
    assert.equal(calls.length, 0)
  }
})

test('the form blocks duplicate submits, validates first, and has no fake-success or WhatsApp auto fallback', () => {
  const text = source('enquiry-form.js')
  assert.match(text, /if \(isSubmitting\) return;/)
  // The success view is rendered only after the awaited backend call resolves.
  assert.ok(text.indexOf('await submitToBackend(') < text.indexOf('renderSuccess();\n        } catch'))
  assert.ok(!/docs\.google\.com|no-cors/.test(text))
  // WhatsApp appears only as a visible button in the error panel, never as an automatic redirect.
  assert.ok(!/window\.open|location\.(href|assign)/.test(text))
})
