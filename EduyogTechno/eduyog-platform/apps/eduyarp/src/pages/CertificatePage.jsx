import { useCallback } from 'react'
import { studentApi } from '../api/endpoints'
import { CertificateSheet } from '../components/CertificateSheet'
import { Icon } from '../components/Icon'
import { Alert, ErrorState, LoadingState } from '../components/States'
import { usePageTitle } from '../hooks/usePageTitle'
import { useResource } from '../hooks/useResource'
import { Link } from '../router/Link'
import NotFoundPage from './NotFoundPage'

export default function CertificatePage({ params }) {
  const loader = useCallback(() => studentApi.certificate(params.certificateId), [params.certificateId])
  const { data: certificate, error, loading, reload } = useResource(loader)
  usePageTitle(certificate ? `Certificate: ${certificate.courseTitle}` : 'Certificate')

  if (loading) return <LoadingState label="Loading certificate…" />
  if (error?.status === 404 || error?.status === 400) return <NotFoundPage message="This certificate was not found." />
  if (error && !certificate) return <ErrorState error={error} onRetry={reload} />

  return (
    <div className="container page cert-page">
      <div className="cert-toolbar no-print">
        <Link to="/certificates" className="back-link back-link--dark">
          <Icon name="arrowLeft" size={16} /> All certificates
        </Link>
        <button type="button" className="btn btn--primary" onClick={() => window.print()}>
          <Icon name="print" size={16} /> Print certificate
        </button>
      </div>
      {certificate.status === 'revoked' && (
        <div className="no-print">
          <Alert tone="info">This certificate has been revoked. It is kept as a record and is marked revoked when printed.</Alert>
        </div>
      )}
      <CertificateSheet certificate={certificate} />
      <p className="muted small no-print">Use your browser&apos;s print dialog to print the certificate or save it as a PDF.</p>
    </div>
  )
}
