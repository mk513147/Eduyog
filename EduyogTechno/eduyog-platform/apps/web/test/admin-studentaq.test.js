// Admin "StudentAQ Enquiries" page: route, sidebar link, API call and page states. Source and route
// table checks only (no browser, no network, no database); the endpoint itself is covered by
// backend/test/studentaqEnquiryAdmin.test.js.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ROUTES, resolveRoute } from '../src/routes.js'

const FEATURE = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'features', 'admin')
const read = (...parts) => readFileSync(join(FEATURE, ...parts), 'utf8')

test('route: /admin/studentaq-enquiries is an Admin-only route mapped to its page', () => {
  const route = ROUTES.find((candidate) => candidate.id === 'admin-studentaq-enquiries')
  assert.equal(route.path, '/admin/studentaq-enquiries')
  assert.equal(route.module, 'admin')
  assert.equal(route.access, 'admin')
  assert.equal(resolveRoute('/admin/studentaq-enquiries/').id, 'admin-studentaq-enquiries')
  assert.match(read('AdminApp.jsx'), /'admin-studentaq-enquiries': StudentaqEnquiriesPage,/)
})

test('sidebar: StudentAQ Enquiries sits right after Fitness Leads', () => {
  const layout = read('components', 'Layout.jsx')
  const fitness = layout.indexOf("label: 'Fitness Leads'")
  const studentaq = layout.indexOf("{ to: '/admin/studentaq-enquiries', label: 'StudentAQ Enquiries'")
  assert.ok(fitness > 0 && studentaq > fitness)
  assert.equal(layout.slice(fitness, studentaq).split('\n').length, 2, 'adjacent items')
})

test('API: the Admin client calls the Admin-only endpoint; Fitness Leads calls are unchanged', () => {
  const endpoints = read('api', 'endpoints.js')
  assert.match(endpoints, /request\('\/admin\/studentaq-enquiries\?limit=100'\)/)
  assert.doesNotMatch(endpoints, /request\('\/studentaq-enquiries/)
  assert.match(endpoints, /request\('\/admin\/fitness-leads'\)\.then\(\(d\) => d\.leads\)/)
  assert.match(endpoints, /request\(`\/admin\/fitness-leads\/\$\{id\}`\)/)
})

test('page: loading, error with retry, empty and populated states, real data only', () => {
  const page = read('pages', 'StudentaqEnquiriesPage.jsx')
  for (const needle of [
    'if (loading) content = <LoadingState',
    'else if (error && !data) content = <ErrorState error={error} onRetry={reload} />',
    'enquiries.length === 0',
    '<EmptyState',
    'enquiries.map((enquiry)',
    'useResource(studentaqEnquiriesApi.list)',
    'formatDateTime(enquiry.createdAt)',
    'cell-break',
  ]) {
    assert.ok(page.includes(needle), needle)
  }
  assert.doesNotMatch(page, /mock|sample|lorem/i)
  // Only fields that exist in database/schema/014_studentaq_enquiries.sql are displayed.
  const fields = [...page.matchAll(/\{ key: '(\w+)'/g)].map((match) => match[1])
  assert.deepEqual(fields, ['fullName', 'email', 'phone', 'currentCountry', 'status', 'targetCountry', 'university', 'course', 'services', 'message'])
})
