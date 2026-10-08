import { useState } from 'react'
import { eduyarpApi } from '../../api/endpoints'
import { SelectField, TextAreaField, TextField } from '../../components/Fields'
import { Modal } from '../../components/Modal'
import { Alert, Spinner } from '../../components/States'
import { splitApiError } from '../../utils/errors'

const FIELDS = ['courseId', 'title', 'body']
const TITLE_MAX = 200
const BODY_MAX = 3000

// Creates an announcement: for one course, or platform-wide (no course selected).
export function AnnouncementFormModal({ courses, onClose, onSaved }) {
  const [form, setForm] = useState({ courseId: '', title: '', body: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (busy) return
    setFormError(null)
    const problems = {}
    if (form.title.trim() === '') problems.title = 'Title is required'
    if (form.body.trim() === '') problems.body = 'Message is required'
    setFieldErrors(problems)
    if (Object.keys(problems).length > 0) return
    setBusy(true)
    try {
      onSaved(await eduyarpApi.announcements.create(form))
    } catch (error) {
      const split = splitApiError(error, FIELDS)
      setFieldErrors(split.fieldErrors)
      setFormError(split.formError)
      setBusy(false)
    }
  }

  const close = () => {
    if (!busy) onClose()
  }

  return (
    <Modal
      title="New announcement"
      onClose={close}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="announcement-form" className="btn btn--primary" disabled={busy}>
            {busy && <Spinner size="sm" />}
            Post announcement
          </button>
        </>
      }
    >
      {formError && <Alert>{formError}</Alert>}
      <form id="announcement-form" className="form" onSubmit={handleSubmit} noValidate>
        <SelectField
          label="Audience"
          value={form.courseId}
          onChange={update('courseId')}
          error={fieldErrors.courseId}
          hint={
            form.courseId
              ? "Students currently in this course (active or completed) and the course's trainers are notified."
              : 'Every student who currently has an active or completed enrolment is notified once.'
          }
        >
          <option value="">All courses (platform-wide)</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Title"
          value={form.title}
          onChange={update('title')}
          error={fieldErrors.title}
          maxLength={TITLE_MAX}
          autoComplete="off"
          required
        />
        <TextAreaField
          label="Message"
          value={form.body}
          onChange={update('body')}
          error={fieldErrors.body}
          maxLength={BODY_MAX}
          rows={6}
          hint={`Plain text. ${form.body.length}/${BODY_MAX} characters.`}
          required
        />
      </form>
    </Modal>
  )
}
