import { useCallback, useState } from 'react'
import { eduyarpApi } from '../../api/endpoints'
import { CourseStatusBadge } from '../../components/Badge'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { Alert, EmptyState, ErrorState, LoadingState, Spinner } from '../../components/States'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { useResource } from '../../hooks/useResource'
import { Link } from '../../router/Link'
import { useToast } from '../../toast/useToast'
import { formatFee, LEVEL_LABELS } from '../../utils/labels'
import { CourseContent } from './CourseContent'
import { CourseFormModal } from './CourseFormModal'
import { CurriculumItemModal } from './CurriculumItemModal'

function statusActions(status) {
  if (status === 'draft') return [['Publish', 'published'], ['Archive', 'archived']]
  if (status === 'published') return [['Unpublish', 'draft'], ['Archive', 'archived']]
  return [['Restore to draft', 'draft']]
}

function TrainersCard({ course, onChanged }) {
  const toast = useToast()
  const trainers = useResource(eduyarpApi.trainers.list)
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const [removingId, setRemovingId] = useState(null)

  const assignedIds = new Set(course.trainers.map((t) => t.id))
  const available = (trainers.data ?? []).filter((t) => !assignedIds.has(t.id))

  const assign = async (event) => {
    event.preventDefault()
    if (!selected) return
    setBusy(true)
    try {
      await eduyarpApi.courses.assignTrainer(course.id, selected)
      toast.success('Trainer assigned.')
      setSelected('')
      onChanged()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (trainer) => {
    setRemovingId(trainer.id)
    try {
      await eduyarpApi.courses.unassignTrainer(course.id, trainer.id)
      toast.success(`${trainer.fullName} removed from this course.`)
      onChanged()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <section className="card" aria-labelledby="trainers-title">
      <h2 id="trainers-title" className="section-title">
        Trainers
      </h2>
      {course.trainers.length === 0 ? (
        <p className="muted">No trainer assigned yet.</p>
      ) : (
        <ul className="plain-list">
          {course.trainers.map((trainer) => (
            <li key={trainer.id} className="plain-list__item">
              <div>
                <div className="cell-primary">{trainer.fullName}</div>
                <div className="cell-secondary cell-break">{trainer.email}</div>
              </div>
              <button
                type="button"
                className="btn btn--danger-ghost btn--sm"
                onClick={() => remove(trainer)}
                disabled={removingId === trainer.id}
              >
                Remove
                <span className="visually-hidden"> {trainer.fullName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {trainers.error ? (
        <Alert>Trainers could not be loaded: {trainers.error.message}</Alert>
      ) : trainers.data && trainers.data.length === 0 ? (
        <p className="muted small">
          No users have the Trainer role yet. Change a user&apos;s role on the{' '}
          <Link to="/users">Users</Link> page first.
        </p>
      ) : (
        <form className="inline-form" onSubmit={assign}>
          <label className="visually-hidden" htmlFor="assign-trainer">
            Trainer to assign
          </label>
          <select
            id="assign-trainer"
            className="input"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={!trainers.data || available.length === 0}
          >
            <option value="">
              {available.length === 0 && trainers.data ? 'All trainers assigned' : 'Select a trainer…'}
            </option>
            {available.map((trainer) => (
              <option key={trainer.id} value={trainer.id}>
                {trainer.fullName} ({trainer.email})
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn--primary" disabled={!selected || busy}>
            {busy && <Spinner size="sm" />}
            Assign
          </button>
        </form>
      )}
    </section>
  )
}

export default function CourseDetailPage({ params }) {
  const loader = useCallback(() => eduyarpApi.courses.get(params.id), [params.id])
  const { data: course, error, loading, reload } = useResource(loader)
  useAutoRefresh(reload, { enabled: Boolean(course) })
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)
  // { kind: 'Module' | 'Topic', item, module? } while the form is open
  const [itemForm, setItemForm] = useState(null)
  // { kind, item } while confirming a delete
  const [deleting, setDeleting] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const changeStatus = async (status) => {
    setChangingStatus(true)
    try {
      await eduyarpApi.courses.update(course.id, { status })
      toast.success(`Course is now ${status}.`)
      reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setChangingStatus(false)
    }
  }

  const saveItem = (payload) => {
    const { kind, item, module } = itemForm
    if (kind === 'Module') {
      return item
        ? eduyarpApi.modules.update(item.id, payload)
        : eduyarpApi.modules.create(course.id, payload)
    }
    return item ? eduyarpApi.topics.update(item.id, payload) : eduyarpApi.topics.create(module.id, payload)
  }

  const confirmDelete = async () => {
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      const api = deleting.kind === 'Module' ? eduyarpApi.modules : eduyarpApi.topics
      await api.remove(deleting.item.id)
      toast.success(`Deleted ${deleting.item.title}.`)
      setDeleting(null)
      reload()
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleteBusy(false)
    }
  }

  if (loading) return <LoadingState label="Loading course…" />
  if (error && !course) return <ErrorState error={error} onRetry={reload} />

  const topicCount = course.modules.reduce((sum, m) => sum + m.topics.length, 0)

  return (
    <>
      <Link to="/eduyarp/courses" className="back-link">
        <Icon name="back" /> All courses
      </Link>
      <PageHeader
        title={course.title}
        description={`/${course.slug} · ${LEVEL_LABELS[course.level]} · ${course.duration || 'No duration set'} · ${formatFee(course.fee)}`}
        actions={
          <>
            <CourseStatusBadge status={course.status} />
            <button type="button" className="btn btn--secondary" onClick={() => setEditing(true)}>
              Edit details
            </button>
            {statusActions(course.status).map(([label, status]) => (
              <button
                key={status}
                type="button"
                className={`btn ${status === 'published' ? 'btn--primary' : 'btn--secondary'}`}
                onClick={() => changeStatus(status)}
                disabled={changingStatus}
              >
                {label}
              </button>
            ))}
          </>
        }
      />
      {error && <Alert>Could not refresh: {error.message}</Alert>}
      {course.status === 'published' && topicCount === 0 && (
        <Alert tone="warning">This course is published but has no topics yet.</Alert>
      )}

      <div className="course-admin">
        <section className="card" aria-labelledby="curriculum-title">
          <div className="section-head">
            <h2 id="curriculum-title" className="section-title">
              Modules and topics
            </h2>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => setItemForm({ kind: 'Module', item: null })}
            >
              <Icon name="plus" /> Add module
            </button>
          </div>

          {course.modules.length === 0 ? (
            <EmptyState
              title="No modules yet"
              description="Add a module, then add topics to it. Students mark topics complete to track progress."
            />
          ) : (
            <ol className="curriculum">
              {course.modules.map((module) => (
                <li key={module.id} className="curriculum__module">
                  <div className="curriculum__head">
                    <div>
                      <span className="curriculum__order">#{module.displayOrder}</span>
                      <span className="cell-primary">{module.title}</span>
                      {module.description && <div className="cell-secondary">{module.description}</div>}
                    </div>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => setItemForm({ kind: 'Topic', item: null, module })}
                      >
                        <Icon name="plus" /> Topic
                      </button>
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => setItemForm({ kind: 'Module', item: module })}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger-ghost btn--sm"
                        onClick={() => {
                          setDeleteError(null)
                          setDeleting({ kind: 'Module', item: module })
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {module.topics.length === 0 ? (
                    <p className="muted small curriculum__empty">No topics in this module.</p>
                  ) : (
                    <ul className="curriculum__topics">
                      {module.topics.map((topic) => (
                        <li key={topic.id} className="curriculum__topic">
                          <div>
                            <span className="curriculum__order">#{topic.displayOrder}</span>
                            {topic.title}
                            {topic.description && <div className="cell-secondary">{topic.description}</div>}
                            {topic.videoUrl && <div className="cell-secondary">Video attached</div>}
                          </div>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              onClick={() => setItemForm({ kind: 'Topic', item: topic, module })}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn--danger-ghost btn--sm"
                              onClick={() => {
                                setDeleteError(null)
                                setDeleting({ kind: 'Topic', item: topic })
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="course-admin__side">
          <TrainersCard course={course} onChanged={reload} />

          <section className="card" aria-labelledby="about-title">
            <h2 id="about-title" className="section-title">
              Course details
            </h2>
            <dl className="details details--stacked">
              <div>
                <dt>Description</dt>
                <dd className="details__message">
                  {course.description || <span className="muted">Not provided</span>}
                </dd>
              </div>
              <div>
                <dt>Learning objectives</dt>
                <dd className="details__message">
                  {course.learningObjectives || <span className="muted">Not provided</span>}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>

      <CourseContent course={course} />

      {editing && (
        <CourseFormModal
          course={course}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            toast.success('Course saved.')
            reload()
          }}
        />
      )}

      {itemForm && (
        <CurriculumItemModal
          kind={itemForm.kind}
          item={itemForm.item}
          context={itemForm.kind === 'Topic' ? `Module: ${itemForm.module.title}` : null}
          save={saveItem}
          onClose={() => setItemForm(null)}
          onSaved={(saved, isEdit) => {
            setItemForm(null)
            toast.success(isEdit ? `Saved ${saved.title}.` : `Added ${saved.title}.`)
            reload()
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.kind.toLowerCase()}?`}
          confirmLabel={`Delete ${deleting.kind.toLowerCase()}`}
          tone="danger"
          busy={deleteBusy}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        >
          <p>
            <strong>{deleting.item.title}</strong> will be permanently deleted
            {deleting.kind === 'Module' ? ', with all its topics' : ''}. Students&apos; progress on
            deleted topics is removed and course progress is recalculated.
          </p>
        </ConfirmDialog>
      )}
    </>
  )
}
