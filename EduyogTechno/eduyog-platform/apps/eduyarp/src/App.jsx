import { useAuth } from './auth/useAuth'
import { Layout } from './components/Layout'
import { Alert, LoadingState } from './components/States'
import StudentAssignmentPage from './pages/StudentAssignmentPage'
import TrainerAssignmentPage from './pages/TrainerAssignmentPage'
import CertificatePage from './pages/CertificatePage'
import CertificatesPage from './pages/CertificatesPage'
import AnnouncementsPage from './pages/AnnouncementsPage'
import CatalogPage from './pages/CatalogPage'
import CourseDetailPage from './pages/CourseDetailPage'
import DashboardPage from './pages/DashboardPage'
import LandingPage from './pages/LandingPage'
import LearnPage from './pages/LearnPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import NotificationsPage from './pages/NotificationsPage'
import ProfilePage from './pages/ProfilePage'
import RegisterPage from './pages/RegisterPage'
import TrainerCoursePage from './pages/TrainerCoursePage'
import TrainerDashboardPage from './pages/TrainerDashboardPage'
import TrainerStudentPage from './pages/TrainerStudentPage'
import { Link } from './router/Link'
import { loginPath, matchPath, safeNextPath } from './router/match'
import { Redirect } from './router/Redirect'
import { useRouter } from './router/useRouter'

// access: 'public' | 'guest' (signed-out only) | 'student' | 'trainer' | 'account' (any signed-in role)
const ROUTES = [
  { pattern: '/', Page: LandingPage, access: 'public' },
  { pattern: '/courses', Page: CatalogPage, access: 'public' },
  { pattern: '/courses/:slug', Page: CourseDetailPage, access: 'public' },
  { pattern: '/login', Page: LoginPage, access: 'guest' },
  { pattern: '/register', Page: RegisterPage, access: 'guest' },
  { pattern: '/dashboard', Page: DashboardPage, access: 'student' },
  { pattern: '/my-courses/:courseId', Page: LearnPage, access: 'student' },
  { pattern: '/my-courses/:courseId/assignments/:assignmentId', Page: StudentAssignmentPage, access: 'student' },
  { pattern: '/certificates', Page: CertificatesPage, access: 'student' },
  { pattern: '/certificates/:certificateId', Page: CertificatePage, access: 'student' },
  { pattern: '/profile', Page: ProfilePage, access: 'account' },
  { pattern: '/notifications', Page: NotificationsPage, access: 'account' },
  { pattern: '/announcements', Page: AnnouncementsPage, access: 'account' },
  { pattern: '/trainer', Page: TrainerDashboardPage, access: 'trainer' },
  { pattern: '/trainer/courses/:courseId', Page: TrainerCoursePage, access: 'trainer' },
  { pattern: '/trainer/courses/:courseId/assignments/:assignmentId', Page: TrainerAssignmentPage, access: 'trainer' },
  { pattern: '/trainer/courses/:courseId/students/:studentId', Page: TrainerStudentPage, access: 'trainer' },
]

function resolve(path) {
  for (const route of ROUTES) {
    const params = matchPath(route.pattern, path)
    if (params) return { ...route, params }
  }
  return { Page: NotFoundPage, access: 'public', params: {} }
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
          <Link to={isTrainer ? '/trainer' : '/courses'} className="btn btn--secondary">
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

export default function App() {
  const { status, isStudent, isTrainer } = useAuth()
  const { path, fullPath, query } = useRouter()
  const { Page, access, params } = resolve(path)

  let content
  if (access !== 'public' && status === 'checking') {
    content = <LoadingState label="Checking your session…" />
  } else if (access === 'guest' && status === 'authenticated') {
    // Signed-in users do not need the login pages; send each role to its own home.
    const home = isStudent ? '/dashboard' : isTrainer ? '/trainer' : '/courses'
    content = <Redirect to={safeNextPath(query.get('next'), home)} />
  } else if (access !== 'public' && access !== 'guest' && status !== 'authenticated') {
    content = <Redirect to={loginPath(fullPath)} />
  } else if (access === 'student' && !isStudent) {
    content = <RoleOnly area="student" />
  } else if (access === 'trainer' && !isTrainer) {
    content = <RoleOnly area="trainer" />
  } else {
    content = <Page key={path} params={params} />
  }

  return <Layout>{content}</Layout>
}
