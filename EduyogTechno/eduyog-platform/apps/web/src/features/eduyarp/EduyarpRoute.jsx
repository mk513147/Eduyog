import { MotionConfig } from 'motion/react'
import { useEffect, useState } from 'react'
import '@fontsource-variable/inter'
import EduyarpApp from './EduyarpApp'
import { AuthProvider } from './auth/AuthProvider'
import { NotificationsProvider } from './notifications/NotificationsProvider'
import './styles/tokens.css'
import './styles/base.css'
import './styles/premium.css'
import './styles/learn.css'
import './styles/account.css'
import './styles/notifications.css'
import './styles/assignments.css'
import './styles/certificates.css'

const DESCRIPTION = 'Eduyarp by Eduyog: professional training and technical courses with live classes.'

// Lazy-loaded module for every Eduyarp and account route: the providers (session, notifications),
// motion, icons, Inter and the scoped CSS live behind this import, so the homepage downloads none of
// it. The shell mounts this once for all of its routes, so the session and notification state
// survive navigation between them; it unmounts (and every listener and timer is removed) when the
// visitor leaves for another section. Each page sets its own title (usePageTitle).
export default function EduyarpRoute({ route }) {
  // The title and description of whatever was on screen before, restored when Eduyarp unmounts.
  const [previous] = useState(() => ({
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null,
  }))

  useEffect(() => {
    const meta = document.querySelector('meta[name="description"]')
    meta?.setAttribute('content', DESCRIPTION)
    return () => {
      document.title = previous.title
      if (meta && previous.description !== null) meta.setAttribute('content', previous.description)
    }
  }, [previous])

  return (
    // As in the original app: movement is turned off for visitors who prefer reduced motion.
    // .eduyarp-site is the root every Eduyarp style is scoped to (the standalone app's #root).
    <div className="eduyarp-site">
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <NotificationsProvider>
            <EduyarpApp route={route} />
          </NotificationsProvider>
        </AuthProvider>
      </MotionConfig>
    </div>
  )
}
