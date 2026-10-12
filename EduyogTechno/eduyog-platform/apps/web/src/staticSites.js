// StudentAQ and Saritex are NOT React routes: they are complete static HTML sites copied into
// public/studentaq and public/saritex and served as their own documents (Saritex needs global
// Bootstrap, StudentAQ has its own global CSS and JS, so neither can share the React document).
// This module is the single place that knows their URLs. Pure (no browser or Vite globals), so it can
// be unit tested. `base` is the public base path without a trailing slash ("" or "/eduyog").
import { stripBase, withBase } from './router/paths.js'

export const STATIC_SITES = [
  // path: the site's folder URL (trailing slash required: the pages use relative links).
  // entry: its home page as an explicit file, which every static host serves without extra rules.
  { id: 'studentaq', path: '/studentaq/', entry: '/studentaq/index.html' },
  { id: 'saritex', path: '/saritex/', entry: '/saritex/index.html' },
]

// Browser URL of a site's folder, e.g. "/saritex/" or "/eduyog/saritex/". Used for plain links: they
// must be full page loads, never client-side navigations (the router would show its not-found page).
export function staticSiteHref(id, base = '') {
  const site = STATIC_SITES.find((candidate) => candidate.id === id)
  if (!site) throw new Error(`Unknown static site: ${id}`)
  return withBase(site.path, base)
}

// If `pathname` (a browser pathname, base included) is exactly a static site's folder, with or
// without the trailing slash, returns the browser URL of its entry page; otherwise null.
// This covers hosts (and the Vite dev server) that answer "/saritex" or "/saritex/" with the React
// shell instead of the folder's index.html: the shell redirects to the real file, where the page's
// relative links resolve correctly. Any other path under a site (a missing file) is left alone.
export function staticSiteRedirect(pathname, base = '') {
  const appPath = stripBase(pathname, base)
  if (appPath === null) return null
  const normalised = appPath.replace(/\/+$/, '')
  const site = STATIC_SITES.find((candidate) => candidate.path.replace(/\/$/, '') === normalised)
  return site ? withBase(site.entry, base) : null
}
