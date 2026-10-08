import { formatLongDate } from '../utils/format'

// The printable certificate. Everything shown comes from the issued record (the name and course
// title as they were when it was issued), never from the current profile or course.
export function CertificateSheet({ certificate }) {
  const revoked = certificate.status === 'revoked'
  return (
    <article className={`cert${revoked ? ' cert--revoked' : ''}`} aria-label={`Certificate ${certificate.certificateNumber}`}>
      <div className="cert__frame">
        <header className="cert__brand">
          <span className="cert__mark" aria-hidden="true">
            E
          </span>
          <div>
            <p className="cert__org">Eduyarp by Eduyog</p>
            <p className="cert__org-sub">Eduyog Techno Solution Pvt. Ltd.</p>
          </div>
        </header>

        <h2 className="cert__title">Certificate of Completion</h2>
        {revoked && (
          <p className="cert__revoked-banner" role="status">
            REVOKED{certificate.revokedAt ? ` on ${formatLongDate(certificate.revokedAt)}` : ''}
          </p>
        )}

        <p className="cert__line">This is to certify that</p>
        <p className="cert__name">{certificate.studentName}</p>
        <p className="cert__line">has completed all topics of the course</p>
        <p className="cert__course">{certificate.courseTitle}</p>
        <p className="cert__line cert__line--small">on the Eduyarp learning platform.</p>

        <dl className="cert__meta">
          <div>
            <dt>Issue date</dt>
            <dd>{formatLongDate(certificate.issuedAt)}</dd>
          </div>
          <div>
            <dt>Certificate number</dt>
            <dd className="cert__number">{certificate.certificateNumber}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{revoked ? 'Revoked' : 'Active'}</dd>
          </div>
        </dl>

        {revoked && (
          <span className="cert__watermark" aria-hidden="true">
            REVOKED
          </span>
        )}
      </div>
    </article>
  )
}
