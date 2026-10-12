import { createApiClient } from '../../../api/createClient'
import { API_BASE_URL } from '../../../config'
import { getToken } from './session'

export { ApiError } from '../../../api/createClient'

let sessionExpiredHandler = null

// Called when a request made with the stored token returns 401.
export function setSessionExpiredHandler(handler) {
  sessionExpiredHandler = handler
}

// Eduyarp's own client instance: the shared factory and the central API address
// (VITE_API_BASE_URL, no fallback), with Eduyarp's own session token (`eduyarp_token`).
// Same contract as the standalone app: errors expose `status`, `message` and `details`
// (the backend's { error: { message, details } }).
const client = createApiClient({
  baseUrl: API_BASE_URL,
  getToken,
  onUnauthorized: (error) => sessionExpiredHandler?.(error),
})

/**
 * @param {string} path  Path below the API base, e.g. "/eduyarp/courses".
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {object} [options.body]   Sent as JSON.
 * @param {string|null} [options.token]  Overrides the stored token. Pass null
 *   for public endpoints.
 */
export function request(path, { method = 'GET', body, token } = {}) {
  return client.request(path, { method, body, token })
}
