// Static-site integration checks (node:test, no browser, no network). The StudentAQ and Saritex
// websites are served as separate HTML documents from public/studentaq and public/saritex.
// These tests verify, against the files on disk, that every page is present, every internal
// link/asset reference resolves with EXACT filename case (so it also works on case-sensitive
// hosting), nothing is root-absolute or points at localhost, third-party form configuration is
// consistent, and that the copies differ from the original websites/ sources only by the documented
// changes. Real third-party submissions are never made here.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, posix, relative } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = join(WEB, 'public')
const SOURCES = join(WEB, '..', '..', 'websites')

const PAGES = {
  studentaq: ['404.html', 'about.html', 'contact.html', 'destinations.html', 'index.html', 'privacy.html', 'services.html'],
  saritex: ['AboutUs.html', 'Blogs.html', 'ContactUs.html', 'Reviews.html', 'Services.html', 'index.html'],
}

// The ONLY files that differ from the originals (see README, "Static sites"). Anything else
// differing is a regression: the copies must stay faithful.
const EXPECTED_CHANGES = {
  studentaq: ['404.html', 'assets/js/data.js'],
  saritex: ['AboutUs.html', 'Blogs.html', 'ContactUs.html', 'Reviews.html', 'Services.html', 'index.html'],
}
// Present in the source folders but intentionally not published.
const NOT_PUBLISHED = { studentaq: ['.gitkeep', 'README.md'], saritex: ['.gitkeep'] }

function listFiles(root, dir = root) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...listFiles(root, full))
    else out.push(relative(root, full).split('\\').join('/'))
  }
  return out.sort()
}

const sha = (file) => createHash('sha1').update(readFileSync(file)).digest('hex')
const read = (site, file) => readFileSync(join(PUBLIC, site, file), 'utf8')

const FILES = Object.fromEntries(Object.keys(PAGES).map((site) => [site, new Set(listFiles(join(PUBLIC, site)))]))

// ---- reference extraction -------------------------------------------------------------------

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|$)/i // http:, mailto:, data:, javascript:, //host, #hash, empty
const ASSET_STRING = /["'`]((?:[\w .%()+-]+[\\/])+[\w .%()+-]+\.(?:png|jpe?g|webp|svg|gif|ico|pdf|html?|css|js|woff2?))["'`]/g

function htmlRefs(text) {
  const refs = []
  for (const match of text.matchAll(/\s(?:href|src|poster|data-image|data-src|action)\s*=\s*"([^"]*)"/gi)) refs.push(match[1])
  for (const match of text.matchAll(/\ssrcset\s*=\s*"([^"]*)"/gi)) {
    for (const part of match[1].split(',')) refs.push(part.trim().split(/\s+/)[0])
  }
  for (const match of text.matchAll(/<meta[^>]+(?:og:image|twitter:image)[^>]*content\s*=\s*"([^"]*)"/gi)) refs.push(match[1])
  for (const match of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) refs.push(match[1])
  for (const match of text.matchAll(ASSET_STRING)) refs.push(match[1])
  return refs
}

function cssRefs(text) {
  return [...text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)].map((match) => match[1])
}

function jsRefs(text) {
  return [...text.matchAll(ASSET_STRING)].map((match) => match[1])
}

// Resolves a reference found in `fromFile` (a path relative to the site root) to a site-relative
// path, normalising backslashes and %-escapes. Returns { kind, path }.
function resolveRef(fromFile, ref) {
  if (EXTERNAL.test(ref) || ref.includes('${')) return { kind: 'skip' }
  let clean = ref.replace(/\\/g, '/').split('#')[0].split('?')[0]
  try {
    clean = decodeURIComponent(clean)
  } catch {
    // keep as is
  }
  if (clean.startsWith('/')) return { kind: 'root-absolute', path: clean }
  const resolved = posix.normalize(posix.join(posix.dirname(fromFile), clean))
  if (resolved.startsWith('..')) return { kind: 'outside', path: resolved }
  return { kind: 'internal', path: resolved }
}

