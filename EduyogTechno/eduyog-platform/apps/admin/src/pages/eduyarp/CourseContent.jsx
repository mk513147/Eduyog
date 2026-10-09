import { useCallback, useState } from 'react'
import { eduyarpApi } from '../../api/endpoints'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Icon } from '../../components/Icon'
import { Alert, EmptyState, ErrorState, LoadingState } from '../../components/States'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { useResource } from '../../hooks/useResource'
import { useToast } from '../../toast/useToast'
import { formatDateTime } from '../../utils/format'
import { ASSIGNMENT_STATUS_LABELS, RESOURCE_TYPE_LABELS } from '../../utils/labels'
import { AssignmentFormModal, SubmissionsModal } from './AssignmentModals'
import { FaqFormModal, ResourceFormModal } from './CourseContentModals'

const STATUS_TONES = { draft: 'badge--muted', published: 'badge--success', closed: 'badge--danger' }

function AssignmentsCard({ course }) {
  const toast = useToast()
  const loader = useCallback(() => eduyarpApi.assignments.list(course.id), [course.id])
  const { data: assignments, error, loading, reload } = useResource(loader)
  useAutoRefresh(reload, { enabled: Boolean(assignments) })
  const [form, setForm] = useState(null) // { assignment } ; null assignment = new
  const [viewing, setViewing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const setStatus = async (assignment, status) => {
    setBusyId(assignment.id)
    try {
      await eduyarpApi.assignments.update(assignment.id, { status })
      toast.success(`${assignment.title} is now ${ASSIGNMENT_STATUS_LABELS[status].toLowerCase()}.`)
      reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = async () => {
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      await eduyarpApi.assignments.remove(deleting.id)
      toast.success('Assignment deleted.')
      setDeleting(null)
      reload()
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <section className="card" aria-labelledby="assignments-title">
      <div className="section-head">
        <h2 id="assignments-title" className="section-title">
          Assignments
        </h2>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => setForm({ assignment: null })}>
          <Icon name="plus" /> Add assignment
        </button>
      </div>
      {loading && <LoadingState label="Loading assignments…" />}
      {error && !assignments && <ErrorState error={error} onRetry={reload} />}
      {assignments && assignments.length === 0 && (
        <EmptyState title="No assignments yet" description="Students answer with text and/or a link; trainers reply with written feedback. No files and no grades." />
      )}
      {assignments && assignments.length > 0 && (
        <ul className="content-list">
          {assignments.map((a) => (
            <li key={a.id} className="content-item">
              <div className="content-item__main">
                <div className="cell-primary">
                  {a.title} <span className={`badge ${STATUS_TONES[a.status]}`}>{ASSIGNMENT_STATUS_LABELS[a.status]}</span>
                </div>
                <div className="cell-secondary">
                  {a.dueAt ? `Due ${formatDateTime(a.dueAt)}` : 'No due date'}
                  {a.topicTitle ? ` · ${a.moduleTitle} › ${a.topicTitle}` : a.moduleTitle ? ` · ${a.moduleTitle}` : ''}
                  {` · ${a.studentCount} ${a.studentCount === 1 ? 'student' : 'students'} submitted (${a.submissionCount} in total)`}
                </div>
                <div className="cell-secondary content-item__text">{a.instructions}</div>
              </div>
              <div className="row-actions">
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => setViewing(a)}>
                  Submissions<span className="visually-hidden"> for {a.title}</span>
                </button>
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => setForm({ assignment: a })}>
                  Edit<span className="visually-hidden"> {a.title}</span>
                </button>
                {a.status !== 'published' && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStatus(a, 'published')} disabled={busyId === a.id}>
                    {a.status === 'closed' ? 'Reopen' : 'Publish'}
                    <span className="visually-hidden"> {a.title}</span>
                  </button>
                )}
                {a.status === 'published' && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStatus(a, 'closed')} disabled={busyId === a.id}>
                    Close<span className="visually-hidden"> {a.title}</span>
                  </button>
                )}
                {a.status !== 'draft' && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStatus(a, 'draft')} disabled={busyId === a.id}>
                    Draft<span className="visually-hidden"> {a.title}</span>
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--danger-ghost btn--sm"
                  onClick={() => {
                    setDeleteError(null)
                    setDeleting(a)
                  }}
                >
                  Delete<span className="visually-hidden"> {a.title}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <AssignmentFormModal
          courseId={course.id}
          modules={course.modules}
          assignment={form.assignment}
          onClose={() => setForm(null)}
          onSaved={(saved, isEdit) => {
            setForm(null)
            toast.success(isEdit ? 'Assignment saved.' : 'Assignment added.')
            reload()
          }}
        />
      )}
      {viewing && <SubmissionsModal assignment={viewing} onClose={() => setViewing(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Delete assignment?"
          confirmLabel="Delete assignment"
          tone="danger"
          busy={deleteBusy}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        >
          <p>
            <strong>{deleting.title}</strong> will be permanently deleted together with all student submissions and feedback.
          </p>
        </ConfirmDialog>
      )}
    </section>
  )
}

