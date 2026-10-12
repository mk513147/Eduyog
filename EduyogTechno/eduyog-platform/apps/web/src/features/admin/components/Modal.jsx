import { useEffect, useId, useRef } from 'react'
import { Icon } from './Icon'

// Native <dialog> provides focus trapping, Escape handling and inert
// background. Rendered content mounts only while open, so forms reset.
export function Modal({ open = true, title, onClose, children, footer, size = 'md' }) {
  const ref = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`modal modal--${size}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      {open && (
        <div className="modal__content">
          <div className="modal__header">
            <h2 id={titleId} className="modal__title">
              {title}
            </h2>
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              onClick={onClose}
              aria-label="Close"
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="modal__body">{children}</div>
          {footer && <div className="modal__footer">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}
