// Pure URL helpers (no browser or Vite globals) so they can be unit tested with node:test.

// Returns a normalised http(s) URL string, or null for anything else (empty, relative,
// javascript:, data:, malformed, no host...).
export function toHttpUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return null
  let url
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (!url.hostname) return null
  return url.href
}

// Returns an app path ("/fitness", "/fitness?x=1#y") or null. Protocol-relative ("//host") and
// backslash forms are rejected so a configured value can never leave the site by accident.
export function toAppPath(value) {
  if (typeof value !== 'string') return null
  const path = value.trim()
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || /\s/.test(path)) return null
  return path
}

// API base URL: an http(s) URL without a trailing slash, or null when missing/invalid.
export function normaliseApiBase(value) {
  const url = toHttpUrl(value)
  return url ? url.replace(/\/+$/, '') : null
}
