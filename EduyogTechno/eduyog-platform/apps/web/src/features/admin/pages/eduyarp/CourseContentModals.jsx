import { useState } from 'react'
import { eduyarpApi } from '../../api/endpoints'
import { SelectField, TextAreaField, TextField } from '../../components/Fields'
import { Modal } from '../../components/Modal'
import { Alert, Spinner } from '../../components/States'
import { splitApiError } from '../../utils/errors'
import { checkImageUrl } from '../../utils/imageUrl'
import { RESOURCE_TYPES } from '../../utils/labels'

const FAQ_FIELDS = ['question', 'answer', 'displayOrder']
const RESOURCE_FIELDS = ['title', 'resourceType', 'url', 'description', 'moduleId', 'topicId', 'displayOrder']

// Add or edit one FAQ of a course. faq: the FAQ to edit, or null to add.
export function FaqFormModal({ courseId, faq, onClose, onSaved }) {
  const [form, setForm] = useState({ question: faq?.question ?? '', answer: faq?.answer ?? '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    setFormError(null)
    const problems = {}
    if (form.question.trim() === '') problems.question = 'Question is required'
    if (form.answer.trim() === '') problems.answer = 'Answer is required'
    setErrors(problems)
    if (Object.keys(problems).length > 0) return
    setBusy(true)
    try {
      const saved = faq ? await eduyarpApi.faqs.update(faq.id, form) : await eduyarpApi.faqs.create(courseId, form)
      onSaved(saved, Boolean(faq))
    } catch (err) {
      const split = splitApiError(err, FAQ_FIELDS)
      setErrors(split.fieldErrors)
      setFormError(split.formError)
      setBusy(false)
    }
  }

  const close = () => {
    if (!busy) onClose()
  }

  return (
    <Modal
      title={faq ? 'Edit FAQ' : 'Add FAQ'}
      onClose={close}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="faq-form" className="btn btn--primary" disabled={busy}>
            {busy && <Spinner size="sm" />}
            {faq ? 'Save changes' : 'Add FAQ'}
          </button>
        </>
      }
    >
      {formError && <Alert>{formError}</Alert>}
      <form id="faq-form" className="form" onSubmit={submit} noValidate>
        <TextField label="Question" value={form.question} onChange={update('question')} error={errors.question} maxLength={500} autoComplete="off" required />
        <TextAreaField
          label="Answer"
          value={form.answer}
          onChange={update('answer')}
          error={errors.answer}
          maxLength={3000}
          rows={6}
          hint={`Plain text. ${form.answer.length}/3000 characters.`}
          required
        />
      </form>
    </Modal>
  )
}

// "course" | "m:<moduleId>" | "t:<topicId>"
const targetOf = (resource) => (resource?.topicId ? `t:${resource.topicId}` : resource?.moduleId ? `m:${resource.moduleId}` : 'course')

// Add or edit one learning resource. modules: the course outline (modules with topics).
export function ResourceFormModal({ courseId, modules, resource, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: resource?.title ?? '',
    resourceType: resource?.resourceType ?? 'document',
    url: resource?.url ?? '',
    description: resource?.description ?? '',
    target: targetOf(resource),
    displayOrder: resource ? String(resource.displayOrder) : '',
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
    if (form.url.trim() === '') problems.url = 'Address is required'
    else if (checkImageUrl(form.url)) problems.url = 'Enter a valid http:// or https:// address (no username or password).'
    setErrors(problems)
    if (Object.keys(problems).length > 0) return
    setBusy(true)
    const [kind, id] = form.target.split(':')
    const payload = {
      title: form.title,
      resourceType: form.resourceType,
      url: form.url,
      description: form.description,
      moduleId: kind === 'm' ? id : null,
      topicId: kind === 't' ? id : null,
    }
    if (form.displayOrder.trim() !== '') payload.displayOrder = Number(form.displayOrder)
    try {
      const saved = resource
        ? await eduyarpApi.resources.update(resource.id, payload)
        : await eduyarpApi.resources.create(courseId, payload)
      onSaved(saved, Boolean(resource))
    } catch (err) {
      const split = splitApiError(err, RESOURCE_FIELDS)
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
      title={resource ? 'Edit resource' : 'Add resource'}
      onClose={close}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="resource-form" className="btn btn--primary" disabled={busy}>
            {busy && <Spinner size="sm" />}
            {resource ? 'Save changes' : 'Add resource'}
          </button>
        </>
      }
    >
      {formError && <Alert>{formError}</Alert>}
      <form id="resource-form" className="form" onSubmit={submit} noValidate>
        <TextField label="Title" value={form.title} onChange={update('title')} error={errors.title} maxLength={200} autoComplete="off" required />
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
          hint="A link starting with http:// or https://. Files are not uploaded."
          maxLength={2048}
          autoComplete="off"
          required
        />
        <TextAreaField label="Description (optional)" value={form.description} onChange={update('description')} error={errors.description} maxLength={1000} rows={3} />
        <TextField
          label="Order (optional)"
          type="number"
          min="0"
          value={form.displayOrder}
          onChange={update('displayOrder')}
          error={errors.displayOrder}
          hint="Lower numbers come first within the same module or topic. Leave blank to add at the end."
        />
      </form>
    </Modal>
  )
}
