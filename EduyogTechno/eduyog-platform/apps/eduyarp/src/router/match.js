// Matches "/courses/:slug" against a path. Returns the decoded params, or
// null when the path does not match.
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

// Only same-site paths are allowed as a post-login destination, so
// "?next=https://evil.example" or "//evil.example" cannot redirect off site.
export function safeNextPath(value, fallback = '/dashboard') {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : fallback
}

export function loginPath(next) {
  return `/login?next=${encodeURIComponent(next)}`
}
