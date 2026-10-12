import { eduyarpDestination, ROUTE_PATHS } from '../../../routes'

// The backend stores notification links as paths of the standalone Eduyarp app ("/my-courses/5",
// "/trainer/courses/9/assignments/3?submission=2", "/announcements"). This maps one to the unified
// route, and returns null for anything that is not a safe in-app Eduyarp/account destination
// (an external URL, "//host", an unknown path): such a link is never followed.
export const notificationDestination = (linkPath) => eduyarpDestination(linkPath)

// Where a notification without a usable link leads.
export const NOTIFICATIONS_PATH = ROUTE_PATHS.notifications
