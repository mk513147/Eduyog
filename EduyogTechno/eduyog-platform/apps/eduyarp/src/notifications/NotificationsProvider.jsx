import { useCallback, useEffect, useMemo, useState } from 'react'
import { notificationsApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { NotificationsContext } from './NotificationsContext'

const PREVIEW_COUNT = 6
const EMPTY = { unreadCount: 0, items: [], loaded: false, error: null }

// Shared notification state for the header bell: the unread count and the latest few
// notifications. There is no polling; it refreshes when a user signs in, when the
// route changes (the bell asks), when the tab regains focus, and after every action.
export function NotificationsProvider({ children }) {
  const { status } = useAuth()
  const signedIn = status === 'authenticated'
  const [state, setState] = useState(EMPTY)

  const refresh = useCallback(async () => {
    if (!signedIn) return
    try {
      const data = await notificationsApi.list({ limit: PREVIEW_COUNT })
      setState({ unreadCount: data.unreadCount, items: data.notifications, loaded: true, error: null })
    } catch (error) {
      setState((prev) => ({ ...prev, error }))
    }
  }, [signedIn])

  useEffect(() => {
    // Signing out clears everything; signing in loads the first page.
    if (!signedIn) setState(EMPTY)
    else refresh()
  }, [signedIn, refresh])

  useEffect(() => {
    if (!signedIn) return undefined
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [signedIn, refresh])

  const markRead = useCallback(
    async (id) => {
      await notificationsApi.markRead(id)
      await refresh()
    },
    [refresh],
  )

  const markAllRead = useCallback(async () => {
    await notificationsApi.markAllRead()
    await refresh()
  }, [refresh])

  const value = useMemo(() => ({ ...state, refresh, markRead, markAllRead }), [state, refresh, markRead, markAllRead])

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}
