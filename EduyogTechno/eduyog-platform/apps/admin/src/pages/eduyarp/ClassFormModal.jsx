import { useState } from 'react'
import { eduyarpApi } from '../../api/endpoints'
import { SelectField, TextField } from '../../components/Fields'
import { Modal } from '../../components/Modal'
import { Alert, Spinner } from '../../components/States'
import { splitApiError } from '../../utils/errors'
import { CLASS_STATUS_LABELS, CLASS_STATUSES } from '../../utils/labels'

const FIELDS = ['courseId', 'trainerId', 'title', 'scheduledAt', 'meetingLink', 'status']

// ISO instant -> "YYYY-MM-DDTHH:mm" in the browser's time zone, for
// <input type="datetime-local">.
function toLocalInput(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// cls: an existing class to edit, or null to create one.
// courses: Admin course list (each with its assigned trainers).
export function ClassFormModal({ cls, courses, onClose, onSaved }) {
  const isEdit = Boolean(cls)
  const [form, setForm] = useState({
    courseId: cls?.courseId ?? '',
    trainerId: cls?.trainerId ?? '',
    title: cls?.title ?? '',
    scheduledAt: toLocalInput(cls?.scheduledAt),
    meetingLink: cls?.meetingLink ?? '',
    status: cls?.status ?? 'scheduled',
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  const course = courses.find((c) => c.id === form.courseId)
  // Only trainers assigned to the course can take its classes. Keep the
  // current trainer selectable while editing even if later unassigned.
  const trainerOptions = course ? [...course.trainers] : []
  if (isEdit && form.trainerId === cls.trainerId && !trainerOptions.some((t) => t.id === cls.trainerId)) {
    trainerOptions.push({ id: cls.trainerId, fullName: `${cls.trainerName} (no longer assigned)` })
  }

  // courses can be refreshed while the form is open; never keep (or submit) a
  // trainer that is not in the current list for the selected course.
  const trainerId = trainerOptions.some((t) => t.id === form.trainerId) ? form.trainerId : ''

  const update = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      // A new course needs a trainer assigned to that course.
      if (field === 'courseId') next.trainerId = ''
      return next
    })
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError(null)
    setFieldErrors({})
    if (!form.scheduledAt) {
      setFieldErrors({ scheduledAt: 'Date and time are required' })
      return
    }
    setBusy(true)
    const payload = { ...form, trainerId, scheduledAt: new Date(form.scheduledAt).toISOString() }
    // Unchanged course/trainer are not re-sent, so editing other fields of a
    // class whose trainer was later unassigned still works.
    if (isEdit) {
      if (payload.courseId === cls.courseId) delete payload.courseId
      if (payload.trainerId === cls.trainerId && payload.courseId === undefined) delete payload.trainerId
    }
    try {
      const saved = isEdit
        ? await eduyarpApi.classes.update(cls.id, payload)
        : await eduyarpApi.classes.create(payload)
      onSaved(saved, isEdit)
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
      title={isEdit ? `Edit ${cls.title}` : 'Schedule class'}
      onClose={close}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="class-form" className="btn btn--primary" disabled={busy}>
            {busy && <Spinner size="sm" />}
            {isEdit ? 'Save changes' : 'Schedule class'}
          </button>
        </>
      }
    >
      {formError && <Alert>{formError}</Alert>}
      <form id="class-form" className="form" onSubmit={handleSubmit}>
        <SelectField
          label="Course"
          value={form.courseId}
          onChange={(e) => update('courseId', e.target.value)}
          error={fieldErrors.courseId}
          required
        >
          <option value="">Select a course…</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Trainer"
          value={trainerId}
          onChange={(e) => update('trainerId', e.target.value)}
          error={fieldErrors.trainerId}
          hint={
            course && course.trainers.length === 0
              ? 'This course has no assigned trainers. Assign one on the course page first.'
              : 'Only trainers assigned to the course are listed.'
          }
          disabled={!course}
          required
        >
          <option value="">{course ? 'Select a trainer…' : 'Choose a course first'}</option>
          {trainerOptions.map((trainer) => (
            <option key={trainer.id} value={trainer.id}>
              {trainer.fullName}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Class title"
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          error={fieldErrors.title}
          maxLength={200}
          required
        />
        <div className="form__row">
          <TextField
            label="Date and time"
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) => update('scheduledAt', e.target.value)}
            error={fieldErrors.scheduledAt}
            hint="In your local time zone."
            required
          />
          <SelectField
            label="Status"
            value={form.status}
            onChange={(e) => update('status', e.target.value)}
            error={fieldErrors.status}
          >
            {CLASS_STATUSES.map((status) => (
              <option key={status} value={status}>
                {CLASS_STATUS_LABELS[status]}
              </option>
            ))}
          </SelectField>
        </div>
        <TextField
          label="Meeting link"
          type="url"
          value={form.meetingLink}
          onChange={(e) => update('meetingLink', e.target.value)}
          error={fieldErrors.meetingLink}
          hint="Optional. Any http(s) meeting URL, e.g. a Zoom or Google Meet link."
          maxLength={2048}
          placeholder="https://"
        />
      </form>
    </Modal>
  )
}