function collectProblems(site) {
  const problems = []
  const files = FILES[site]
  const check = (fromFile, ref) => {
    const result = resolveRef(fromFile, ref)
    if (result.kind === 'skip') return
    if (result.kind === 'root-absolute') return problems.push(`${fromFile}: root-absolute reference "${ref}"`)
    if (result.kind === 'outside') {
      // "../" is the link back to the Eduyog homepage (the parent of the site folder).
      if (/^(\.\.\/)+$/.test(ref.replace(/\\/g, '/'))) return
      return problems.push(`${fromFile}: reference "${ref}" leaves the site`)
    }
    const target = result.path === '.' || result.path === '' ? 'index.html' : result.path
    const isDir = [...files].some((file) => file.startsWith(`${target.replace(/\/$/, '')}/`))
    if (!files.has(target) && !isDir) problems.push(`${fromFile}: "${ref}" -> ${target} does not exist (exact case)`)
  }
  for (const file of files) {
    const text = file.match(/\.(html?|css|js)$/) ? read(site, file) : null
    if (text === null) continue
    // CSS urls are relative to the stylesheet; paths inside scripts are relative to the page that
    // loads them (every page sits at the site root).
    const refs = file.endsWith('.css') ? cssRefs(text) : file.endsWith('.js') ? jsRefs(text) : htmlRefs(text)
    for (const ref of refs) check(file.endsWith('.js') ? 'index.html' : file, ref)
  }
  return problems
}

// ---- tests ----------------------------------------------------------------------------------

test('every StudentAQ and Saritex page is published', () => {
  for (const [site, pages] of Object.entries(PAGES)) {
    for (const page of pages) assert.ok(FILES[site].has(page), `${site}/${page} is missing`)
    const published = [...FILES[site]].filter((file) => file.endsWith('.html')).sort()
    assert.deepEqual(published, [...pages].sort(), `${site}: unexpected or missing HTML pages`)
  }
})

test('StudentAQ: every internal link and asset resolves (exact case)', () => {
  assert.deepEqual(collectProblems('studentaq'), [])
})

test('Saritex: every internal link and asset resolves (exact case)', () => {
  assert.deepEqual(collectProblems('saritex'), [])
})

test('StudentAQ data.js: every page, image and asset it names exists', () => {
  const sandbox = { window: {}, document: undefined }
  vm.runInNewContext(read('studentaq', 'assets/js/data.js'), sandbox)
  const data = sandbox.window.SITE_DATA
  assert.ok(data, 'data.js did not define window.SITE_DATA')
  const problems = []
  const seen = new Set()
  const walk = (value) => {
    if (typeof value === 'string') {
      if (/^(?:assets\/|[\w-]+\.html)/.test(value) && !seen.has(value)) {
        seen.add(value)
        const path = value.split('#')[0].split('?')[0]
        if (!FILES.studentaq.has(path)) problems.push(`data.js: "${value}" does not exist (exact case)`)
      }
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(walk)
    }
  }
  walk(data)
  assert.ok(seen.size > 20, `expected to see many asset/page references, saw ${seen.size}`)
  assert.deepEqual(problems, [])
})

test('Saritex index.html: every PDF listed in the Services modal exists (exact case)', () => {
  const html = read('saritex', 'index.html')
  const block = html
    .slice(html.indexOf('const pdfDirectory'), html.indexOf('MODAL FUNCTIONALITY'))
    .replace(/\/\*[\s\S]*?\*\//g, '') // the commented-out "Other Services" sample entry is not live
  const entries = [...block.matchAll(/folder:\s*"([^"]+)",\s*files:\s*\[([\s\S]*?)\]/g)]
  assert.ok(entries.length >= 8, `expected 8 PDF folders, found ${entries.length}`)
  const problems = []
  let total = 0
  for (const [, folder, list] of entries) {
    for (const [, name] of list.matchAll(/"([^"]+\.pdf)"/g)) {
      total++
      if (!FILES.saritex.has(folder + name)) problems.push(`${folder}${name}`)
    }
  }
  assert.ok(total >= 90, `expected about 93 PDFs, found ${total}`)
  assert.deepEqual(problems, [])
})

