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
import { Redirect } from './router/Redirect'
import { useRouter } from './router/useRouter'

const PROTECTED_ROUTES = {
  '/': OverviewPage,
  '/platforms': PlatformsPage,
  '/services': ServicesPage,
  '/users': UsersPage,
  '/fitness-leads': FitnessLeadsPage,
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

  const Page = PROTECTED_ROUTES[path] ?? NotFoundPage
  return (
    <Layout>
      <Page key={path} />
    </Layout>
  )
}
