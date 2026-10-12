// Unit tests for the shell's pure logic with node:test (no browser, no network).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findPlatform, normalisePlatforms } from '../src/api/platforms.js'
import { normaliseApiBase, toAppPath, toHttpUrl } from '../src/lib/url.js'
import { parseTo, stripBase, withBase } from '../src/router/paths.js'

test('toHttpUrl accepts only http(s) URLs with a host', () => {
  assert.equal(toHttpUrl('https://example.com/a'), 'https://example.com/a')
  assert.equal(toHttpUrl('  http://example.com '), 'http://example.com/')
  for (const bad of ['', '   ', '/fitness', 'javascript:alert(1)', 'data:text/html,x', 'ftp://x.test', 'http://', null, undefined, 5]) {
    assert.equal(toHttpUrl(bad), null, String(bad))
  }
})

test('toAppPath accepts only same-site paths', () => {
  assert.equal(toAppPath('/fitness'), '/fitness')
  assert.equal(toAppPath('/fitness?x=1#y'), '/fitness?x=1#y')
  for (const bad of ['', 'fitness', '//evil.test', '/\\evil.test', '/a b', 'https://x.test', null]) {
    assert.equal(toAppPath(bad), null, String(bad))
  }
})

test('normaliseApiBase needs an http(s) URL and drops trailing slashes', () => {
  assert.equal(normaliseApiBase('https://api.example.com/api/'), 'https://api.example.com/api')
  assert.equal(normaliseApiBase(''), null)
  assert.equal(normaliseApiBase(undefined), null)
  assert.equal(normaliseApiBase('/api'), null)
})

test('stripBase, withBase and parseTo handle the root and a sub-path base', () => {
  assert.equal(stripBase('/fitness', ''), '/fitness')
  assert.equal(stripBase('', ''), '/')
  assert.equal(stripBase('/eduyog/', '/eduyog'), '/')
  assert.equal(stripBase('/eduyog', '/eduyog'), '/')
  assert.equal(stripBase('/eduyog/fitness', '/eduyog'), '/fitness')
  assert.equal(stripBase('/eduyogx/fitness', '/eduyog'), null)
  assert.equal(stripBase('/other', '/eduyog'), null)
  assert.equal(withBase('/#about', ''), '/#about')
  assert.equal(withBase('/#about', '/eduyog'), '/eduyog/#about')
  assert.deepEqual(parseTo('/fitness?x=1#y'), { path: '/fitness', search: '?x=1', hash: '#y' })
})

test('normalisePlatforms keeps well-formed items and nulls non-http(s) URLs', () => {
  const result = normalisePlatforms({
    platforms: [
      { name: ' Saritex ', slug: 'SariTex', url: 'https://saritex.example', extra: 1 },
      { name: 'Bad', slug: 'bad', url: 'javascript:alert(1)' },
      { name: '', slug: 'noname', url: 'https://x.test' },
      null,
    ],
  })
  assert.deepEqual(result, [
    { name: 'Saritex', slug: 'saritex', url: 'https://saritex.example/' },
    { name: 'Bad', slug: 'bad', url: null },
  ])
  assert.throws(() => normalisePlatforms({}))
  assert.throws(() => normalisePlatforms(null))
})

test('findPlatform matches by slug, then by name', () => {
  const platforms = [
    { name: 'Eduyarp', slug: 'eduyarp', url: null },
    { name: 'Saritex Academic', slug: 'other', url: null },
  ]
  assert.equal(findPlatform(platforms, { slug: 'EDUYARP', name: 'x' }), platforms[0])
  assert.equal(findPlatform(platforms, { slug: 'saritex', name: 'Saritex Academic' }), platforms[1])
  assert.equal(findPlatform(platforms, { slug: 'nope', name: 'nope' }), null)
})
