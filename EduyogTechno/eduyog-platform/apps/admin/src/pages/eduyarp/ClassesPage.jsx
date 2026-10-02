import { useState } from 'react'
import { eduyarpApi } from '../../api/endpoints'
import { ClassStatusBadge } from '../../components/Badge'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { Alert, EmptyState, ErrorState, LoadingState } from '../../components/States'
import { useResource } from '../../hooks/useResource'
import { Link } from '../../router/Link'
import { useToast } from '../../toast/useToast'
import { formatDateTime } from '../../utils/format'
import { ClassFormModal } from './ClassFormModal'

export default function ClassesPage() {
  const { data: classes, error, loading, reload } = useResource(eduyarpApi.classes.list)
  const courses = useResource(eduyarpApi.courses.list)
  const toast = useToast()
  // null = closed, { cls: null } = create, { cls } = edit
  const [formState, setFormState] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const handleSaved = (cls, isEdit) => {
    setFormState(null)
    toast.success(isEdit ? `Saved ${cls.title}.` : `Scheduled ${cls.title}.`)
    reload()
  }

  const confirmDelete = async () => {
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      await eduyarpApi.classes.remove(deleting.id)
      toast.success(`Deleted ${deleting.title}.`)
      setDeleting(null)
      reload()
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleteBusy(false)
    }
  }

  const canSchedule = Boolean(courses.data)
  const addButton = (
    <button
      type="button"
      className="btn btn--primary"
      onClick={() => setFormState({ cls: null })}
      disabled={!canSchedule}
    >
      <Icon name="plus" /> Schedule class
    </button>
  )

  let content
  if (loading) content = <LoadingState label="Loading classes…" />
  else if (error && !classes) content = <ErrorState error={error} onRetry={reload} />
  else if (classes.length === 0)
    content = (
      <EmptyState
        title="No classes scheduled"
        description="Schedule live classes for a course. Enrolled students see them on their dashboard."
        action={addButton}
      />
    )
  else
    content = (
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Class</th>
              <th scope="col">Course</th>
              <th scope="col">Trainer</th>
              <th scope="col">Date and time</th>
              <th scope="col">Status</th>
              <th scope="col" className="table__actions-head">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {classes.map((cls) => (
              <tr key={cls.id}>
                <td>
                  <div className="cell-primary">{cls.title}</div>
                  {cls.meetingLink ? (
                    <a
                      className="external-link cell-secondary"
                      href={cls.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Meeting link <Icon name="external" />
                    </a>
                  ) : (
                    <div className="cell-secondary">No meeting link</div>
                  )}
                </td>
                <td>
                  <Link to={`/eduyarp/courses/${cls.courseId}`}>{cls.courseTitle}</Link>
                </td>
                <td>{cls.trainerName}</td>
                <td className="cell-nowrap">{formatDateTime(cls.scheduledAt)}</td>
                <td>
                  <ClassStatusBadge status={cls.status} />
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => setFormState({ cls })}
                      disabled={!canSchedule}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger-ghost btn--sm"
                      onClick={() => {
                        setDeleteError(null)
                        setDeleting(cls)
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )

  return (
    <>
      <PageHeader
        title="Eduyarp Classes"
        description="Live classes with a meeting link. Students see classes for courses they are enrolled in."
        actions={classes?.length > 0 && addButton}
      />
      {courses.error && <Alert>Courses could not be loaded: {courses.error.message}</Alert>}
      {error && classes && <Alert>Could not refresh the list: {error.message}</Alert>}
      <div className="card card--flush">{content}</div>

      {formState && courses.data && (
        <ClassFormModal
          cls={formState.cls}
          courses={courses.data}
          onClose={() => setFormState(null)}
          onSaved={handleSaved}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete class?"
          confirmLabel="Delete class"
          tone="danger"
          busy={deleteBusy}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        >
          <p>
            <strong>{deleting.title}</strong> will be permanently deleted and removed from students&apos;
            schedules. To keep it visible as cancelled, edit its status instead.
          </p>
        </ConfirmDialog>
      )}
    </>
  )
}
