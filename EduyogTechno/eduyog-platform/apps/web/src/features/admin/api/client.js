import { ApiError as SharedApiError, createApiClient } from '../../../api/createClient'
import { API_BASE_URL } from '../../../config'
import { getToken } from './session'

// The standalone Admin app built errors as ApiError(status, message, details) (AuthProvider throws one
// for "not an Admin"). This keeps that constructor on top of the shared error type, so pages and
// providers are unchanged; errors from the client expose `status`, `message` and `details`.
export class ApiError extends SharedApiError {
  constructor(status, message, details) {
    super('http', message, status, details || null)
  }
}

let authFailureHandler = null

// Called with the ApiError whenever an authenticated request returns 401 or 403.
export function setAuthFailureHandler(handler) {
  authFailureHandler = handler
}

// Admin's own client instance: the shared factory and the central API address (VITE_API_BASE_URL, no
// fallback), with the Admin session token (`eduyog_admin_token`) and nothing else. Both 401 and 403 on
// a request made with the stored token end the session (see AuthProvider).
const client = createApiClient({
  baseUrl: API_BASE_URL,
  getToken,
  onUnauthorized: (error) => authFailureHandler?.(error),
  authFailureStatuses: [401, 403],
  networkMessage: 'Cannot reach the server. Check that the backend is running.',
})

/**
 * @param {string} path  Path below the API base, e.g. "/admin/users".
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {object} [options.body]   Sent as JSON.
 * @param {string|null} [options.token]  Overrides the stored token. Pass null
 *   for public endpoints. Requests with an explicit token do not trigger the
 *   global auth-failure handler.
 */
export function request(path, { method = 'GET', body, token } = {}) {
  return client.request(path, { method, body, token })
}
