import { useState } from 'react'
import { servicesApi } from '../api/endpoints'
import { CheckboxField, SelectField, TextAreaField, TextField } from '../components/Fields'
import { Modal } from '../components/Modal'
import { Alert, Spinner } from '../components/States'
import { splitApiError } from '../utils/errors'

const FIELDS = ['name', 'platformId', 'description', 'isActive']

// service: an existing service to edit, or null to create one.
// platforms: list for the platform picker (may be null while loading).
export function ServiceFormModal({ service, platforms, platformsError, onClose, onSaved }) {
  const isEdit = Boolean(service)
  const [form, setForm] = useState({
    name: service?.name ?? '',
    platformId: service?.platformId ?? '',
    description: service?.description ?? '',
    isActive: service?.isActive ?? true,
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setFormError(null)
    setFieldErrors({})
    // An empty selection means the service does not belong to a platform.
    const payload = { ...form, platformId: form.platformId === '' ? null : form.platformId }
    try {
      const saved = isEdit
        ? await servicesApi.update(service.id, payload)
        : await servicesApi.create(payload)
      onSaved(saved, isEdit)
    } catch (error) {
      const split = splitApiError(error, FIELDS)
      if (error.status === 409) {
        split.fieldErrors.name = error.message
        split.formError = null
      }
      setFieldErrors(split.fieldErrors)
      setFormError(split.formError)
      setBusy(false)
    }
  }

  const close = () => {
    if (!busy) onClose()
  }

  // Keep the current platform selectable even if the list failed to load.
  const platformOptions = platforms ?? []
  const currentMissing =
    form.platformId !== '' && !platformOptions.some((p) => p.id === form.platformId)

  return (
    <Modal
      title={isEdit ? `Edit ${service.name}` : 'Add service'}
      onClose={close}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="service-form" className="btn btn--primary" disabled={busy}>
            {busy && <Spinner size="sm" />}
            {isEdit ? 'Save changes' : 'Add service'}
          </button>
        </>
      }
    >
      {formError && <Alert>{formError}</Alert>}
      <form id="service-form" className="form" onSubmit={handleSubmit}>
        <TextField
          label="Name"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          error={fieldErrors.name}
          hint="Must be unique within its platform."
          maxLength={150}
          required
          autoFocus
        />
        <SelectField
          label="Platform"
          value={form.platformId}
          onChange={(e) => update('platformId', e.target.value)}
          error={fieldErrors.platformId}
          hint={
            platformsError
              ? `Platforms could not be loaded: ${platformsError.message}`
              : 'Optional. Leave as “No platform” for a standalone service.'
          }
        >
          <option value="">No platform</option>
          {currentMissing && (
            <option value={form.platformId}>{service?.platformName ?? `Platform #${form.platformId}`}</option>
          )}
          {platformOptions.map((platform) => (
            <option key={platform.id} value={platform.id}>
              {platform.name}
              {platform.isActive ? '' : ' (inactive)'}
            </option>
          ))}
        </SelectField>
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
        />
      </form>
    </Modal>
  )
}
