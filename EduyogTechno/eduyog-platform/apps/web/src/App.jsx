import { Fragment, lazy, Suspense } from 'react'
import { RouteBoundary, RouteLoading } from './components/RouteBoundary'
import HomePage from './features/home/HomePage'
import { PublicLayout } from './layouts/PublicLayout'
import NotFoundPage from './pages/NotFoundPage'
import { useRouter } from './router/useRouter'
import { resolveRoute } from './routes'

// Feature modules are lazy-loaded so the homepage does not pay for them.
const FitnessRoute = lazy(() => import('./features/fitness/FitnessRoute'))
const EduyarpRoute = lazy(() => import('./features/eduyarp/EduyarpRoute'))
const AdminRoute = lazy(() => import('./features/admin/AdminRoute'))

const PAGES = {
  home: HomePage,
  fitness: FitnessRoute,
  'not-found': NotFoundPage,
}

// Routes with a `module` are rendered by that module (it receives the resolved route and picks its
// own page), so all of its routes share one mounted instance.
const MODULES = {
  eduyarp: EduyarpRoute,
  admin: AdminRoute,
}

const LAYOUTS = {
  public: PublicLayout,
  none: Fragment,
}

export default function App() {
  const { path } = useRouter()
  const route = resolveRoute(path)
  const Page = (route.module && MODULES[route.module]) || PAGES[route.id]
  const Layout = LAYOUTS[route.layout]

  return (
    <Layout>
      {/* key: a failed page is retried when the visitor navigates to another route or module */}
      <RouteBoundary key={route.module ?? route.id}>
        <Suspense fallback={<RouteLoading />}>
          <Page route={route} />
        </Suspense>
      </RouteBoundary>
    </Layout>
  )
}
