import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { BASE_PATH } from './config'
import { RouterProvider } from './router/RouterProvider'
import { staticSiteRedirect } from './staticSites'
import './styles/global.css'
import './styles/eduyog-site.css'
import './styles/shell.css'

// "/saritex" or "/studentaq" reached the React shell (a host SPA fallback, or the dev server) instead
// of the static site's own index.html: go to the real page rather than render the not-found route.
const staticEntry = staticSiteRedirect(window.location.pathname, BASE_PATH)

if (staticEntry) {
  window.location.replace(staticEntry + window.location.search + window.location.hash)
} else {
  // Providers are added here as the shell grows. Authentication is deliberately not set up yet (see
  // README): Eduyarp/Admin JWT sessions and the Supabase workflow must be reviewed before any
  // shared auth provider exists.
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <RouterProvider>
        <App />
      </RouterProvider>
    </StrictMode>,
  )
}
