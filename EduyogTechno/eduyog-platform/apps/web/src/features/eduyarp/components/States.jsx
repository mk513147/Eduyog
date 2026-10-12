export function Spinner({ size = 'md' }) {
  return <span className={`spinner spinner--${size}`} aria-hidden="true" />
}

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="state" role="status">
      <Spinner />
      <span>{label}</span>
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="state state--error" role="alert">
      <p className="state__title">Could not load this page</p>
      <p className="state__text">{error?.message || 'Something went wrong.'}</p>
      {onRetry && (
        <button type="button" className="btn btn--secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="state">
      <p className="state__title">{title}</p>
      {description && <p className="state__text">{description}</p>}
      {action}
    </div>
  )
}

export function Alert({ tone = 'error', children }) {
  return (
    <div className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}
