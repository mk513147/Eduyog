import { Link } from '../../router/Link'
import { Icon } from '../Icon'

export function Skeleton({ lines = 3, className = '' }) {
  return (
    <div className={`skeleton-block ${className}`.trim()} role="status" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="skeleton" style={{ width: `${88 - i * 14}%` }} />
      ))}
    </div>
  )
}

function Failed({ label, resources }) {
  const failed = resources.find((r) => r.error)
  return (
    <div className="panel__error" role="alert">
      <Icon name="alert" size={18} />
      <div>
        <p className="panel__error-title">Unable to load {label}</p>
        <p className="panel__error-text">{failed.error.message}</p>
      </div>
      <button
        type="button"
        className="btn btn--secondary btn--sm"
        onClick={() => resources.forEach((r) => r.error && r.reload())}
      >
        Retry
      </button>
    </div>
  )
}

/**
 * A dashboard card. `resources` are the useResource results it depends on: while any is loading a
 * compact skeleton shows, if any failed a local error with Retry shows, and otherwise `children()`
 * renders. Other cards are never affected.
 */
export function Panel({ title, icon, to, linkLabel, resources, errorLabel, skeletonLines = 3, partial = false, className = '', children }) {
  // partial: a card built from several sources keeps working with whichever loaded, and only
  // shows its error when none could be loaded.
  const pending = (r) => r.loading && r.data === null
  const broken = (r) => r.error && r.data === null
  const loading = partial ? resources.every(pending) : resources.some(pending)
  const failed = partial ? resources.every(broken) : resources.some(broken)
  let body
  if (loading) body = <Skeleton lines={skeletonLines} />
  else if (failed) body = <Failed label={errorLabel ?? title.toLowerCase()} resources={resources} />
  else body = children()

  return (
    <section className={`panel ${className}`.trim()} aria-labelledby={`panel-${title.replace(/\W+/g, '-').toLowerCase()}`}>
      <header className="panel__head">
        <h2 className="panel__title" id={`panel-${title.replace(/\W+/g, '-').toLowerCase()}`}>
          {icon && <Icon name={icon} size={16} />}
          {title}
        </h2>
        {to && (
          <Link to={to} className="panel__link">
            {linkLabel} <Icon name="arrow" size={14} />
          </Link>
        )}
      </header>
      {body}
    </section>
  )
}

// One headline figure. `value` and `detail` read the loaded data.
export function Kpi({ label, icon, to, resource, value, detail }) {
  const { data, error, loading, reload } = resource
  let body
  if (loading && data === null) body = <Skeleton lines={2} />
  else if (error && data === null) {
    body = (
      <div className="kpi__error" role="alert">
        <span>Unavailable</span>
        <button type="button" className="btn btn--secondary btn--sm" onClick={reload}>
          Retry
        </button>
      </div>
    )
  } else {
    body = (
      <>
        <p className="kpi__value">{value(data)}</p>
        <p className="kpi__detail">{detail(data)}</p>
      </>
    )
  }
  return (
    <section className="kpi" aria-label={label}>
      <div className="kpi__head">
        <span className="kpi__icon">
          <Icon name={icon} size={16} />
        </span>
        <Link to={to} className="kpi__label">
          {label}
        </Link>
      </div>
      {body}
    </section>
  )
}
