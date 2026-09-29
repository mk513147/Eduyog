import { API_BASE_URL } from '../config'
import { getToken } from './session'

// Mirrors the backend error format: { error: { message, details? } }.
export class ApiError extends Error {
  constructor(status, message, details) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details || null
  }
}

let authFailureHandler = null

// Called with the ApiError whenever an authenticated request returns 401 or 403.
export function setAuthFailureHandler(handler) {
  authFailureHandler = handler
}

/**
 * @param {string} path  Path below the API base, e.g. "/admin/users".
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {object} [options.body]   Sent as JSON.
 * @param {string|null} [options.token]  Overrides the stored token. Pass null
 *   for public endpoints. Requests with an explicit token do not trigger the
 *   global auth-failure handler.
 */
export async function request(path, { method = 'GET', body, token } = {}) {
  const usesStoredToken = token === undefined
  const bearer = usesStoredToken ? getToken() : token

  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (bearer) headers.Authorization = `Bearer ${bearer}`

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check that the backend is running.')
  }

  if (response.status === 204) return null

  let data = null
  try {
    data = await response.json()
  } catch {
    // Non-JSON body; handled below.
  }

  if (!response.ok) {
    const error = new ApiError(
      response.status,
      data?.error?.message || `Request failed (HTTP ${response.status})`,
      data?.error?.details,
    )
    if (usesStoredToken && bearer && (response.status === 401 || response.status === 403)) {
      authFailureHandler?.(error)
    }
    throw error
  }

  return data
}
