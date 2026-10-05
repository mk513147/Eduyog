import { Modal } from './Modal'
import { Alert, Spinner } from './States'

export function ConfirmDialog({
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  busy = false,
  error = null,
  onConfirm,
  onClose,
}) {
  const close = () => {
    if (!busy) onClose()
  }

  return (
    <Modal
      title={title}
      onClose={close}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={close} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn btn--${tone === 'danger' ? 'danger' : 'primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <Spinner size="sm" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="confirm__text">{children}</div>
      {error && <Alert>{error}</Alert>}
    </Modal>
  )
}
