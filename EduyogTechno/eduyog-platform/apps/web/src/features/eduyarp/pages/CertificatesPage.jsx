import { studentApi } from '../api/endpoints'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { usePageTitle } from '../hooks/usePageTitle'
import { useResource } from '../hooks/useResource'
import { Link } from '../router/Link'
import { formatLongDate } from '../utils/format'

export default function CertificatesPage() {
  usePageTitle('Certificates')
  const { data, error, loading, reload } = useResource(studentApi.certificates)
  const requests = useResource(studentApi.certificateRequests)
  // Requests that have no certificate (yet): waiting for approval, or not approved.
  const open = (requests.data ?? []).filter((r) => r.status !== 'approved')

  return (
    <div className="container page">
      <header className="page__header">
        <p className="eyebrow">Your achievements</p>
        <h1 className="page__title">Certificates</h1>
        <p className="page__lead">When you finish every topic of a course, Eduyog reviews your certificate request and issues it.</p>
      </header>

      {loading && <LoadingState label="Loading certificates…" />}
      {error && !data && <ErrorState error={error} onRetry={reload} />}
      {open.length > 0 && (
        <ul className="cert-list">
          {open.map((r) => (
            <li key={r.id} className="cert-item">
              <span className="cert-item__icon" aria-hidden="true">
                <Icon name="award" size={22} />
              </span>
              <div className="cert-item__main">
                <Link to={`/eduyarp/my-courses/${r.courseId}`} className="cert-item__title">
                  {r.courseTitle}
                </Link>
                <p className="cert-item__meta">
                  {r.status === 'pending'
                    ? `Requested ${formatLongDate(r.requestedAt)} · waiting for approval`
                    : `Not approved${r.decisionReason ? `: ${r.decisionReason}` : ''}. Open the course to request it again.`}
                </p>
              </div>
              <span className={`badge ${r.status === 'pending' ? '' : 'badge--danger'}`}>
                {r.status === 'pending' ? 'Pending' : 'Not approved'}
              </span>
            </li>
          ))}
        </ul>
      )}
      {data && data.length === 0 && open.length === 0 && (
        <EmptyState
          title="No certificates yet"
          description="Complete all topics of a course and, once Eduyog approves your request, your certificate will appear here."
          action={
            <Link to="/eduyarp/dashboard" className="btn btn--secondary">
              Go to my courses
            </Link>
          }
        />
      )}
      {data && data.length > 0 && (
        <ul className="cert-list">
          {data.map((c) => (
            <li key={c.id} className="cert-item">
              <span className="cert-item__icon" aria-hidden="true">
                <Icon name="award" size={22} />
              </span>
              <div className="cert-item__main">
                <Link to={`/eduyarp/certificates/${c.id}`} className="cert-item__title">
                  {c.courseTitle}
                </Link>
                <p className="cert-item__meta">
                  Issued {formatLongDate(c.issuedAt)} · <span className="cert-item__number">{c.certificateNumber}</span>
                </p>
              </div>
              <span className={`badge ${c.status === 'revoked' ? 'badge--danger' : 'badge--success'}`}>
                {c.status === 'revoked' ? 'Revoked' : 'Active'}
              </span>
              <Link to={`/eduyarp/certificates/${c.id}`} className="btn btn--secondary btn--sm">
                View
                <span className="visually-hidden"> certificate for {c.courseTitle}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