test('no root-absolute paths, <base href="/"> or localhost in the static sites', () => {
  const offenders = []
  for (const site of Object.keys(PAGES)) {
    for (const file of FILES[site]) {
      if (!file.match(/\.(html?|css|js)$/)) continue
      const text = read(site, file)
      if (/<base\s+href="\/"/i.test(text)) offenders.push(`${site}/${file}: <base href="/">`)
      if (/localhost|127\.0\.0\.1|:5174|:5180|:5181/.test(text)) offenders.push(`${site}/${file}: localhost reference`)
    }
  }
  assert.deepEqual(offenders, [])
})

test('StudentAQ 404 page works under any base path (base derived from its own URL)', () => {
  const html = read('studentaq', '404.html')
  assert.ok(!/<base\s+href=/i.test(html), 'static <base href> must not be used')
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script, 'inline base script missing')
  const run = (pathname) => {
    let created = null
    const document = {
      createElement: () => (created = {}),
      head: { insertBefore: () => {}, firstChild: null },
    }
    vm.runInNewContext(script, { document, location: { pathname } })
    return created.href
  }
  assert.equal(run('/studentaq/404.html'), '/studentaq/')
  assert.equal(run('/studentaq/some/missing/page'), '/studentaq/')
  assert.equal(run('/eduyog/studentaq/404.html'), '/eduyog/studentaq/')
  assert.equal(run('/elsewhere/404.html'), './')
})

test('the copies differ from websites/ only by the documented changes', () => {
  for (const site of Object.keys(PAGES)) {
    const sourceRoot = join(SOURCES, site)
    const source = listFiles(sourceRoot).filter((file) => !NOT_PUBLISHED[site].includes(file))
    assert.deepEqual([...FILES[site]], source, `${site}: file list differs from the original`)
    const changed = source.filter((file) => sha(join(sourceRoot, file)) !== sha(join(PUBLIC, site, file)))
    assert.deepEqual(changed, EXPECTED_CHANGES[site], `${site}: changed files differ from the documented set`)
  }
})

// Back-to-Eduyog footer link, PDF folder-name case fix, and the four PDF file names corrected to the
// names on disk (the originals point at files that do not exist).
const ADDED_LINE =
  /href="\.\.\/">Back to Eduyog<\/a>|SaritexPdf_File|"(Full DIssertation|Harsh Shripremkumar {2}Dissertation|Mirza Dissertaion|Intelligent System- MD Shoaib )\.pdf"/
const REMOVED_LINE =
  /SariteXpdf_File|"(Full Dissertation|Harsh Shripremkumar Dissertation|Mirza Dissertation|Intelligent System- MD Shoaib)\.pdf"/

test('Saritex copy: the only differences are the documented edits', () => {
  for (const page of PAGES.saritex) {
    const before = readFileSync(join(SOURCES, 'saritex', page), 'utf8').split(/\r?\n/)
    const after = read('saritex', page).split(/\r?\n/)
    const added = after.filter((line) => !before.includes(line))
    const removed = before.filter((line) => !after.includes(line))
    for (const line of added) {
      assert.ok(ADDED_LINE.test(line), `${page}: unexpected added line: ${line.trim()}`)
    }
    for (const line of removed) {
      assert.ok(REMOVED_LINE.test(line), `${page}: unexpected removed line: ${line.trim()}`)
    }
  }
})

test('Saritex: both forms keep their SheetDB endpoint over https (no new third party)', () => {
  const endpoints = new Set()
  for (const page of PAGES.saritex) {
    const text = read('saritex', page)
    for (const [, action] of text.matchAll(/<form[^>]*\saction="([^"]+)"/g)) endpoints.add(action.split('?')[0])
    assert.ok(!/google\.com\/forms|formspree|web3forms|emailjs/i.test(text), `${page}: unexpected form service`)
  }
  assert.deepEqual([...endpoints], ['https://sheetdb.io/api/v1/io3zycyrrbs36'])
  const original = readFileSync(join(SOURCES, 'saritex', 'index.html'), 'utf8')
  assert.ok(original.includes('https://sheetdb.io/api/v1/io3zycyrrbs36'))
})

