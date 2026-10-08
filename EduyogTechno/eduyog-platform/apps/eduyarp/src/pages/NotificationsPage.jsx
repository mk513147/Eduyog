import { useCallback, useEffect, useState } from 'react'
import { notificationsApi } from '../api/endpoints'
import { Icon } from '../components/Icon'
import { Alert, EmptyState, ErrorState, LoadingState, Spinner } from '../components/States'
import { usePageTitle } from '../hooks/usePageTitle'
import { isInternalPath } from '../notifications/paths'
import { useNotifications } from '../notifications/useNotifications'
import { useRouter } from '../router/useRouter'
import { formatDateTime, formatRelative } from '../utils/format'

const PAGE_SIZE = 20

export default function NotificationsPage() {
  usePageTitle('Notifications')
  const { navigate } = useRouter()
  const shared = useNotifications()
  const [filter, setFilter] = useState('all')
  const [state, setState] = useState({ items: [], total: 0, unreadCount: 0, loading: true, error: null })
  const [loadingMore, setLoadingMore] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await notificationsApi.list({ limit: PAGE_SIZE, unread: filter === 'unread' })
      setState({ items: data.notifications, total: data.total, unreadCount: data.unreadCount, loading: false, error: null })
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, error }))
    }
  }, [filter])

  useEffect(() => {
    // Starts a fresh load whenever the filter changes.
    setState((prev) => ({ ...prev, loading: true, error: null }))
    load()
  }, [load])

  const loadMore = async () => {
    setLoadingMore(true)
    setActionError(null)
    try {
      const data = await notificationsApi.list({ limit: PAGE_SIZE, offset: state.items.length, unread: filter === 'unread' })
      setState((prev) => ({
        ...prev,
        items: [...prev.items, ...data.notifications.filter((n) => !prev.items.some((p) => p.id === n.id))],
        total: data.total,
        unreadCount: data.unreadCount,
      }))
    } catch (error) {
      setActionError(error.message)
    } finally {
      setLoadingMore(false)
    }
  }

  const markOne = async (item, { thenOpen = false } = {}) => {
    setActionError(null)
    try {
      if (!item.read) {
        await notificationsApi.markRead(item.id)
        // In the unread view a notification leaves the list once it is read.
        setState((prev) => ({
          ...prev,
          items:
            filter === 'unread'
              ? prev.items.filter((n) => n.id !== item.id)
              : prev.items.map((n) => (n.id === item.id ? { ...n, read: true } : n)),
          total: filter === 'unread' ? Math.max(0, prev.total - 1) : prev.total,
          unreadCount: Math.max(0, prev.unreadCount - 1),
        }))
        shared.refresh()
      }
    } catch (error) {
      setActionError(error.message)
      return
    }
    if (thenOpen && isInternalPath(item.linkPath)) navigate(item.linkPath)
  }

  const markAll = async () => {
    setBusy(true)
    setActionError(null)
    try {
      await notificationsApi.markAllRead()
      shared.refresh()
      await load()
    } catch (error) {
      setActionError(error.message)
    } finally {
      setBusy(false)
    }
  }

  const { items, total, unreadCount, loading, error } = state

  return (
    <div className="container page">
      <header className="page__header">
        <p className="eyebrow">Your account</p>
        <h1 className="page__title">Notifications</h1>
        <p className="page__lead">
          {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up.'}
        </p>
      </header>

      <div className="notify-toolbar">
        <div className="notify-tabs" role="group" aria-label="Show">
          {[
            ['all', 'All'],
            ['unread', 'Unread'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`notify-tab${filter === value ? ' notify-tab--active' : ''}`}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn--secondary btn--sm" onClick={markAll} disabled={busy || unreadCount === 0}>
          {busy ? <Spinner size="sm" /> : <Icon name="check" size={16} />}
          Mark all as read
        </button>
      </div>

      {actionError && <Alert>{actionError}</Alert>}

      {loading && <LoadingState label="Loading notifications…" />}
      {error && items.length === 0 && !loading && <ErrorState error={error} onRetry={load} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState
          title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          description="Class updates and announcements for your courses will appear here."
        />
      )}

      {items.length > 0 && (
        <ul className="notify-list">
          {items.map((item) => {
            const canOpen = isInternalPath(item.linkPath)
            return (
              <li key={item.id} className={`notify${item.read ? '' : ' notify--unread'}`}>
                <span className="notify__dot" aria-hidden="true" />
                <div className="notify__main">
                  <div className="notify__top">
                    <h2 className="notify__title">
                      {item.title}
                      {!item.read && <span className="visually-hidden"> (unread)</span>}
                    </h2>
                    <time className="notify__time" dateTime={item.createdAt} title={formatDateTime(item.createdAt)}>
                      {formatRelative(item.createdAt)}
                    </time>
                  </div>
                  {item.body && <p className="notify__body">{item.body}</p>}
                  {item.courseTitle && <p className="notify__course">{item.courseTitle}</p>}
                  <div className="notify__actions">
                    {canOpen && (
                      <button type="button" className="btn btn--secondary btn--sm" onClick={() => markOne(item, { thenOpen: true })}>
                        Open
                        <span className="visually-hidden">: {item.title}</span>
                      </button>
                    )}
                    {!item.read && (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => markOne(item)}>
                        Mark as read
                        <span className="visually-hidden">: {item.title}</span>
                      </button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {items.length > 0 && items.length < total && (
        <div className="notify-more">
          <button type="button" className="btn btn--secondary" onClick={loadMore} disabled={loadingMore}>
            {loadingMore && <Spinner size="sm" />}
            Load more
          </button>
          <span className="muted small">
            Showing {items.length} of {total}
          </span>
        </div>
      )}
    </div>
  )
}
