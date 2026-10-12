import { useLayoutEffect } from 'react'
import AdminApp from './AdminApp'
import { AuthProvider } from './auth/AuthProvider'
import { ToastProvider } from './toast/ToastProvider'
import './styles/base.css'
import './styles/dashboard.css'

const DEFAULT_TITLE = 'Eduyog Admin'

// Lazy-loaded module for every /admin route: the providers (toasts, the Admin session), the pages and the
// scoped CSS live behind this import, so public visitors download none of it. The shell mounts it once for
// all Admin routes, so the session survives navigation between them; it unmounts (and the auto-refresh
// timers and listeners are removed) when the visitor leaves for another section.
export default function AdminRoute({ route }) {
  // Like the standalone app's index.html: a default title, and the console is kept out of search results.
  // Layout effects run before the pages' own title effects, so a page title still wins.
  useLayoutEffect(() => {
    const previousTitle = document.title
    document.title = DEFAULT_TITLE
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex, nofollow'
    document.head.appendChild(robots)
    return () => {
      document.title = previousTitle
      robots.remove()
    }
  }, [])

  return (
    // .eduyog-admin is the root every Admin style is scoped to (the standalone app's #root).
    <div className="eduyog-admin">
      <ToastProvider>
        <AuthProvider>
          <AdminApp route={route} />
        </AuthProvider>
      </ToastProvider>
    </div>
  )
}
