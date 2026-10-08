import { useCallback, useState } from 'react'
import { trainerApi } from '../api/endpoints'
import { useResource } from '../hooks/useResource'
import { splitApiError } from '../utils/errors'
import { RESOURCE_TYPES, checkResourceUrl } from '../utils/resources'
import { SelectField, TextAreaField, TextField } from './Fields'
import { Icon } from './Icon'
import { FaqList, ResourceList } from './ResourceList'
import { Alert, ErrorState, LoadingState, Spinner } from './States'

const FIELDS = ['title', 'resourceType', 'url', 'description', 'moduleId', 'topicId']
const EMPTY = { title: '', resourceType: 'document', url: '', description: '', target: 'course' }

// "course" | "m:<moduleId>" | "t:<topicId>"
const targetOf = (resource) => (resource.topicId ? `t:${resource.topicId}` : resource.moduleId ? `m:${resource.moduleId}` : 'course')

function toPayload(form) {
  const [kind, id] = form.target.split(':')
  return {
    title: form.title,
    resourceType: form.resourceType,
    url: form.url,
    description: form.description,
    moduleId: kind === 'm' ? id : null,
    topicId: kind === 't' ? id : null,
  }
}

function ResourceForm({ courseId, modules, editing, onDone, onCancel }) {
  const [form, setForm] = useState(editing ? { title: editing.title, resourceType: editing.resourceType, url: editing.url, description: editing.description ?? '', target: targetOf(editing) } : EMPTY)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined, ...(field === 'target' ? { moduleId: undefined, topicId: undefined } : {}) }))
  }

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    setFormError(null)
    const problems = {}
    if (form.title.trim() === '') problems.title = 'Title is required'
    const urlProblem = checkResourceUrl(form.url)
    if (urlProblem) problems.url = urlProblem
    setErrors(problems)
    if (Object.keys(problems).length > 0) return
    setBusy(true)
    try {
      const payload = toPayload(form)
      const saved = editing
        ? await trainerApi.updateResource(editing.id, payload)
        : await trainerApi.createResource(courseId, payload)
      onDone(saved, Boolean(editing))
    } catch (err) {
      const split = splitApiError(err, FIELDS)
      setErrors({ ...split.fieldErrors, ...(split.fieldErrors.moduleId || split.fieldErrors.topicId ? { target: split.fieldErrors.topicId || split.fieldErrors.moduleId } : {}) })
      setFormError(split.formError)
      setBusy(false)
    }
  }

  return (
    <form className="res-form" onSubmit={submit} noValidate aria-label={editing ? 'Edit resource' : 'Add resource'}>
      <h3 className="res-form__title">{editing ? `Edit “${editing.title}”` : 'Add a resource'}</h3>
      {formError && <Alert>{formError}</Alert>}
      <TextField label="Title" value={form.title} onChange={update('title')} error={errors.title} maxLength={200} autoComplete="off" />
      <div className="form__row">
        <SelectField label="Type" value={form.resourceType} onChange={update('resourceType')} error={errors.resourceType}>
          {RESOURCE_TYPES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
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
      </div>
      <TextField
        label="Address (URL)"
        type="url"
        value={form.url}
        onChange={update('url')}
        error={errors.url}
        hint="A link starting with http:// or https://. Files are not uploaded here."
        maxLength={2048}
        autoComplete="off"
      />
      <TextAreaField label="Description (optional)" value={form.description} onChange={update('description')} error={errors.description} maxLength={1000} rows={2} />
      <div className="form__actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy && <Spinner size="sm" />}
          {editing ? 'Save changes' : 'Add resource'}
        </button>
        <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  )
}

// Resources for one assigned course (add, edit, delete) and the course FAQs (read only).
export function TrainerResources({ courseId, courseTitle, modules }) {
  const resourcesLoader = useCallback(() => trainerApi.resources(courseId), [courseId])
  const faqsLoader = useCallback(() => trainerApi.faqs(courseId), [courseId])
  const resources = useResource(resourcesLoader)
  const faqs = useResource(faqsLoader)
  // null = closed, { resource: null } = add, { resource } = edit
  const [form, setForm] = useState(null)
  const [notice, setNotice] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const done = (saved, wasEdit) => {
    setForm(null)
    setNotice(wasEdit ? `Saved “${saved.title}”.` : `Added “${saved.title}”.`)
    resources.reload()
  }

  const remove = async (resource) => {
    if (deleting) return
    if (!window.confirm(`Delete “${resource.title}”? Students will no longer see it.`)) return
    setDeleting(resource.id)
    setActionError(null)
    setNotice(null)
    try {
      await trainerApi.deleteResource(resource.id)
      setNotice(`Deleted “${resource.title}”.`)
      resources.reload()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      <section className="card t-grid__wide" aria-labelledby="t-res-title">
        <div className="res-head">
          <h2 id="t-res-title" className="card__title">
            <Icon name="file" /> Learning resources
          </h2>
          {!form && (
            <button type="button" className="btn btn--primary btn--sm" onClick={() => { setNotice(null); setForm({ resource: null }) }}>
              <Icon name="check" size={16} /> Add resource
            </button>
          )}
        </div>
        <p className="muted small profile-note">Links shown to students of {courseTitle}. You can manage resources for this course only.</p>

        {notice && <Alert tone="success">{notice}</Alert>}
        {actionError && <Alert>{actionError}</Alert>}
        {form && (
          <ResourceForm
            key={form.resource?.id ?? 'new'}
            courseId={courseId}
            modules={modules}
            editing={form.resource}
            onDone={done}
            onCancel={() => setForm(null)}
          />
        )}

        {resources.loading && <LoadingState label="Loading resources…" />}
        {resources.error && !resources.data && <ErrorState error={resources.error} onRetry={resources.reload} />}
        {resources.data && resources.data.length === 0 && <p className="muted">No resources for this course yet.</p>}
        {resources.data && resources.data.length > 0 && (
          <ResourceList
            resources={resources.data}
            renderActions={(resource) => (
              <>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setNotice(null); setForm({ resource }) }}>
                  <Icon name="edit" size={14} /> Edit<span className="visually-hidden"> {resource.title}</span>
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => remove(resource)} disabled={deleting === resource.id}>
                  {deleting === resource.id ? <Spinner size="sm" /> : <Icon name="trash" size={14} />} Delete
                  <span className="visually-hidden"> {resource.title}</span>
                </button>
              </>
            )}
          />
        )}
      </section>

      <section className="card t-grid__wide" aria-labelledby="t-faq-title">
        <h2 id="t-faq-title" className="card__title">
          <Icon name="help" /> Frequently asked questions
        </h2>
        <p className="muted small profile-note">Read only. An Admin manages the FAQs.</p>
        {faqs.loading && <LoadingState label="Loading questions…" />}
        {faqs.error && !faqs.data && <ErrorState error={faqs.error} onRetry={faqs.reload} />}
        {faqs.data && faqs.data.length === 0 && <p className="muted">No questions have been added to this course yet.</p>}
        {faqs.data && faqs.data.length > 0 && <FaqList faqs={faqs.data} />}
      </section>
    </>
  )
}
