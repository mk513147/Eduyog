// Pure API client factory (no Vite or browser globals besides fetch), so it can be unit tested with
// node:test and a fake fetch. The app's configured instance lives in client.js; Eduyarp has its own
// instance (features/eduyarp/api/client.js) that also sends its session token.

export class ApiError extends Error {
  constructor(kind, message, status = null, details = null, serverMessage = null) {
    super(message)
    this.name = 'ApiError'
    // 'not-configured' | 'network' | 'http' | 'format'
    this.kind = kind
    this.status = status
    // Field errors from the backend's { error: { message, details } } format, when present.
    this.details = details
    // The message from the backend's error body, if it sent one (message itself falls back to a generic text).
    this.serverMessage = serverMessage
  }
}

async function readJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

/**
 * @param {object} options
 * @param {string|null} options.baseUrl  API base including /api, no trailing slash; null = not configured.
 * @param {typeof fetch} [options.fetchImpl]
 * @param {() => (string|null)} [options.getToken]  Source of the bearer token for requests that do not
 *   pass their own. Omit it for a client that never authenticates (the default instance).
 * @param {(error: ApiError) => void} [options.onUnauthorized]  Called when a request made with the
 *   stored token (not an explicit one) is answered with one of `authFailureStatuses`.
 * @param {number[]} [options.authFailureStatuses]  Statuses that trigger `onUnauthorized`: [401] by default
 *   (Eduyarp); Admin also ends its session on 403.
 * @param {string} [options.networkMessage]  Message of the error thrown when the server cannot be reached.
 *
 * Nothing but the Authorization header is ever sent as credentials (no cookies).
 * With no baseUrl, no request is made and every call rejects with ApiError('not-configured').
 */
export function createApiClient({
  baseUrl,
  fetchImpl = (...args) => fetch(...args),
  getToken,
  onUnauthorized,
  authFailureStatuses = [401],
  networkMessage = 'Cannot reach the server. Please check your connection and try again.',
}) {
  async function request(path, { method, body, signal, expectJson, token }) {
    if (!baseUrl) throw new ApiError('not-configured', 'The API address is not configured.')

    // token: undefined -> the stored token (if any); null -> none (public endpoint); string -> that token.
    const usesStoredToken = token === undefined
    const bearer = usesStoredToken ? (getToken ? getToken() : null) : token

    const headers = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (bearer) headers.Authorization = `Bearer ${bearer}`

    let response
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        credentials: 'omit',
        signal,
      })
    } catch (error) {
      if (error?.name === 'AbortError') throw error
      throw new ApiError('network', networkMessage)
    }

    if (!response.ok) {
      const data = await readJson(response)
      const error = new ApiError(
        'http',
        data?.error?.message || `Request failed (HTTP ${response.status})`,
        response.status,
        data?.error?.details ?? null,
        data?.error?.message ?? null,
      )
      if (usesStoredToken && bearer && authFailureStatuses.includes(response.status)) onUnauthorized?.(error)
      throw error
    }

    const data = await readJson(response)
    if (data === null && expectJson) throw new ApiError('format', 'The server returned an unexpected response.')
    return data
  }

  return {
    // JSON is required in the response body.
    get: (path, { signal, token } = {}) => request(path, { method: 'GET', signal, token, expectJson: true }),
    // Success is decided by the HTTP status alone (the body is returned when it is JSON, else null).
    post: (path, body, { signal, token } = {}) => request(path, { method: 'POST', body, signal, token, expectJson: false }),
    // Any method; success is decided by the HTTP status alone (204 and other empty bodies give null).
    request: (path, { method = 'GET', body, signal, token } = {}) => request(path, { method, body, signal, token, expectJson: false }),
  }
}
