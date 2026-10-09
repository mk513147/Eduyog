import { useState } from 'react'
import { eduyarpApi } from '../../api/endpoints'
import { CourseStatusBadge } from '../../components/Badge'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { Alert, EmptyState, ErrorState, LoadingState } from '../../components/States'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { useResource } from '../../hooks/useResource'
import { Link } from '../../router/Link'
import { useToast } from '../../toast/useToast'
import { formatFee, LEVEL_LABELS } from '../../utils/labels'
import { CourseFormModal } from './CourseFormModal'

// Publish / unpublish / archive in one click: [label, next status].
function statusActions(status) {
  if (status === 'draft') return [['Publish', 'published'], ['Archive', 'archived']]
  if (status === 'published') return [['Unpublish', 'draft'], ['Archive', 'archived']]
  return [['Restore to draft', 'draft']]
}

export default function CoursesPage() {
  const { data: courses, error, loading, reload } = useResource(eduyarpApi.courses.list)
  useAutoRefresh(reload, { enabled: Boolean(courses) })
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [changingId, setChangingId] = useState(null)

  const handleSaved = (course) => {
    setCreating(false)
    toast.success(`Added ${course.title}. Add modules and topics next.`)
    reload()
  }

  const changeStatus = async (course, status) => {
    setChangingId(course.id)
    try {
      const updated = await eduyarpApi.courses.update(course.id, { status })
      toast.success(`${updated.title} is now ${updated.status}.`)
      reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setChangingId(null)
    }
  }

  const confirmDelete = async () => {
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      await eduyarpApi.courses.remove(deleting.id)
      toast.success(`Deleted ${deleting.title}.`)
      setDeleting(null)
      reload()
    } catch (err) {
      // 409 when the course has enrolments.
      setDeleteError(err.message)
    } finally {
      setDeleteBusy(false)
    }
  }

  const addButton = (
    <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
      <Icon name="plus" /> Add course
    </button>
  )

  let content
  if (loading) content = <LoadingState label="Loading courses…" />
  else if (error && !courses) content = <ErrorState error={error} onRetry={reload} />
  else if (courses.length === 0)
    content = (
      <EmptyState
        title="No courses yet"
        description="Create a course, add its modules and topics, then publish it to the Eduyarp catalogue."
        action={addButton}
      />
    )
  else
    content = (
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Course</th>
              <th scope="col">Level</th>
              <th scope="col">Fee</th>
              <th scope="col">Status</th>
              <th scope="col">Content</th>
              <th scope="col">Trainers</th>
              <th scope="col">Enrolments</th>
              <th scope="col" className="table__actions-head">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <tr key={course.id}>
                <td>
                  <Link to={`/eduyarp/courses/${course.id}`} className="cell-primary cell-link">
                    {course.title}
                  </Link>
                  <div className="cell-secondary">/{course.slug}</div>
                </td>
                <td className="cell-nowrap">{LEVEL_LABELS[course.level]}</td>
                <td className="cell-nowrap">{formatFee(course.fee)}</td>
                <td>
                  <CourseStatusBadge status={course.status} />
                </td>
                <td className="cell-nowrap">
                  {course.moduleCount} modules · {course.topicCount} topics
                </td>
                <td>
                  {course.trainers.length > 0 ? (
                    course.trainers.map((t) => t.fullName).join(', ')
                  ) : (
                    <span className="muted">None</span>
                  )}
                </td>
                <td>{course.enrolmentCount}</td>
                <td>
                  <div className="row-actions">
                    <Link to={`/eduyarp/courses/${course.id}`} className="btn btn--secondary btn--sm">
                      Manage
                    </Link>
                    {statusActions(course.status).map(([label, status]) => (
                      <button
                        key={status}
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => changeStatus(course, status)}
                        disabled={changingId === course.id}
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="btn btn--danger-ghost btn--sm"
                      onClick={() => {
                        setDeleteError(null)
                        setDeleting(course)
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
        title="Eduyarp Courses"
        description="Only published courses appear in the public catalogue and accept enrolments."
        actions={courses?.length > 0 && addButton}
      />
      {error && courses && <Alert>Could not refresh the list: {error.message}</Alert>}
      <div className="card card--flush">{content}</div>

      {creating && <CourseFormModal course={null} onClose={() => setCreating(false)} onSaved={handleSaved} />}

      {deleting && (
        <ConfirmDialog
          title="Delete course?"
          confirmLabel="Delete course"
          tone="danger"
          busy={deleteBusy}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        >
          <p>
            <strong>{deleting.title}</strong> and all its modules, topics, trainer assignments and
            classes will be permanently deleted. Courses with enrolments cannot be deleted; archive
            them instead.
          </p>
        </ConfirmDialog>
      )}
    </>
  )
}
