import { useCallback, useState } from 'react'
import { eduyarpApi } from '../../api/endpoints'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { Alert, EmptyState, ErrorState, LoadingState } from '../../components/States'
import { useResource } from '../../hooks/useResource'
import { Link } from '../../router/Link'
import { useToast } from '../../toast/useToast'
import { formatDateTime } from '../../utils/format'
import { AnnouncementFormModal } from './AnnouncementFormModal'

export default function AnnouncementsPage() {
  // '' = all, 'platform' = platform-wide only, otherwise a course id.
  const [filter, setFilter] = useState('')
  const loader = useCallback(() => eduyarpApi.announcements.list(filter), [filter])
  const { data: announcements, error, loading, reload } = useResource(loader)
  const courses = useResource(eduyarpApi.courses.list, { refetchOnFocus: true })
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const handleSaved = (announcement) => {
    setCreating(false)
    const people = announcement.notifiedCount
    toast.success(`Posted. ${people} ${people === 1 ? 'person was' : 'people were'} notified.`)
    reload()
  }

  const confirmDelete = async () => {
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      await eduyarpApi.announcements.remove(deleting.id)
      toast.success('Announcement deleted.')
      setDeleting(null)
      reload()
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleteBusy(false)
    }
  }

  const newButton = (
    <button type="button" className="btn btn--primary" onClick={() => setCreating(true)} disabled={!courses.data}>
      <Icon name="plus" /> New announcement
    </button>
  )

  let content
  if (loading) content = <LoadingState label="Loading announcements…" />
  else if (error && !announcements) content = <ErrorState error={error} onRetry={reload} />
  else if (announcements.length === 0)
    content = (
      <div className="card card--flush">
        <EmptyState
          title={filter ? 'No announcements match this filter' : 'No announcements yet'}
          description="Announcements notify the students currently taking a course, or every current student."
          action={!filter && newButton}
        />
      </div>
    )
  else
    content = (
      <ul className="announce-list">
        {announcements.map((a) => (
          <li key={a.id} className="card announce">
            <div className="announce__meta">
              <div className="announce__tags">
                {a.platformWide ? (
                  <span className="badge badge--primary">All courses</span>
                ) : (
                  <Link to={`/eduyarp/courses/${a.courseId}`}>{a.courseTitle}</Link>
                )}
                <span className="cell-secondary">
                  {a.authorName} · {formatDateTime(a.createdAt)}
                </span>
              </div>
              <button
                type="button"
                className="btn btn--danger-ghost btn--sm"
                onClick={() => {
                  setDeleteError(null)
                  setDeleting(a)
                }}
              >
                Delete<span className="visually-hidden"> announcement: {a.title}</span>
              </button>
            </div>
            <h2 className="announce__title">{a.title}</h2>
            <p className="announce__body">{a.body}</p>
          </li>
        ))}
      </ul>
    )

  return (
    <>
      <PageHeader
        title="Eduyarp Announcements"
        description="Messages to students. A course announcement reaches that course's current students and trainers; a platform-wide one reaches every current student once."
        actions={announcements && newButton}
      />
      {courses.error && <Alert>Courses could not be loaded: {courses.error.message}</Alert>}
      {error && announcements && <Alert>Could not refresh the list: {error.message}</Alert>}

      <div className="filters announce-filters">
        <select
          className="input"
          aria-label="Filter by course"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="">All announcements</option>
          <option value="platform">Platform-wide only</option>
          {(courses.data ?? []).map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>
      </div>

      {content}

      {creating && courses.data && (
        <AnnouncementFormModal courses={courses.data} onClose={() => setCreating(false)} onSaved={handleSaved} />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete announcement?"
          confirmLabel="Delete announcement"
          tone="danger"
          busy={deleteBusy}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        >
          <p>
            <strong>{deleting.title}</strong> will be permanently deleted. Notifications already sent stay in
            students&apos; lists.
          </p>
        </ConfirmDialog>
      )}
    </>
  )
}
