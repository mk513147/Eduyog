// The browser-side access decision of the standalone Eduyarp app (App.jsx), extracted unchanged so it
// can be unit tested. It only decides what to render; the backend's role checks remain the authority.
import { loginPath, safeNextPath } from '../../routes.js'

/**
 * @param {object} input
 * @param {'public'|'guest'|'student'|'trainer'|'account'} input.access  From the route table.
 * @param {'checking'|'authenticated'|'anonymous'} input.status  Session status from AuthProvider.
 * @param {boolean} input.isStudent
 * @param {boolean} input.isTrainer
 * @param {string} input.fullPath  Current path including query, for the ?next= return value.
 * @param {string|null} input.next  The raw ?next= query value.
 * @returns {{type:'page'} | {type:'loading'} | {type:'redirect', to:string} | {type:'role-only', area:'student'|'trainer'}}
 */
export function resolveAccess({ access, status, isStudent, isTrainer, fullPath, next }) {
  // A page that needs (or depends on) sign-in waits for the stored token to be verified first, so no
  // private request is made and no wrong page flashes.
  if (access !== 'public' && status === 'checking') return { type: 'loading' }
  if (access === 'guest' && status === 'authenticated') {
    // Signed-in users do not need the login pages; send each role to its own home.
    const home = isStudent ? '/eduyarp/dashboard' : isTrainer ? '/eduyarp/trainer' : '/eduyarp/courses'
    return { type: 'redirect', to: safeNextPath(next, home) }
  }
  if (access !== 'public' && access !== 'guest' && status !== 'authenticated') {
    return { type: 'redirect', to: loginPath(fullPath) }
  }
  if (access === 'student' && !isStudent) return { type: 'role-only', area: 'student' }
  if (access === 'trainer' && !isTrainer) return { type: 'role-only', area: 'trainer' }
  return { type: 'page' }
}
