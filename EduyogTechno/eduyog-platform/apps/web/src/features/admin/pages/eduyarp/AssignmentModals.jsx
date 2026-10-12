import { useCallback, useState } from 'react'
import { eduyarpApi } from '../../api/endpoints'
import { SelectField, TextAreaField, TextField } from '../../components/Fields'
import { Modal } from '../../components/Modal'
import { Alert, EmptyState, ErrorState, LoadingState, Spinner } from '../../components/States'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { useResource } from '../../hooks/useResource'
import { splitApiError } from '../../utils/errors'
import { formatDateTime } from '../../utils/format'

const FIELDS = ['title', 'instructions', 'dueAt', 'status', 'moduleId', 'topicId', 'displayOrder']

// ISO instant -> "YYYY-MM-DDTHH:mm" in the browser's time zone, for <input type="datetime-local">.
function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// "course" | "m:<moduleId>" | "t:<topicId>"
const targetOf = (a) => (a?.topicId ? `t:${a.topicId}` : a?.moduleId ? `m:${a.moduleId}` : 'course')

// Add or edit an assignment. assignment: the one to edit, or null to add. modules: the course outline.
export function AssignmentFormModal({ courseId, modules, assignment, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: assignment?.title ?? '',
    instructions: assignment?.instructions ?? '',
    due: toLocalInput(assignment?.dueAt),
    status: assignment?.status ?? 'draft',
    target: targetOf(assignment),
  })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined, target: field === 'target' ? undefined : prev.target }))
  }

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    setFormError(null)
    const problems = {}
    if (form.title.trim() === '') problems.title = 'Title is required'
    if (form.instructions.trim() === '') problems.instructions = 'Instructions are required'
    setErrors(problems)
    if (Object.keys(problems).length > 0) return
    setBusy(true)
    const [kind, id] = form.target.split(':')
    const payload = {
      title: form.title,
      instructions: form.instructions,
      dueAt: form.due ? new Date(form.due).toISOString() : null,
      status: form.status,
      moduleId: kind === 'm' ? id : null,
      topicId: kind === 't' ? id : null,
    }
    try {
      const saved = assignment
        ? await eduyarpApi.assignments.update(assignment.id, payload)
        : await eduyarpApi.assignments.create(courseId, payload)
      onSaved(saved, Boolean(assignment))
    } catch (err) {
      const split = splitApiError(err, FIELDS)
      const target = split.fieldErrors.topicId || split.fieldErrors.moduleId
      setErrors({ ...split.fieldErrors, ...(target ? { target } : {}) })
      setFormError(split.formError)
      setBusy(false)
    }
  }

  const close = () => {
    if (!busy) onClose()
  }

  return (
    <Modal
      title={assignment ? 'Edit assignment' : 'Add assignment'}
      onClose={close}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="assignment-form" className="btn btn--primary" disabled={busy}>
            {busy && <Spinner size="sm" />}
            {assignment ? 'Save changes' : 'Add assignment'}
          </button>
        </>
      }
    >
      {formError && <Alert>{formError}</Alert>}
      <form id="assignment-form" className="form" onSubmit={submit} noValidate>
        <TextField label="Title" value={form.title} onChange={update('title')} error={errors.title} maxLength={200} autoComplete="off" required />
        <TextAreaField label="Instructions" value={form.instructions} onChange={update('instructions')} error={errors.instructions} maxLength={5000} rows={6} hint={`Plain text. ${form.instructions.length}/5000 characters.`} required />
        <div className="form__row">
          <TextField label="Due date (optional)" type="datetime-local" value={form.due} onChange={update('due')} error={errors.dueAt} hint="Late submissions are accepted and marked late." />
          <SelectField label="Status" value={form.status} onChange={update('status')} error={errors.status}>
            <option value="draft">Draft (hidden from students)</option>
            <option value="published">Open (students can submit)</option>
            <option value="closed">Closed (no new submissions)</option>
          </SelectField>
        </div>
        <SelectField label="Attached to" value={form.target} onChange={update('target')} error={errors.target}>
          <option value="course">Whole course</option>
          {modules.map((module) => (
            <optgroup key={module.id} label={module.title}>
              <option value={`m:${module.id}`}>Module: {module.title}</option>
              {module.topics.map((topic) => (
                <option key={topic.id} value={`t:${topic.id}`}>
                  Topic: {topic.title}
                </option>
              ))}
            </optgroup>
          ))}
        </SelectField>
      </form>
    </Modal>
  )
}

function SubmissionDetail({ submissionId }) {
  const loader = useCallback(() => eduyarpApi.assignments.submission(submissionId), [submissionId])
  const { data, error, loading, reload } = useResource(loader)
  if (loading) return <LoadingState label="Loading submission…" />
  if (error && !data) return <ErrorState error={error} onRetry={reload} />
  return (
    <div className="submission-detail">
      <div className="cell-primary">
        {data.student.name} <span className="cell-secondary cell-break">{data.student.email}</span>
      </div>
      <ul className="content-list">
        {data.history.map((s, index) => (
          <li key={s.id} className="content-item content-item--stack">
            <div className="cell-primary">
              {index === 0 ? 'Latest submission' : 'Earlier submission'} · {formatDateTime(s.submittedAt)}{' '}
              {s.isLate && <span className="badge badge--danger">Late</span>}
            </div>
            {s.text && <div className="content-item__text">{s.text}</div>}
            {s.url && (
              <a className="external-link cell-break" href={s.url} target="_blank" rel="noopener noreferrer">
                {s.url}
              </a>
            )}
            {s.feedback ? (
              <div className="alert alert--info">
                <strong>Feedback from {s.feedback.authorName}:</strong> <span className="content-item__text">{s.feedback.text}</span>
              </div>
            ) : (
              <div className="cell-secondary">No feedback yet.</div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Read-only view of an assignment's submissions and the feedback trainers wrote.
export function SubmissionsModal({ assignment, onClose }) {
  const loader = useCallback(() => eduyarpApi.assignments.submissions(assignment.id), [assignment.id])
  const { data, error, loading, reload } = useResource(loader)
  useAutoRefresh(reload, { enabled: Boolean(data) })
  const [openId, setOpenId] = useState(null)

  return (
    <Modal
      title={`Submissions: ${assignment.title}`}
      size="lg"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn--secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      {loading && <LoadingState label="Loading submissions…" />}
      {error && !data && <ErrorState error={error} onRetry={reload} />}
      {data && data.submissions.length === 0 && <EmptyState title="No submissions yet" description="Each student's latest submission is listed here." />}
      {data && data.submissions.length > 0 && (
        <ul className="content-list">
          {data.submissions.map((s) => (
            <li key={s.id} className="content-item content-item--stack">
              <div className="content-item__row">
                <div className="content-item__main">
                  <div className="cell-primary">
                    {s.studentName} {s.isLate && <span className="badge badge--danger">Late</span>}{' '}
                    <span className={`badge ${s.hasFeedback ? 'badge--success' : 'badge--muted'}`}>{s.hasFeedback ? 'Feedback given' : 'No feedback'}</span>
                  </div>
                  <div className="cell-secondary cell-break">
                    {s.studentEmail} · {formatDateTime(s.submittedAt)}
                    {s.attempts > 1 ? ` · ${s.attempts} submissions` : ''}
                  </div>
                </div>
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => setOpenId(openId === s.id ? null : s.id)} aria-expanded={openId === s.id}>
                  {openId === s.id ? 'Hide' : 'View'}
                  <span className="visually-hidden"> submission by {s.studentName}</span>
                </button>
              </div>
              {openId === s.id && <SubmissionDetail submissionId={s.id} />}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
