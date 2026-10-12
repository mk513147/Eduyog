import { useCallback, useState } from 'react'
import { eduyarpApi } from '../../api/endpoints'
import { RequestStatusBadge } from '../../components/Badge'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { TextAreaField } from '../../components/Fields'
import { Modal } from '../../components/Modal'
import { Alert, EmptyState, ErrorState, LoadingState, Spinner } from '../../components/States'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { useResource } from '../../hooks/useResource'
import { useToast } from '../../toast/useToast'
import { formatDateTime } from '../../utils/format'

const STATUS_OPTIONS = [
  ['pending', 'Pending'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
]

// Rejecting needs a reason; the student sees it and may request again.
function RejectModal({ request, onClose, onRejected }) {
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
      onRejected(await eduyarpApi.certificates.requests.reject(request.id, reason))
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
      title="Reject certificate request?"
      size="sm"
      onClose={close}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="reject-request-form" className="btn btn--danger" disabled={busy}>
            {busy && <Spinner size="sm" />}
            Reject request
          </button>
        </>
      }
    >
      <p>
        <strong>{request.studentName}</strong> asked for a certificate for {request.courseTitle}. No certificate will be issued.
        The student can request one again.
      </p>
      <form id="reject-request-form" className="form" onSubmit={submit} noValidate>
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
          hint="Shown to the student. Required."
          required
        />
      </form>
    </Modal>
  )
}

export default function CertificateRequestsPanel({ onIssued }) {
  const [status, setStatus] = useState('pending')
  const loader = useCallback(() => eduyarpApi.certificates.requests.list(status), [status])
  const { data: requests, error, loading, reload } = useResource(loader)
  useAutoRefresh(reload, { enabled: Boolean(requests) })
  const toast = useToast()
  const [approving, setApproving] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [approveError, setApproveError] = useState(null)

  const confirmApprove = async () => {
    setBusy(true)
    setApproveError(null)
    try {
      await eduyarpApi.certificates.requests.approve(approving.id)
      toast.success(`Certificate issued to ${approving.studentName}.`)
      setApproving(null)
      reload()
      onIssued?.()
    } catch (err) {
      // 409: already decided elsewhere, or the student no longer qualifies. Refresh to show the truth.
      setApproveError(err.message)
      if (err.status === 409) reload()
    } finally {
      setBusy(false)
    }
  }

  let content
  if (loading) content = <LoadingState label="Loading requests…" />
  else if (error && !requests) content = <ErrorState error={error} onRetry={reload} />
  else if (requests.length === 0)
    content = (
      <div className="card card--flush">
        <EmptyState
          title={status === 'pending' ? 'No pending requests' : `No ${status} requests`}
          description="When a student completes a course, a request appears here for you to approve or reject."
        />
      </div>
    )
  else
    content = (
      <div className="card card--flush">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Course</th>
                <th scope="col">Requested</th>
                <th scope="col">Status</th>
                <th scope="col" className="table__actions-head">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="cell-primary">{r.studentName}</div>
                    <div className="cell-secondary cell-break">{r.studentEmail}</div>
                  </td>
                  <td className="cell-break">{r.courseTitle}</td>
                  <td className="cell-nowrap">{formatDateTime(r.requestedAt)}</td>
                  <td>
                    <RequestStatusBadge status={r.status} />
                    {r.decidedAt && (
                      <div className="cell-secondary">
                        {formatDateTime(r.decidedAt)}
                        {r.decidedByName ? ` by ${r.decidedByName}` : ''}
                      </div>
                    )}
                    {r.decisionReason && <div className="cell-secondary cell-break">{r.decisionReason}</div>}
                  </td>
                  <td>
                    <div className="row-actions">
                      {r.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            className="btn btn--primary btn--sm"
                            onClick={() => {
                              setApproveError(null)
                              setApproving(r)
                            }}
                          >
                            Approve<span className="visually-hidden"> certificate for {r.studentName}</span>
                          </button>
                          <button type="button" className="btn btn--danger-ghost btn--sm" onClick={() => setRejecting(r)}>
                            Reject<span className="visually-hidden"> certificate for {r.studentName}</span>
                          </button>
                        </>
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
      {error && requests && <Alert>Could not refresh the list: {error.message}</Alert>}
      <div className="filters">
        <select className="input" aria-label="Filter requests by status" value={status} onChange={(event) => setStatus(event.target.value)}>
          {STATUS_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {content}

      {approving && (
        <ConfirmDialog
          title="Approve certificate?"
          confirmLabel="Approve and issue"
          busy={busy}
          error={approveError}
          onConfirm={confirmApprove}
          onClose={() => setApproving(null)}
        >
          <p>
            <strong>Student:</strong> {approving.studentName}
            <br />
            <strong>Course:</strong> {approving.courseTitle}
          </p>
          <p>A certificate with a new number will be issued and shown to the student.</p>
        </ConfirmDialog>
      )}
      {rejecting && (
        <RejectModal
          request={rejecting}
          onClose={() => setRejecting(null)}
          onRejected={() => {
            setRejecting(null)
            toast.success('Request rejected.')
            reload()
          }}
        />
      )}
    </>
  )
}
