import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import '@fontsource-variable/inter'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import { NotificationsProvider } from './notifications/NotificationsProvider'
import { RouterProvider } from './router/RouterProvider'
import './styles/tokens.css'
import './index.css'
import './styles/premium.css'
import './styles/learn.css'
import './styles/account.css'
import './styles/notifications.css'
import './styles/assignments.css'
import './styles/certificates.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <RouterProvider>
        <AuthProvider>
          <NotificationsProvider>
            <App />
          </NotificationsProvider>
        </AuthProvider>
      </RouterProvider>
    </MotionConfig>
  </StrictMode>,
)
