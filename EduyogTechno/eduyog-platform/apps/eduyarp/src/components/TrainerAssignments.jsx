import { useCallback, useState } from 'react'
import { trainerApi } from '../api/endpoints'
import { useResource } from '../hooks/useResource'
import { Link } from '../router/Link'
import { fromLocalInput, toLocalInput } from '../utils/assignments'
import { splitApiError } from '../utils/errors'
import { formatDateTime } from '../utils/format'
import { AssignmentStatusBadge } from './Badges'
import { SelectField, TextAreaField, TextField } from './Fields'
import { Icon } from './Icon'
import { Alert, ErrorState, LoadingState, Spinner } from './States'

const FIELDS = ['title', 'instructions', 'dueAt', 'status', 'moduleId', 'topicId']
const EMPTY = { title: '', instructions: '', due: '', status: 'draft', target: 'course' }

// "course" | "m:<moduleId>" | "t:<topicId>"
const targetOf = (a) => (a.topicId ? `t:${a.topicId}` : a.moduleId ? `m:${a.moduleId}` : 'course')

function AssignmentForm({ courseId, modules, editing, onDone, onCancel }) {
  const [form, setForm] = useState(
    editing
      ? { title: editing.title, instructions: editing.instructions, due: toLocalInput(editing.dueAt), status: editing.status, target: targetOf(editing) }
      : EMPTY,
  )
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined, ...(field === 'target' ? { target: undefined } : {}) }))
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
      dueAt: fromLocalInput(form.due),
      status: form.status,
      moduleId: kind === 'm' ? id : null,
      topicId: kind === 't' ? id : null,
    }
    try {
      const saved = editing
        ? await trainerApi.updateAssignment(editing.id, payload)
        : await trainerApi.createAssignment(courseId, payload)
      onDone(saved, Boolean(editing))
    } catch (err) {
      const split = splitApiError(err, FIELDS)
      const target = split.fieldErrors.topicId || split.fieldErrors.moduleId
      setErrors({ ...split.fieldErrors, ...(target ? { target } : {}) })
      setFormError(split.formError)
      setBusy(false)
    }
  }

  return (
    <form className="res-form" onSubmit={submit} noValidate aria-label={editing ? 'Edit assignment' : 'New assignment'}>
      <h3 className="res-form__title">{editing ? `Edit “${editing.title}”` : 'New assignment'}</h3>
      {formError && <Alert>{formError}</Alert>}
      <TextField label="Title" value={form.title} onChange={update('title')} error={errors.title} maxLength={200} autoComplete="off" />
      <TextAreaField label="Instructions" value={form.instructions} onChange={update('instructions')} error={errors.instructions} maxLength={5000} rows={5} hint={`Plain text. ${form.instructions.length}/5000 characters.`} />
      <div className="form__row">
        <TextField
          label="Due date (optional)"
          type="datetime-local"
          value={form.due}
          onChange={update('due')}
          error={errors.dueAt}
          hint="Late submissions are still accepted and are marked late."
        />
        <SelectField label="Status" value={form.status} onChange={update('status')} error={errors.status}>
          <option value="draft">Draft (students cannot see it)</option>
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
      <div className="form__actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy && <Spinner size="sm" />}
          {editing ? 'Save changes' : 'Create assignment'}
        </button>
        <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  )
}

// Assignments of one assigned course: create, edit, publish / close / back to draft, delete.
export function TrainerAssignments({ courseId, courseTitle, modules }) {
  const loader = useCallback(() => trainerApi.assignments(courseId), [courseId])
  const { data, error, loading, reload } = useResource(loader)
  const [form, setForm] = useState(null) // { assignment } ; assignment null = new
  const [notice, setNotice] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const done = (saved, wasEdit) => {
    setForm(null)
    setNotice(wasEdit ? `Saved “${saved.title}”.` : `Created “${saved.title}”.`)
    reload()
  }

  const setStatus = async (assignment, status) => {
    if (busyId) return
    setBusyId(assignment.id)
    setActionError(null)
    setNotice(null)
    try {
      await trainerApi.updateAssignment(assignment.id, { status })
      setNotice(`“${assignment.title}” is now ${status === 'published' ? 'open' : status}.`)
      reload()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (assignment) => {
    if (busyId) return
    if (!window.confirm(`Delete “${assignment.title}”? All its submissions and feedback are deleted too.`)) return
    setBusyId(assignment.id)
    setActionError(null)
    setNotice(null)
    try {
      await trainerApi.deleteAssignment(assignment.id)
      setNotice(`Deleted “${assignment.title}”.`)
      reload()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="card t-grid__wide" aria-labelledby="t-asg-title">
      <div className="res-head">
        <h2 id="t-asg-title" className="card__title">
          <Icon name="edit" /> Assignments
        </h2>
        {!form && (
          <button type="button" className="btn btn--primary btn--sm" onClick={() => { setNotice(null); setForm({ assignment: null }) }}>
            <Icon name="check" size={16} /> New assignment
          </button>
        )}
      </div>
      <p className="muted small profile-note">Students of {courseTitle} see open and closed assignments. Submissions are text and/or a link; there are no grades, only written feedback.</p>
      {notice && <Alert tone="success">{notice}</Alert>}
      {actionError && <Alert>{actionError}</Alert>}
      {form && (
        <AssignmentForm key={form.assignment?.id ?? 'new'} courseId={courseId} modules={modules} editing={form.assignment} onDone={done} onCancel={() => setForm(null)} />
      )}

      {loading && <LoadingState label="Loading assignments…" />}
      {error && !data && <ErrorState error={error} onRetry={reload} />}
      {data && data.length === 0 && <p className="muted">No assignments for this course yet.</p>}
      {data && data.length > 0 && (
        <ul className="asg-list">
          {data.map((a) => (
            <li key={a.id} className="asg">
              <div className="asg__main">
                <div className="asg__top">
                  <Link to={`/trainer/courses/${courseId}/assignments/${a.id}`} className="asg__title">
                    {a.title}
                  </Link>
                  <AssignmentStatusBadge status={a.status} />
                </div>
                <p className="asg__meta">
                  {a.dueAt ? `Due ${formatDateTime(a.dueAt)}` : 'No due date'}
                  {a.topicTitle ? ` · Topic: ${a.topicTitle}` : a.moduleTitle ? ` · ${a.moduleTitle}` : ''}
                  {` · ${a.studentCount} ${a.studentCount === 1 ? 'student has' : 'students have'} submitted`}
                </p>
              </div>
              <div className="asg__actions">
                <Link to={`/trainer/courses/${courseId}/assignments/${a.id}`} className="btn btn--secondary btn--sm">
                  Submissions<span className="visually-hidden"> for {a.title}</span>
                </Link>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setNotice(null); setForm({ assignment: a }) }}>
                  <Icon name="edit" size={14} /> Edit<span className="visually-hidden"> {a.title}</span>
                </button>
                {a.status !== 'published' && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStatus(a, 'published')} disabled={busyId === a.id}>
                    {a.status === 'closed' ? 'Reopen' : 'Publish'}<span className="visually-hidden"> {a.title}</span>
                  </button>
                )}
                {a.status === 'published' && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStatus(a, 'closed')} disabled={busyId === a.id}>
                    Close<span className="visually-hidden"> {a.title}</span>
                  </button>
                )}
                {a.status !== 'draft' && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStatus(a, 'draft')} disabled={busyId === a.id}>
                    Back to draft<span className="visually-hidden"> {a.title}</span>
                  </button>
                )}
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => remove(a)} disabled={busyId === a.id}>
                  <Icon name="trash" size={14} /> Delete<span className="visually-hidden"> {a.title}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
