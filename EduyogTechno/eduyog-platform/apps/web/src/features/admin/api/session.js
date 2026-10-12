// The JWT is kept in sessionStorage so it is cleared when the browser tab
// closes. Storage can be unavailable (private mode, blocked site data), so
// every access is guarded.
const TOKEN_KEY = 'eduyog_admin_token'

export function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Without storage the session lasts only until the page reloads.
  }
}

export function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // Nothing to clear.
  }
}
