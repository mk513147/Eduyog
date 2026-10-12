// The Admin guard of the standalone app (App.jsx), extracted unchanged so it can be unit tested. It only
// decides what to render: the session is "authenticated" only after /auth/me has confirmed the
// administrator role (AuthProvider), and the backend's admin-only checks remain the authority.

/**
 * @param {object} input
 * @param {'checking'|'authenticated'|'anonymous'} input.status  Session status from the Admin AuthProvider.
 * @param {string} input.routeId  From the shell's route table ('admin-login', 'admin-overview', ...).
 * @returns {{type:'loading'} | {type:'login'} | {type:'redirect', to:string} | {type:'page'}}
 */
export function resolveAdminAccess({ status, routeId }) {
  // Nothing is shown (and nothing private is requested) until a stored token has been verified.
  if (status === 'checking') return { type: 'loading' }
  if (routeId === 'admin-login') {
    return status === 'authenticated' ? { type: 'redirect', to: '/admin' } : { type: 'login' }
  }
  // Every other route, including an unknown one, requires a signed-in Admin.
  if (status !== 'authenticated') return { type: 'redirect', to: '/admin/login' }
  return { type: 'page' }
}
