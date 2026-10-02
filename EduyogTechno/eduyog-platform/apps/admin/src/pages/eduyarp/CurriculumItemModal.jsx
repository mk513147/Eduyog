import { useState } from 'react'
import { TextAreaField, TextField } from '../../components/Fields'
import { Modal } from '../../components/Modal'
import { Alert, Spinner } from '../../components/States'
import { splitApiError } from '../../utils/errors'

const FIELDS = ['title', 'description', 'displayOrder']

// Add or edit a module or topic; both have title, description and order.
// kind: 'Module' | 'Topic'. item: existing item to edit, or null to add.
// save(payload) performs the API call and resolves with the saved item.
export function CurriculumItemModal({ kind, item, context, save, onClose, onSaved }) {
  const isEdit = Boolean(item)
  const [form, setForm] = useState({
    title: item?.title ?? '',
    description: item?.description ?? '',
    displayOrder: item ? String(item.displayOrder) : '',
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
    const payload = { title: form.title, description: form.description }
    // Blank order on create: the backend appends it after existing items.
    if (form.displayOrder.trim() !== '') payload.displayOrder = Number(form.displayOrder)
    try {
      const saved = await save(payload)
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
      title={isEdit ? `Edit ${kind.toLowerCase()}` : `Add ${kind.toLowerCase()}`}
      onClose={close}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="curriculum-form" className="btn btn--primary" disabled={busy}>
            {busy && <Spinner size="sm" />}
            {isEdit ? 'Save changes' : `Add ${kind.toLowerCase()}`}
          </button>
        </>
      }
    >
      {context && <p className="muted">{context}</p>}
      {formError && <Alert>{formError}</Alert>}
      <form id="curriculum-form" className="form" onSubmit={handleSubmit}>
        <TextField
          label="Title"
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          error={fieldErrors.title}
          maxLength={200}
          required
          autoFocus
        />
        <TextAreaField
          label="Description"
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          error={fieldErrors.description}
          maxLength={2000}
          rows={3}
        />
        <TextField
          label="Display order"
          type="number"
          min="0"
          step="1"
          value={form.displayOrder}
          onChange={(e) => update('displayOrder', e.target.value)}
          error={fieldErrors.displayOrder}
          hint={isEdit ? 'Lower numbers appear first.' : 'Optional. Leave blank to add it at the end.'}
        />
      </form>
    </Modal>
  )
}
