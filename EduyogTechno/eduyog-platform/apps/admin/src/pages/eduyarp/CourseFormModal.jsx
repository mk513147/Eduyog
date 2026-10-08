import { useState } from 'react'
import { eduyarpApi } from '../../api/endpoints'
import { SelectField, TextAreaField, TextField } from '../../components/Fields'
import { ImageUrlField } from '../../components/ImageUrlField'
import { Modal } from '../../components/Modal'
import { Alert, Spinner } from '../../components/States'
import { splitApiError } from '../../utils/errors'
import { slugify } from '../../utils/format'
import { checkImageUrl } from '../../utils/imageUrl'
import { COURSE_LEVELS, COURSE_STATUS_LABELS, LEVEL_LABELS } from '../../utils/labels'

const FIELDS = [
  'title',
  'slug',
  'description',
  'learningObjectives',
  'duration',
  'level',
  'fee',
  'status',
  'coverImageUrl',
  'iconUrl',
]

// course: an existing course to edit, or null to create one.
export function CourseFormModal({ course, onClose, onSaved }) {
  const isEdit = Boolean(course)
  const [form, setForm] = useState({
    title: course?.title ?? '',
    slug: course?.slug ?? '',
    description: course?.description ?? '',
    learningObjectives: course?.learningObjectives ?? '',
    duration: course?.duration ?? '',
    level: course?.level ?? 'beginner',
    fee: course ? String(course.fee) : '0',
    status: course?.status ?? 'draft',
    coverImageUrl: course?.coverImageUrl ?? '',
    iconUrl: course?.iconUrl ?? '',
  })
  // While creating, the slug follows the title until it is edited by hand.
  const [slugTouched, setSlugTouched] = useState(isEdit)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  const update = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'title' && !slugTouched) next.slug = slugify(value)
      return next
    })
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const mediaErrors = {}
    for (const field of ['coverImageUrl', 'iconUrl']) {
      const problem = checkImageUrl(form[field])
      if (problem) mediaErrors[field] = problem
    }
    if (Object.keys(mediaErrors).length > 0) {
      setFieldErrors(mediaErrors)
      return
    }
    setBusy(true)
    setFormError(null)
    setFieldErrors({})
    try {
      const saved = isEdit
        ? await eduyarpApi.courses.update(course.id, form)
        : await eduyarpApi.courses.create(form)
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
      title={isEdit ? `Edit ${course.title}` : 'Add course'}
      onClose={close}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="course-form" className="btn btn--primary" disabled={busy}>
            {busy && <Spinner size="sm" />}
            {isEdit ? 'Save changes' : 'Add course'}
          </button>
        </>
      }
    >
      {formError && <Alert>{formError}</Alert>}
      <form id="course-form" className="form" onSubmit={handleSubmit}>
        <TextField
          label="Title"
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          error={fieldErrors.title}
          maxLength={200}
          required
          autoFocus
        />
        <TextField
          label="Slug"
          value={form.slug}
          onChange={(e) => {
            setSlugTouched(true)
            update('slug', e.target.value)
          }}
          error={fieldErrors.slug}
          hint="Used in the course URL: /courses/your-slug. Lowercase letters, numbers and hyphens."
          maxLength={100}
          required
        />
        <TextAreaField
          label="Description"
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          error={fieldErrors.description}
          hint="Shown in the catalogue and on the course page."
          maxLength={5000}
          rows={3}
        />
        <TextAreaField
          label="Learning objectives"
          value={form.learningObjectives}
          onChange={(e) => update('learningObjectives', e.target.value)}
          error={fieldErrors.learningObjectives}
          hint="One objective per line."
          maxLength={5000}
          rows={4}
        />
        <div className="form__row">
          <TextField
            label="Duration"
            value={form.duration}
            onChange={(e) => update('duration', e.target.value)}
            error={fieldErrors.duration}
            hint="e.g. 8 weeks"
            maxLength={100}
          />
          <SelectField
            label="Level"
            value={form.level}
            onChange={(e) => update('level', e.target.value)}
            error={fieldErrors.level}
          >
            {COURSE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {LEVEL_LABELS[level]}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="form__row">
          <TextField
            label="Fee (INR)"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={form.fee}
            onChange={(e) => update('fee', e.target.value)}
            error={fieldErrors.fee}
            hint="0 for a free course."
            required
          />
          <SelectField
            label="Status"
            value={form.status}
            onChange={(e) => update('status', e.target.value)}
            error={fieldErrors.status}
            hint="Only published courses are visible to the public."
          >
            {Object.entries(COURSE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
        </div>
        <fieldset className="media-fieldset">
          <legend className="media-fieldset__legend">Course visuals (optional)</legend>
          <p className="field__hint">
            Both fields are optional. Without them the course uses the default Eduyarp visual and icon.
            Use images hosted online; files are not uploaded here.
          </p>
          <ImageUrlField
            label="Cover image URL"
            variant="cover"
            value={form.coverImageUrl}
            onChange={(value) => update('coverImageUrl', value)}
            error={fieldErrors.coverImageUrl}
            hint="Optional. Used as the visual cover for this course."
            clearLabel="Remove cover image"
          />
          <ImageUrlField
            label="Course icon URL"
            variant="icon"
            value={form.iconUrl}
            onChange={(value) => update('iconUrl', value)}
            error={fieldErrors.iconUrl}
            hint="Optional. Use a small square icon, or leave empty to use the default Eduyarp icon."
            clearLabel="Use default icon"
          />
        </fieldset>
      </form>
    </Modal>
  )
}
