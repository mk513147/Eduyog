import { useCallback, useState } from 'react'
import { eduyarpApi } from '../../api/endpoints'
import { TextAreaField } from '../../components/Fields'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { Alert, EmptyState, ErrorState, LoadingState, Spinner } from '../../components/States'
import { useResource } from '../../hooks/useResource'
import { useToast } from '../../toast/useToast'
import { formatDateTime } from '../../utils/format'

function StatusBadge({ status }) {
  return <span className={`badge ${status === 'revoked' ? 'badge--danger' : 'badge--success'}`}>{status === 'revoked' ? 'Revoked' : 'Active'}</span>
}

function DetailsModal({ certificate: c, onClose }) {
  return (
    <Modal
      title={`Certificate ${c.certificateNumber}`}
      onClose={onClose}
      footer={
        <button type="button" className="btn btn--secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      <dl className="details details--stacked">
        <div>
          <dt>Status</dt>
          <dd>
            <StatusBadge status={c.status} />
          </dd>
        </div>
        <div>
          <dt>Certificate number</dt>
          <dd className="cell-break">{c.certificateNumber}</dd>
        </div>
        <div>
          <dt>Student (as issued)</dt>
          <dd className="cell-break">
            {c.studentName} · {c.studentEmail}
          </dd>
        </div>
        <div>
          <dt>Course (as issued)</dt>
          <dd className="cell-break">{c.courseTitle}</dd>
        </div>
        <div>
          <dt>Issued</dt>
          <dd>{formatDateTime(c.issuedAt)}</dd>
        </div>
        {c.status === 'revoked' && (
          <>
            <div>
              <dt>Revoked</dt>
              <dd>
                {formatDateTime(c.revokedAt)} by {c.revokedByName}
              </dd>
            </div>
            <div>
              <dt>Reason</dt>
              <dd className="details__message cell-break">{c.revocationReason}</dd>
            </div>
          </>
        )}
      </dl>
      <p className="muted small">The name and course title are fixed when the certificate is issued and do not change if the student or the course is renamed later.</p>
    </Modal>
  )
}

function RevokeModal({ certificate: c, onClose, onRevoked }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    if (reason.trim() === '') {
      setError('A reason is required')
      return
    }
    setBusy(true)
    setError(null)
    try {
      onRevoked(await eduyarpApi.certificates.revoke(c.id, reason))
    } catch (err) {
      setError(err.details?.reason || err.message)
      setBusy(false)
    }
  }

  const close = () => {
    if (!busy) onClose()
  }

  return (
    <Modal
      title="Revoke certificate?"
      size="sm"
      onClose={close}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="revoke-form" className="btn btn--danger" disabled={busy}>
            {busy && <Spinner size="sm" />}
            Revoke certificate
          </button>
        </>
      }
    >
      <p>
        <strong>{c.certificateNumber}</strong> ({c.studentName}, {c.courseTitle}) will be marked revoked. It is kept as a record and cannot be restored.
      </p>
      <form id="revoke-form" className="form" onSubmit={submit} noValidate>
        <TextAreaField
          label="Reason"
          value={reason}
          onChange={(event) => {
            setReason(event.target.value)
            setError(null)
          }}
          error={error}
          maxLength={500}
          rows={3}
          hint="Recorded with your name and the time. Required."
          required
        />
      </form>
    </Modal>
  )
}

export default function CertificatesPage() {
  const loader = useCallback(() => eduyarpApi.certificates.list(), [])
  const { data: certificates, error, loading, reload } = useResource(loader, { refetchOnFocus: true })
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [courseId, setCourseId] = useState('')
  const [viewing, setViewing] = useState(null)
  const [revoking, setRevoking] = useState(null)

  const courses = certificates ? [...new Map(certificates.map((c) => [c.courseId, c.courseTitle])).entries()] : []
  const term = search.trim().toLowerCase()
  const visible = (certificates ?? []).filter(
    (c) =>
      (!status || c.status === status) &&
      (!courseId || String(c.courseId) === courseId) &&
      (!term || [c.studentName, c.studentEmail, c.courseTitle, c.certificateNumber].some((v) => v.toLowerCase().includes(term))),
  )
  const filtered = Boolean(status || courseId || term)

  let content
  if (loading) content = <LoadingState label="Loading certificates…" />
  else if (error && !certificates) content = <ErrorState error={error} onRetry={reload} />
  else if (certificates.length === 0)
    content = (
      <div className="card card--flush">
        <EmptyState title="No certificates yet" description="A certificate is issued automatically when a student completes every topic of a course." />
      </div>
    )
  else if (visible.length === 0)
    content = (
      <div className="card card--flush">
        <EmptyState title="No certificates match the filters" />
      </div>
    )
  else
    content = (
      <div className="card card--flush">
        <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Certificate</th>
              <th scope="col">Student</th>
              <th scope="col">Course</th>
              <th scope="col">Issued</th>
              <th scope="col">Status</th>
              <th scope="col" className="table__actions-head">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => (
              <tr key={c.id}>
                <td className="cell-nowrap cell-primary">{c.certificateNumber}</td>
                <td>
                  <div className="cell-primary">{c.studentName}</div>
                  <div className="cell-secondary cell-break">{c.studentEmail}</div>
                </td>
                <td className="cell-break">{c.courseTitle}</td>
                <td className="cell-nowrap">{formatDateTime(c.issuedAt)}</td>
                <td>
                  <StatusBadge status={c.status} />
                </td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => setViewing(c)}>
                      View<span className="visually-hidden"> {c.certificateNumber}</span>
                    </button>
                    {c.status === 'active' && (
                      <button type="button" className="btn btn--danger-ghost btn--sm" onClick={() => setRevoking(c)}>
                        Revoke<span className="visually-hidden"> {c.certificateNumber}</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    )

  return (
    <>
      <PageHeader
        title="Eduyarp Certificates"
        description="Issued automatically when a student completes a course. Revoking keeps the record and marks it revoked."
      />
      {error && certificates && <Alert>Could not refresh the list: {error.message}</Alert>}
      {certificates && certificates.length > 0 && (
        <div className="filters cert-filters">
          <input
            type="search"
            className="input filters__search"
            placeholder="Search student, course or number..."
            aria-label="Search student, course or certificate number"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select className="input" aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
          </select>
          <select className="input" aria-label="Filter by course" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
            <option value="">All courses</option>
            {courses.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              setSearch('')
              setStatus('')
              setCourseId('')
            }}
            disabled={!filtered}
          >
            Clear filters
          </button>
        </div>
      )}
      {content}

      {viewing && <DetailsModal certificate={viewing} onClose={() => setViewing(null)} />}
      {revoking && (
        <RevokeModal
          certificate={revoking}
          onClose={() => setRevoking(null)}
          onRevoked={(updated) => {
            setRevoking(null)
            toast.success(`${updated.certificateNumber} is now revoked.`)
            reload()
          }}
        />
      )}
    </>
  )
}
