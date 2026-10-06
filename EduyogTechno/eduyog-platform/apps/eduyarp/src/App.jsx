import { useAuth } from './auth/useAuth'
import { Layout } from './components/Layout'
import { Alert, LoadingState } from './components/States'
import CatalogPage from './pages/CatalogPage'
import CourseDetailPage from './pages/CourseDetailPage'
import DashboardPage from './pages/DashboardPage'
import LandingPage from './pages/LandingPage'
import LearnPage from './pages/LearnPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import RegisterPage from './pages/RegisterPage'
import { Link } from './router/Link'
import { loginPath, matchPath, safeNextPath } from './router/match'
import { Redirect } from './router/Redirect'
import { useRouter } from './router/useRouter'

// access: 'public' | 'guest' (signed-out only) | 'student'
const ROUTES = [
  { pattern: '/', Page: LandingPage, access: 'public' },
  { pattern: '/courses', Page: CatalogPage, access: 'public' },
  { pattern: '/courses/:slug', Page: CourseDetailPage, access: 'public' },
  { pattern: '/login', Page: LoginPage, access: 'guest' },
  { pattern: '/register', Page: RegisterPage, access: 'guest' },
  { pattern: '/dashboard', Page: DashboardPage, access: 'student' },
  { pattern: '/my-courses/:courseId', Page: LearnPage, access: 'student' },
]

function resolve(path) {
  for (const route of ROUTES) {
    const params = matchPath(route.pattern, path)
    if (params) return { ...route, params }
  }
  return { Page: NotFoundPage, access: 'public', params: {} }
}

function StudentOnly() {
  const { logout } = useAuth()
  return (
    <div className="container">
      <div className="state state--page">
        <p className="state__title">This area is for students</p>
        <Alert tone="info">
          You are signed in with an account that is not a Student account. Log out and sign in as
          a student to see your dashboard.
        </Alert>
        <div className="state__actions">
          <Link to="/courses" className="btn btn--secondary">
            Browse courses
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
  const { status, isStudent } = useAuth()
  const { path, fullPath, query } = useRouter()
  const { Page, access, params } = resolve(path)

  let content
  if (access !== 'public' && status === 'checking') {
    content = <LoadingState label="Checking your session…" />
  } else if (access === 'guest' && status === 'authenticated') {
    content = <Redirect to={safeNextPath(query.get('next'), isStudent ? '/dashboard' : '/courses')} />
  } else if (access === 'student' && status !== 'authenticated') {
    content = <Redirect to={loginPath(fullPath)} />
  } else if (access === 'student' && !isStudent) {
    content = <StudentOnly />
  } else {
    content = <Page key={path} params={params} />
  }

  return <Layout>{content}</Layout>
}
