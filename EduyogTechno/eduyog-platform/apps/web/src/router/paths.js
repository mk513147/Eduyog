// Pure path helpers (no browser globals) so they can be unit tested with node:test.
// `base` is the public base path without a trailing slash: "" for the domain root, or "/eduyog".

// "/eduyog/fitness" -> "/fitness". Returns null when the pathname is outside the base.
export function stripBase(pathname, base) {
  if (!base) return pathname || '/'
  if (pathname === base) return '/'
  if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length) || '/'
  return null
}

// App path ("/fitness#x") -> browser URL ("/eduyog/fitness#x").
export function withBase(to, base) {
  return `${base}${to.startsWith('/') ? to : `/${to}`}`
}

// Splits an app path into pathname, search and hash.
export function parseTo(to) {
  const url = new URL(to, 'http://app.invalid')
  return { path: url.pathname, search: url.search, hash: url.hash }
}
