// Central route table. Pure data (no components), so it can be unit tested and so the router never
// depends on which feature modules are loaded. App.jsx maps each route to its page component (the
// homepage eagerly, feature modules with React.lazy) and each `layout` to a layout.
//
//   layout 'public' - the shared public header, footer and WhatsApp button (PublicLayout)
//   layout 'none'   - the module brings its own chrome (Fitness, Eduyarp)
//   module          - routes of one lazy-loaded feature module share one mounted instance, so its
//                     providers (session, notifications) survive navigation between its pages
//   access          - who may open the route: 'public' | 'guest' (signed out only) | 'student' |
//                     'trainer' | 'account' (any signed-in role). Enforced by the module in the
//                     browser; the backend's role checks remain the real authority.
//   legacy          - the path the standalone Eduyarp app used for the same page. The backend still
//                     stores such paths in notifications ("link_path"), so they are translated.
//
// Only routes whose features are actually migrated are registered. Admin, StudentAQ and Saritex are
// not React routes here (see staticSites.js).
import { fillPath, isInternalPath, matchPath, splitPath } from './router/match.js'

export const ROUTE_PATHS = {
  home: '/',
  fitness: '/fitness',
  eduyarp: '/eduyarp',
  courses: '/eduyarp/courses',
  login: '/eduyarp/login',
  register: '/eduyarp/register',
  dashboard: '/eduyarp/dashboard',
  trainer: '/eduyarp/trainer',
  certificates: '/eduyarp/certificates',
  profile: '/account/profile',
  notifications: '/account/notifications',
  announcements: '/account/announcements',
  admin: '/admin',
  adminLogin: '/admin/login',
}

// Admin routes: `adminLegacy` is the path the standalone Admin app used (kept for the inventory test; it is not
// translated like Eduyarp's, because nothing stores Admin paths). `constraints` restrict a param (the original
// matched course ids with a digits-only pattern).
const admin = (id, path, adminLegacy, access, constraints) => ({ id, path, adminLegacy, access, constraints, module: 'admin', layout: 'none' })
const eduyarp = (id, path, legacy, access) => ({ id, path, legacy, access, module: 'eduyarp', layout: 'none' })

export const ROUTES = [
  { id: 'home', path: ROUTE_PATHS.home, layout: 'public' },
  { id: 'fitness', path: ROUTE_PATHS.fitness, layout: 'none' },

  // Eduyarp: public
  eduyarp('eduyarp-landing', '/eduyarp', '/', 'public'),
  eduyarp('eduyarp-courses', '/eduyarp/courses', '/courses', 'public'),
  eduyarp('eduyarp-course', '/eduyarp/courses/:slug', '/courses/:slug', 'public'),
  // Eduyarp: signed-out only
  eduyarp('eduyarp-login', '/eduyarp/login', '/login', 'guest'),
  eduyarp('eduyarp-register', '/eduyarp/register', '/register', 'guest'),
  // Eduyarp: students
  eduyarp('eduyarp-dashboard', '/eduyarp/dashboard', '/dashboard', 'student'),
  eduyarp('eduyarp-preview', '/eduyarp/preview/:courseId', '/preview/:courseId', 'student'),
  eduyarp('eduyarp-learn', '/eduyarp/my-courses/:courseId', '/my-courses/:courseId', 'student'),
  eduyarp('eduyarp-assignment', '/eduyarp/my-courses/:courseId/assignments/:assignmentId', '/my-courses/:courseId/assignments/:assignmentId', 'student'),
  eduyarp('eduyarp-certificates', '/eduyarp/certificates', '/certificates', 'student'),
  eduyarp('eduyarp-certificate', '/eduyarp/certificates/:certificateId', '/certificates/:certificateId', 'student'),
  // Eduyarp: trainers
  eduyarp('eduyarp-trainer', '/eduyarp/trainer', '/trainer', 'trainer'),
  eduyarp('eduyarp-trainer-course', '/eduyarp/trainer/courses/:courseId', '/trainer/courses/:courseId', 'trainer'),
  eduyarp('eduyarp-trainer-assignment', '/eduyarp/trainer/courses/:courseId/assignments/:assignmentId', '/trainer/courses/:courseId/assignments/:assignmentId', 'trainer'),
  eduyarp('eduyarp-trainer-student', '/eduyarp/trainer/courses/:courseId/students/:studentId', '/trainer/courses/:courseId/students/:studentId', 'trainer'),
  // Account pages: any signed-in role (backed by the Eduyarp session for now)
  eduyarp('account-profile', '/account/profile', '/profile', 'account'),
  eduyarp('account-notifications', '/account/notifications', '/notifications', 'account'),
  eduyarp('account-announcements', '/account/announcements', '/announcements', 'account'),

  // Admin (administrators only; the login page is for signed-out visitors)
  admin('admin-login', '/admin/login', '/login', 'guest'),
  admin('admin-overview', '/admin', '/', 'admin'),
  admin('admin-platforms', '/admin/platforms', '/platforms', 'admin'),
  admin('admin-services', '/admin/services', '/services', 'admin'),
  admin('admin-users', '/admin/users', '/users', 'admin'),
  admin('admin-registrations', '/admin/registrations', '/registrations', 'admin'),
  admin('admin-fitness-leads', '/admin/fitness-leads', '/fitness-leads', 'admin'),
  admin('admin-studentaq-enquiries', '/admin/studentaq-enquiries', '/studentaq-enquiries', 'admin'),
  admin('admin-eduyarp-courses', '/admin/eduyarp/courses', '/eduyarp/courses', 'admin'),
  admin('admin-eduyarp-course', '/admin/eduyarp/courses/:id', '/eduyarp/courses/:id', 'admin', { id: /^\d+$/ }),
  admin('admin-eduyarp-trainers', '/admin/eduyarp/trainers', '/eduyarp/trainers', 'admin'),
  admin('admin-eduyarp-enrolments', '/admin/eduyarp/enrolments', '/eduyarp/enrolments', 'admin'),
  admin('admin-eduyarp-classes', '/admin/eduyarp/classes', '/eduyarp/classes', 'admin'),
  admin('admin-eduyarp-announcements', '/admin/eduyarp/announcements', '/eduyarp/announcements', 'admin'),
  admin('admin-eduyarp-certificates', '/admin/eduyarp/certificates', '/eduyarp/certificates', 'admin'),
]