test('StudentAQ Google Form: configuration is consistent and never invented', (t) => {
  const sandbox = { window: {} }
  vm.runInNewContext(read('studentaq', 'assets/js/data.js'), sandbox)
  const { formId, entries } = sandbox.window.SITE_DATA.googleForm
  const empty = Object.entries(entries).filter(([, value]) => !value).map(([name]) => name)
  t.diagnostic(`Google Form formId is ${formId ? 'set' : 'EMPTY (submissions use the WhatsApp fallback)'}; ${empty.length} of ${Object.keys(entries).length} entry ids are empty`)
  // Either nothing is configured (the fallback applies), or everything is.
  if (formId) assert.deepEqual(empty, [], 'formId is set but some entry ids are missing')
  // The copy must not differ from the source configuration.
  const original = readFileSync(join(SOURCES, 'studentaq', 'assets/js/data.js'), 'utf8')
  const originalForm = original.slice(original.indexOf('googleForm:'), original.indexOf('footer: {'))
  assert.equal(read('studentaq', 'assets/js/data.js').includes(originalForm), true, 'googleForm block was altered')
})

// ---- URL helpers used by the React shell (src/staticSites.js) ----------------------------------

test('static site entry links honour the base path', async () => {
  const { STATIC_SITES, staticSiteHref } = await import('../src/staticSites.js')
  assert.deepEqual(STATIC_SITES.map((site) => site.id), ['studentaq', 'saritex'])
  assert.equal(staticSiteHref('saritex', ''), '/saritex/')
  assert.equal(staticSiteHref('studentaq', ''), '/studentaq/')
  assert.equal(staticSiteHref('saritex', '/eduyog'), '/eduyog/saritex/')
  assert.throws(() => staticSiteHref('eduyarp', ''))
  // Every registered site has a published entry page and a folder.
  for (const site of STATIC_SITES) {
    assert.ok(FILES[site.id].has(site.entry.split('/').pop()), `${site.id}: entry page missing`)
  }
})

test('"/saritex" and "/studentaq" (with or without slash) redirect to the real entry file', async () => {
  const { staticSiteRedirect } = await import('../src/staticSites.js')
  for (const [pathname, base, expected] of [
    ['/saritex', '', '/saritex/index.html'],
    ['/saritex/', '', '/saritex/index.html'],
    ['/studentaq', '', '/studentaq/index.html'],
    ['/eduyog/saritex/', '/eduyog', '/eduyog/saritex/index.html'],
    ['/eduyog/studentaq', '/eduyog', '/eduyog/studentaq/index.html'],
  ]) {
    assert.equal(staticSiteRedirect(pathname, base), expected, `${base}${pathname}`)
  }
  // Real files, other routes, other sites and look-alikes are never redirected (no loops).
  for (const [pathname, base] of [
    ['/saritex/index.html', ''],
    ['/saritex/Services.html', ''],
    ['/studentaq/missing', ''],
    ['/', ''],
    ['/fitness', ''],
    ['/saritexx', ''],
    ['/saritex/', '/eduyog'],
    ['/eduyog/', '/eduyog'],
  ]) {
    assert.equal(staticSiteRedirect(pathname, base), null, `${base}${pathname}`)
  }
})

test('static sites are not React routes (no placeholder pages)', async () => {
  const { resolveRoute, ROUTES } = await import('../src/routes.js')
  assert.ok(ROUTES.every((route) => !/^\/(saritex|studentaq)/.test(route.path)), 'no React route for a static site')
  for (const path of ['/saritex/', '/studentaq/', '/saritex/index.html']) assert.equal(resolveRoute(path).id, 'not-found')
})