function FaqsCard({ course }) {
  const toast = useToast()
  const loader = useCallback(() => eduyarpApi.faqs.list(course.id), [course.id])
  const { data: faqs, error, loading, reload, setData } = useResource(loader)
  const [form, setForm] = useState(null) // { faq } while open; faq null = add
  const [deleting, setDeleting] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [moving, setMoving] = useState(false)

  const move = async (index, delta) => {
    const ids = faqs.map((f) => f.id)
    ;[ids[index], ids[index + delta]] = [ids[index + delta], ids[index]]
    setMoving(true)
    try {
      setData(await eduyarpApi.faqs.reorder(course.id, ids))
    } catch (err) {
      toast.error(err.message)
      reload()
    } finally {
      setMoving(false)
    }
  }

  const confirmDelete = async () => {
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      await eduyarpApi.faqs.remove(deleting.id)
      toast.success('FAQ deleted.')
      setDeleting(null)
      reload()
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <section className="card" aria-labelledby="faqs-title">
      <div className="section-head">
        <h2 id="faqs-title" className="section-title">
          FAQs
        </h2>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => setForm({ faq: null })}>
          <Icon name="plus" /> Add FAQ
        </button>
      </div>
      {loading && <LoadingState label="Loading FAQs…" />}
      {error && !faqs && <ErrorState error={error} onRetry={reload} />}
      {faqs && faqs.length === 0 && (
        <EmptyState title="No FAQs yet" description="Questions and answers shown to students of this course." />
      )}
      {faqs && faqs.length > 0 && (
        <ol className="content-list">
          {faqs.map((faq, index) => (
            <li key={faq.id} className="content-item">
              <div className="content-item__main">
                <div className="cell-primary">{faq.question}</div>
                <div className="cell-secondary content-item__text">{faq.answer}</div>
              </div>
              <div className="row-actions">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(index, -1)} disabled={index === 0 || moving}>
                  Up<span className="visually-hidden"> {faq.question}</span>
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(index, 1)} disabled={index === faqs.length - 1 || moving}>
                  Down<span className="visually-hidden"> {faq.question}</span>
                </button>
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => setForm({ faq })}>
                  Edit<span className="visually-hidden"> {faq.question}</span>
                </button>
                <button
                  type="button"
                  className="btn btn--danger-ghost btn--sm"
                  onClick={() => {
                    setDeleteError(null)
                    setDeleting(faq)
                  }}
                >
                  Delete<span className="visually-hidden"> {faq.question}</span>
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {form && (
        <FaqFormModal
          courseId={course.id}
          faq={form.faq}
          onClose={() => setForm(null)}
          onSaved={(saved, isEdit) => {
            setForm(null)
            toast.success(isEdit ? 'FAQ saved.' : 'FAQ added.')
            reload()
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete FAQ?"
          confirmLabel="Delete FAQ"
          tone="danger"
          busy={deleteBusy}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        >
          <p>
            <strong>{deleting.question}</strong> will be permanently deleted.
          </p>
        </ConfirmDialog>
      )}
    </section>
  )
}

function ResourcesCard({ course }) {
  const toast = useToast()
  const loader = useCallback(() => eduyarpApi.resources.list(course.id), [course.id])
  const { data: resources, error, loading, reload } = useResource(loader)
  useAutoRefresh(reload, { enabled: Boolean(resources) })
  const [form, setForm] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const confirmDelete = async () => {
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      await eduyarpApi.resources.remove(deleting.id)
      toast.success('Resource deleted.')
      setDeleting(null)
      reload()
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleteBusy(false)
    }
  }

  const where = (r) => (r.topicTitle ? `${r.moduleTitle} › ${r.topicTitle}` : r.moduleTitle || 'Whole course')

  return (
    <section className="card" aria-labelledby="resources-title">
      <div className="section-head">
        <h2 id="resources-title" className="section-title">
          Learning resources
        </h2>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => setForm({ resource: null })}>
          <Icon name="plus" /> Add resource
        </button>
      </div>
      {loading && <LoadingState label="Loading resources…" />}
      {error && !resources && <ErrorState error={error} onRetry={reload} />}
      {resources && resources.length === 0 && (
        <EmptyState title="No resources yet" description="Links (PDFs, videos, slides, documents or web pages) for this course. Files are not uploaded." />
      )}
      {resources && resources.length > 0 && (
        <ul className="content-list">
          {resources.map((resource) => (
            <li key={resource.id} className="content-item">
              <div className="content-item__main">
                <div className="cell-primary">
                  {resource.title} <span className="badge badge--primary">{RESOURCE_TYPE_LABELS[resource.resourceType]}</span>
                </div>
                <div className="cell-secondary">{where(resource)}</div>
                {resource.description && <div className="cell-secondary content-item__text">{resource.description}</div>}
                <a className="external-link cell-secondary cell-break" href={resource.url} target="_blank" rel="noopener noreferrer">
                  {resource.url} <Icon name="external" />
                </a>
              </div>
              <div className="row-actions">
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => setForm({ resource })}>
                  Edit<span className="visually-hidden"> {resource.title}</span>
                </button>
                <button
                  type="button"
                  className="btn btn--danger-ghost btn--sm"
                  onClick={() => {
                    setDeleteError(null)
                    setDeleting(resource)
                  }}
                >
                  Delete<span className="visually-hidden"> {resource.title}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <ResourceFormModal
          courseId={course.id}
          modules={course.modules}
          resource={form.resource}
          onClose={() => setForm(null)}
          onSaved={(saved, isEdit) => {
            setForm(null)
            toast.success(isEdit ? 'Resource saved.' : 'Resource added.')
            reload()
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete resource?"
          confirmLabel="Delete resource"
          tone="danger"
          busy={deleteBusy}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        >
          <p>
            <strong>{deleting.title}</strong> will be removed for students and trainers of this course.
          </p>
        </ConfirmDialog>
      )}
    </section>
  )
}

// FAQs and learning resources of the course shown on the Admin course page.
export function CourseContent({ course }) {
  return (
    <div className="course-content">
      <Alert tone="info">
        Learning resources and FAQs for <strong>{course.title}</strong>. Deleting a module or topic also deletes the resources attached to it.
      </Alert>
      <AssignmentsCard course={course} />
      <FaqsCard course={course} />
      <ResourcesCard course={course} />
    </div>
  )
}
