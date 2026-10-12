import { motion, useReducedMotion } from 'motion/react'
import { useAuth } from './auth/useAuth'
import { Layout } from './components/Layout'
import { Alert, LoadingState } from './components/States'
import AnnouncementsPage from './pages/AnnouncementsPage'
import CatalogPage from './pages/CatalogPage'
import CertificatePage from './pages/CertificatePage'
import CertificatesPage from './pages/CertificatesPage'
import CourseDetailPage from './pages/CourseDetailPage'
import DashboardPage from './pages/DashboardPage'
import LandingPage from './pages/LandingPage'
import LearnPage from './pages/LearnPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import NotificationsPage from './pages/NotificationsPage'
import PreviewPage from './pages/PreviewPage'
import ProfilePage from './pages/ProfilePage'
import RegisterPage from './pages/RegisterPage'
import StudentAssignmentPage from './pages/StudentAssignmentPage'
import TrainerAssignmentPage from './pages/TrainerAssignmentPage'
import TrainerCoursePage from './pages/TrainerCoursePage'
import TrainerDashboardPage from './pages/TrainerDashboardPage'
import TrainerStudentPage from './pages/TrainerStudentPage'
import { resolveAccess } from './access'
import { Link } from './router/Link'
import { Redirect } from './router/Redirect'
import { useRouter } from './router/useRouter'

// Route id (see src/routes.js) -> page. The route table owns paths, params and access levels.
const PAGES = {
  'eduyarp-landing': LandingPage,
  'eduyarp-courses': CatalogPage,
  'eduyarp-course': CourseDetailPage,
  'eduyarp-login': LoginPage,
  'eduyarp-register': RegisterPage,
  'eduyarp-dashboard': DashboardPage,
  'eduyarp-preview': PreviewPage,
  'eduyarp-learn': LearnPage,
  'eduyarp-assignment': StudentAssignmentPage,
  'eduyarp-certificates': CertificatesPage,
  'eduyarp-certificate': CertificatePage,
  'eduyarp-trainer': TrainerDashboardPage,
  'eduyarp-trainer-course': TrainerCoursePage,
  'eduyarp-trainer-assignment': TrainerAssignmentPage,
  'eduyarp-trainer-student': TrainerStudentPage,
  'account-profile': ProfilePage,
  'account-notifications': NotificationsPage,
  'account-announcements': AnnouncementsPage,
  'eduyarp-not-found': NotFoundPage,
}

const AREA_ROLES = { student: 'students', trainer: 'trainers' }

// Shown to a signed-in user whose role does not fit the area they opened.
function RoleOnly({ area }) {
  const { logout, isTrainer } = useAuth()
  const label = AREA_ROLES[area]
  return (
    <div className="container">
      <div className="state state--page">
        <p className="state__title">This area is for {label}</p>
        <Alert tone="info">
          You are signed in with an account that is not a {area === 'student' ? 'Student' : 'Trainer'} account.
          Log out and sign in with the right account to continue.
        </Alert>
        <div className="state__actions">
          <Link to={isTrainer ? '/eduyarp/trainer' : '/eduyarp/courses'} className="btn btn--secondary">
            {isTrainer ? 'Trainer dashboard' : 'Browse courses'}
          </Link>
          <button type="button" className="btn btn--primary" onClick={() => logout()}>
            Log out
          </button>
        </div>
      </div>
    </div>
  )
}

// Adapted from apps/eduyarp/src/App.jsx: the access rules are unchanged. They are a convenience for
// the browser; the backend's role checks stay the source of truth. `route` comes from the shell's
// route table (id, access, params). Nothing private is requested before the session is known:
// a page that needs sign-in is only rendered once the stored token has been verified with /auth/me.
// access: 'public' | 'guest' (signed-out only) | 'student' | 'trainer' | 'account' (any signed-in role)
export default function EduyarpApp({ route }) {
  const { status, isStudent, isTrainer } = useAuth()
  const { path, fullPath, query } = useRouter()
  const Page = PAGES[route.id] ?? NotFoundPage
  const reduce = useReducedMotion()
  const { access, params } = route

  const decision = resolveAccess({ access, status, isStudent, isTrainer, fullPath, next: query.get('next') })

  let content
  if (decision.type === 'loading') content = <LoadingState label="Checking your session…" />
  else if (decision.type === 'redirect') content = <Redirect to={decision.to} />
  else if (decision.type === 'role-only') content = <RoleOnly area={decision.area} />
  else
    // A short opacity-only fade between pages: content is in the DOM (and usable) from the first frame.
    content = (
      <motion.div key={path} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
        <Page params={params} />
      </motion.div>
    )

  return <Layout>{content}</Layout>
}
