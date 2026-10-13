import { useAuth } from './auth/useAuth'
import { Layout } from './components/Layout'
import { LoadingState } from './components/States'
import { resolveAdminAccess } from './access'
import FitnessLeadsPage from './pages/FitnessLeadsPage'
import StudentaqEnquiriesPage from './pages/StudentaqEnquiriesPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import OverviewPage from './pages/OverviewPage'
import PlatformsPage from './pages/PlatformsPage'
import RegistrationsPage from './pages/RegistrationsPage'
import ServicesPage from './pages/ServicesPage'
import UsersPage from './pages/UsersPage'
import AnnouncementsPage from './pages/eduyarp/AnnouncementsPage'
import CertificatesPage from './pages/eduyarp/CertificatesPage'
import ClassesPage from './pages/eduyarp/ClassesPage'
import CourseDetailPage from './pages/eduyarp/CourseDetailPage'
import CoursesPage from './pages/eduyarp/CoursesPage'
import EnrolmentsPage from './pages/eduyarp/EnrolmentsPage'
import TrainersPage from './pages/eduyarp/TrainersPage'
import { Redirect } from './router/Redirect'
import { useRouter } from './router/useRouter'

// Route id (see src/routes.js) -> page. The route table owns the paths and params.
const PAGES = {
  'admin-overview': OverviewPage,
  'admin-platforms': PlatformsPage,
  'admin-services': ServicesPage,
  'admin-users': UsersPage,
  'admin-registrations': RegistrationsPage,
  'admin-fitness-leads': FitnessLeadsPage,
  'admin-studentaq-enquiries': StudentaqEnquiriesPage,
  'admin-eduyarp-courses': CoursesPage,
  'admin-eduyarp-course': CourseDetailPage,
  'admin-eduyarp-trainers': TrainersPage,
  'admin-eduyarp-enrolments': EnrolmentsPage,
  'admin-eduyarp-classes': ClassesPage,
  'admin-eduyarp-announcements': AnnouncementsPage,
  'admin-eduyarp-certificates': CertificatesPage,
  'admin-not-found': NotFoundPage,
}

// Adapted from apps/admin/src/App.jsx; the access rules are unchanged. `route` comes from the shell's
// route table (id, params).
export default function AdminApp({ route }) {
  const { status } = useAuth()
  const { path } = useRouter()
  const decision = resolveAdminAccess({ status, routeId: route.id })

  if (decision.type === 'loading') {
    return (
      <div className="fullscreen-center">
        <LoadingState label="Checking your session…" />
      </div>
    )
  }
  if (decision.type === 'login') return <LoginPage />
  if (decision.type === 'redirect') return <Redirect to={decision.to} />

  const Page = PAGES[route.id] ?? NotFoundPage
  return (
    <Layout>
      <Page key={path} params={route.params} />
    </Layout>
  )
}
