import { useAuth } from '../auth/useAuth'
import { notificationsApi } from '../api/endpoints'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { usePageTitle } from '../hooks/usePageTitle'
import { useResource } from '../hooks/useResource'
import { Link } from '../router/Link'
import { formatDateTime } from '../utils/format'

// Announcements delivered to the signed-in Student or Trainer, in full. Notifications
// carry a short excerpt and link here.
export default function AnnouncementsPage() {
  usePageTitle('Announcements')
  const { isTrainer } = useAuth()
  const { data, error, loading, reload } = useResource(notificationsApi.announcements)

  return (
    <div className="container page">
      <header className="page__header">
        <p className="eyebrow">Your courses</p>
        <h1 className="page__title">Announcements</h1>
        <p className="page__lead">Messages from Eduyog and your course trainers.</p>
      </header>

      {loading && <LoadingState label="Loading announcements…" />}
      {error && !data && <ErrorState error={error} onRetry={reload} />}
      {data && data.length === 0 && (
        <EmptyState
          title="No announcements"
          description="Announcements for your courses will appear here."
          action={
            <Link to={isTrainer ? '/trainer' : '/dashboard'} className="btn btn--secondary">
              Back to dashboard
            </Link>
          }
        />
      )}
      {data && data.length > 0 && (
        <ul className="announce-list">
          {data.map((a) => (
            <li key={a.id} className="announce card">
              <div className="announce__meta">
                <span className="badge badge--primary">
                  <Icon name="megaphone" size={14} /> {a.platformWide ? 'All courses' : a.courseTitle}
                </span>
                <span className="muted small">
                  {a.authorName} · <time dateTime={a.createdAt}>{formatDateTime(a.createdAt)}</time>
                </span>
              </div>
              <h2 className="announce__title">{a.title}</h2>
              <p className="announce__body">{a.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
