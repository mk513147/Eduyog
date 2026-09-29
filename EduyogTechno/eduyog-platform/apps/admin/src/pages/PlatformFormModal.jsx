import { useState } from 'react'
import { platformsApi } from '../api/endpoints'
import { CheckboxField, TextAreaField, TextField } from '../components/Fields'
import { Modal } from '../components/Modal'
import { Alert, Spinner } from '../components/States'
import { splitApiError } from '../utils/errors'
import { slugify } from '../utils/format'

const FIELDS = ['name', 'slug', 'url', 'description', 'isActive']

// platform: an existing platform to edit, or null to create one.
export function PlatformFormModal({ platform, onClose, onSaved }) {
  const isEdit = Boolean(platform)
  const [form, setForm] = useState({
    name: platform?.name ?? '',
    slug: platform?.slug ?? '',
    url: platform?.url ?? '',
    description: platform?.description ?? '',
    isActive: platform?.isActive ?? true,
  })
  // When creating, the slug follows the name until edited by hand.
  const [slugEdited, setSlugEdited] = useState(isEdit)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleNameChange = (value) => {
    update('name', value)
    if (!slugEdited) update('slug', slugify(value))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setFormError(null)
    setFieldErrors({})
    try {
      const saved = isEdit
        ? await platformsApi.update(platform.id, form)
        : await platformsApi.create(form)
      onSaved(saved, isEdit)
    } catch (error) {
      const split = splitApiError(error, FIELDS)
      // Uniqueness conflicts (409) name the field in the message.
      if (error.status === 409) {
        if (/slug/i.test(error.message)) split.fieldErrors.slug = error.message
        else if (/name/i.test(error.message)) split.fieldErrors.name = error.message
        else split.formError = error.message
        if (split.fieldErrors.slug || split.fieldErrors.name) split.formError = null
      }
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
      title={isEdit ? `Edit ${platform.name}` : 'Add platform'}
      onClose={close}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="platform-form" className="btn btn--primary" disabled={busy}>
            {busy && <Spinner size="sm" />}
            {isEdit ? 'Save changes' : 'Add platform'}
          </button>
        </>
      }
    >
      {formError && <Alert>{formError}</Alert>}
      <form id="platform-form" className="form" onSubmit={handleSubmit}>
        <TextField
          label="Name"
          value={form.name}
          onChange={(e) => handleNameChange(e.target.value)}
          error={fieldErrors.name}
          maxLength={100}
          required
          autoFocus
        />
        <TextField
          label="Slug"
          value={form.slug}
          onChange={(e) => {
            setSlugEdited(true)
            update('slug', e.target.value)
          }}
          error={fieldErrors.slug}
          hint="Lowercase letters, numbers and single hyphens, e.g. student-aq."
          maxLength={100}
          required
        />
        <TextField
          label="Website URL"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={form.url}
          onChange={(e) => update('url', e.target.value)}
          error={fieldErrors.url}
          hint="External website link (http:// or https://)."
          required
        />
        <TextAreaField
          label="Description"
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          error={fieldErrors.description}
          maxLength={2000}
          rows={3}
        />
        <CheckboxField
          label="Active"
          checked={form.isActive}
          onChange={(e) => update('isActive', e.target.checked)}
          error={fieldErrors.isActive}
          hint="Inactive platforms stay in the system but are marked as not in use."
        />
      </form>
    </Modal>
  )
}
