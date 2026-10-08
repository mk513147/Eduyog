import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { Link } from '../router/Link'
import { useRouter } from '../router/useRouter'
import { formatRelative } from '../utils/format'
import { isInternalPath } from './paths'
import { useNotifications } from './useNotifications'

// `watch` makes this instance re-check the count on every page change; the header
// renders two bells (phone and desktop layouts) and only one of them should do that.
export function NotificationBell({ className = '', watch = false }) {
  const { unreadCount, items, loaded, error, refresh, markRead, markAllRead } = useNotifications()
  const { path, navigate } = useRouter()
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)
  const root = useRef(null)
  const panelId = useId()

  // The count is re-checked whenever the page changes, so it does not go stale.
  useEffect(() => {
    if (watch) refresh()
  }, [watch, path, refresh])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => event.key === 'Escape' && setOpen(false)
    const onClick = (event) => root.current && !root.current.contains(event.target) && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  const toggle = () => {
    setFailed(false)
    if (!open) refresh()
    setOpen((value) => !value)
  }

  const openItem = async (item) => {
    setOpen(false)
    if (!item.read) {
      try {
        await markRead(item.id)
      } catch {
        // The destination still opens; the count is corrected on the next refresh.
      }
    }
    navigate(isInternalPath(item.linkPath) ? item.linkPath : '/notifications')
  }

  const readAll = async () => {
    setFailed(false)
    try {
      await markAllRead()
    } catch {
      setFailed(true)
    }
  }

  const label = unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'

  return (
    <div className={`bell ${className}`} ref={root}>
      <button
        type="button"
        className="btn btn--ghost btn--icon bell__button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
      >
        <Icon name="bell" size={20} />
        {unreadCount > 0 && (
          <span className="bell__count" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="bell__panel" id={panelId} role="region" aria-label="Notifications">
          <div className="bell__head">
            <strong>Notifications</strong>
            <button type="button" className="bell__link" onClick={readAll} disabled={unreadCount === 0}>
              Mark all as read
            </button>
          </div>
          {failed && <p className="bell__note bell__note--error">Could not update. Please try again.</p>}
          {error && !loaded && <p className="bell__note bell__note--error">Could not load notifications.</p>}
          {!error && !loaded && <p className="bell__note">Loading…</p>}
          {loaded && items.length === 0 && <p className="bell__note">You have no notifications yet.</p>}
          {items.length > 0 && (
            <ul className="bell__list">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`bell__item${item.read ? '' : ' bell__item--unread'}`}
                    onClick={() => openItem(item)}
                  >
                    <span className="bell__dot" aria-hidden="true" />
                    <span className="bell__text">
                      <span className="bell__title">
                        {item.title}
                        {!item.read && <span className="visually-hidden"> (unread)</span>}
                      </span>
                      {item.body && <span className="bell__body">{item.body}</span>}
                      <span className="bell__time">
                        {item.courseTitle ? `${item.courseTitle} · ` : ''}
                        {formatRelative(item.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="bell__foot">
            <Link to="/notifications" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
