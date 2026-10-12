// Pure path helpers (no browser globals) shared by the route table and the features.

// Matches "/courses/:slug" against a path. Returns the decoded params, or null when the path does
// not match. Empty segments are ignored, so a trailing slash never changes the result.
export function matchPath(pattern, path) {
  const patternParts = pattern.split('/').filter(Boolean)
  const pathParts = path.split('/').filter(Boolean)
  if (patternParts.length !== pathParts.length) return null

  const params = {}
  for (let i = 0; i < patternParts.length; i++) {
    const part = patternParts[i]
    if (part.startsWith(':')) {
      try {
        params[part.slice(1)] = decodeURIComponent(pathParts[i])
      } catch {
        return null
      }
    } else if (part !== pathParts[i]) {
      return null
    }
  }
  return params
}

// "/courses/:slug" + { slug: 'a b' } -> "/courses/a%20b".
export function fillPath(pattern, params) {
  return pattern.replace(/:([A-Za-z]\w*)/g, (_, name) => encodeURIComponent(params[name]))
}

// An internal application path: starts with a single "/", no backslash, no whitespace or control
// characters. Never "//host", an absolute URL or "javascript:".
export function isInternalPath(value) {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\') &&
    // eslint-disable-next-line no-control-regex
    !/[\s\u0000-\u001f\u007f]/.test(value)
  )
}

// "/a/b?x=1#y" -> { pathname: '/a/b', rest: '?x=1#y' }
export function splitPath(value) {
  const index = value.search(/[?#]/)
  return index === -1 ? { pathname: value, rest: '' } : { pathname: value.slice(0, index), rest: value.slice(index) }
}
