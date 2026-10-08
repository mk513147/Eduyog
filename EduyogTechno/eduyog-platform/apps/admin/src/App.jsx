import { useAuth } from './auth/useAuth'
import { Layout } from './components/Layout'
import { LoadingState } from './components/States'
import FitnessLeadsPage from './pages/FitnessLeadsPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import OverviewPage from './pages/OverviewPage'
import PlatformsPage from './pages/PlatformsPage'
import ServicesPage from './pages/ServicesPage'
import UsersPage from './pages/UsersPage'
import CertificatesPage from './pages/eduyarp/CertificatesPage'
import ClassesPage from './pages/eduyarp/ClassesPage'
import CourseDetailPage from './pages/eduyarp/CourseDetailPage'
import CoursesPage from './pages/eduyarp/CoursesPage'
import AnnouncementsPage from './pages/eduyarp/AnnouncementsPage'
import EnrolmentsPage from './pages/eduyarp/EnrolmentsPage'
import TrainersPage from './pages/eduyarp/TrainersPage'
import { Redirect } from './router/Redirect'
import { useRouter } from './router/useRouter'

const PROTECTED_ROUTES = {
  '/': OverviewPage,
  '/platforms': PlatformsPage,
  '/services': ServicesPage,
  '/users': UsersPage,
  '/fitness-leads': FitnessLeadsPage,
  '/eduyarp/courses': CoursesPage,
  '/eduyarp/trainers': TrainersPage,
  '/eduyarp/enrolments': EnrolmentsPage,
  '/eduyarp/classes': ClassesPage,
  '/eduyarp/announcements': AnnouncementsPage,
  '/eduyarp/certificates': CertificatesPage,
}

// Routes with an id segment, e.g. /eduyarp/courses/12.
const PARAM_ROUTES = [{ pattern: /^\/eduyarp\/courses\/(\d+)$/, Page: CourseDetailPage }]

function resolve(path) {
  if (PROTECTED_ROUTES[path]) return { Page: PROTECTED_ROUTES[path], params: {} }
  for (const route of PARAM_ROUTES) {
    const match = route.pattern.exec(path)
    if (match) return { Page: route.Page, params: { id: match[1] } }
  }
  return { Page: NotFoundPage, params: {} }
}

export default function App() {
  const { status } = useAuth()
  const { path } = useRouter()

  if (status === 'checking') {
    return (
      <div className="fullscreen-center">
        <LoadingState label="Checking your session…" />
      </div>
    )
  }

  if (path === '/login') {
    return status === 'authenticated' ? <Redirect to="/" /> : <LoginPage />
  }

  // Every other route requires a signed-in Admin.
  if (status !== 'authenticated') {
    return <Redirect to="/login" />
  }

  const { Page, params } = resolve(path)
  return (
    <Layout>
      <Page key={path} params={params} />
    </Layout>
  )
}