export const NOT_FOUND = { id: 'not-found', path: null, layout: 'public', params: {} }
// An unknown path inside the Eduyarp or account area gets Eduyarp's own "not found" page, as before.
export const EDUYARP_NOT_FOUND = { id: 'eduyarp-not-found', path: null, module: 'eduyarp', layout: 'none', access: 'public', params: {} }
const EDUYARP_AREAS = ['/eduyarp', '/account']
// An unknown path inside /admin gets the Admin "not found" page, but only for a signed-in administrator
// (anyone else is sent to the Admin login first, exactly as in the standalone app).
export const ADMIN_NOT_FOUND = { id: 'admin-not-found', path: null, module: 'admin', layout: 'none', access: 'admin', params: {} }

export function resolveRoute(path) {
  // A trailing slash does not change the route ("/x/" is "/x").
  const normalised = path.length > 1 ? path.replace(/\/+$/, '') : path
  for (const route of ROUTES) {
    const params = matchPath(route.path, normalised)
    if (!params) continue
    if (route.constraints && !Object.entries(route.constraints).every(([name, pattern]) => pattern.test(params[name]))) continue
    return { ...route, params }
  }
  if (normalised === '/admin' || normalised.startsWith('/admin/')) return ADMIN_NOT_FOUND
  if (EDUYARP_AREAS.some((area) => normalised === area || normalised.startsWith(`${area}/`))) return EDUYARP_NOT_FOUND
  return NOT_FOUND
}

// Translates a path of the standalone Eduyarp app ("/my-courses/5?x=1") to the unified path
// ("/eduyarp/my-courses/5?x=1"). Returns null when it is not a legacy Eduyarp path.
export function legacyToUnified(value) {
  const { pathname, rest } = splitPath(value)
  for (const route of ROUTES) {
    if (!route.legacy) continue
    const params = matchPath(route.legacy, pathname)
    if (params) return fillPath(route.path, params) + rest
  }
  return null
}

// A safe in-app destination inside the Eduyarp/account area, or null. Accepts unified paths and
// legacy ones (notification links stored by the backend); never an external URL, "//host" or a path
// outside the area.
export function eduyarpDestination(value) {
  if (!isInternalPath(value)) return null
  const mapped = legacyToUnified(value) ?? value
  const route = resolveRoute(splitPath(mapped).pathname)
  if (route.module !== 'eduyarp' || route.id === 'eduyarp-not-found') return null
  return mapped
}

// Where to go after login/registration. Anything unsafe, unknown, or a signed-out-only page (which
// would bounce straight back) falls back to `fallback`.
export function safeNextPath(value, fallback = ROUTE_PATHS.dashboard) {
  const destination = eduyarpDestination(value)
  if (!destination) return fallback
  return resolveRoute(splitPath(destination).pathname).access === 'guest' ? fallback : destination
}

export const loginPath = (next) => `${ROUTE_PATHS.login}?next=${encodeURIComponent(next)}`
