import { useCallback, useState } from 'react'
import { usersApi } from '../api/endpoints'
import { ApprovalStatusBadge } from '../components/Badge'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { TextAreaField } from '../components/Fields'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { Alert, EmptyState, ErrorState, LoadingState, Spinner } from '../components/States'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { useResource } from '../hooks/useResource'
import { useToast } from '../toast/useToast'
import { formatDateTime } from '../utils/format'

const STATUS_OPTIONS = [
  ['pending', 'Pending'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
]

const EMPTY_TEXT = {
  pending: ['No pending registrations', 'New student registrations that need a decision will appear here.'],
  approved: ['No approved registrations', 'Students you approve are listed here.'],
  rejected: ['No rejected registrations', 'Registrations you reject are kept here.'],
}

// Rejecting takes an optional reason (kept with the record; it is never shown to the student).
function RejectModal({ registration, onClose, onRejected }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      onRejected(await usersApi.decideApproval(registration.id, { status: 'rejected', reason: reason.trim() || null }))
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
      title="Reject registration?"
      size="sm"
      onClose={close}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="reject-registration-form" className="btn btn--danger" disabled={busy}>
            {busy && <Spinner size="sm" />}
            Reject registration
          </button>
        </>
      }
    >
      <p>
        <strong>{registration.fullName}</strong> ({registration.email}) will not be able to sign in. You can approve the
        account again later.
      </p>
      <form id="reject-registration-form" className="form" onSubmit={submit} noValidate>
        <TextAreaField
          label="Reason (optional)"
          value={reason}
          onChange={(event) => {
            setReason(event.target.value)
            setError(null)
          }}
          error={error}
          maxLength={500}
          rows={3}
          hint="Kept for the records. It is not shown to the student."
        />
      </form>
    </Modal>
  )
}

export default function RegistrationsPage() {
  const [status, setStatus] = useState('pending')
  const loader = useCallback(() => usersApi.registrations(status), [status])
  const { data: registrations, error, loading, reload } = useResource(loader)
  useAutoRefresh(reload, { enabled: Boolean(registrations) })
  const toast = useToast()
  const [approving, setApproving] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [approveError, setApproveError] = useState(null)

  const confirmApprove = async () => {
    setBusy(true)
    setApproveError(null)
    try {
      await usersApi.decideApproval(approving.id, { status: 'approved' })
      toast.success(`${approving.fullName} can now sign in.`)
      setApproving(null)
      reload()
    } catch (err) {
      setApproveError(err.message)
    } finally {
      setBusy(false)
    }
  }

  let content
  if (loading) content = <LoadingState label="Loading registrations…" />
  else if (error && !registrations) content = <ErrorState error={error} onRetry={reload} />
  else if (registrations.length === 0) content = <EmptyState title={EMPTY_TEXT[status][0]} description={EMPTY_TEXT[status][1]} />
  else
    content = (
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Student</th>
              <th scope="col">Email</th>
              <th scope="col">Registered</th>
              <th scope="col">Status</th>
              {status !== 'pending' && <th scope="col">Decision</th>}
              <th scope="col" className="table__actions-head">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((r) => (
              <tr key={r.id}>
                <td className="cell-primary">{r.fullName}</td>
                <td className="cell-break">{r.email}</td>
                <td className="cell-nowrap">{formatDateTime(r.createdAt)}</td>
                <td>
                  <ApprovalStatusBadge status={r.approvalStatus} />
                </td>
                {status !== 'pending' && (
                  <td className="cell-break">
                    {r.decidedAt ? `${formatDateTime(r.decidedAt)}${r.decidedByName ? ` by ${r.decidedByName}` : ''}` : '—'}
                    {r.reason && <div className="cell-secondary">{r.reason}</div>}
                  </td>
                )}
                <td>
                  <div className="row-actions">
                    {r.approvalStatus !== 'approved' && (
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        onClick={() => {
                          setApproveError(null)
                          setApproving(r)
                        }}
                      >
                        Approve<span className="visually-hidden"> {r.fullName}</span>
                      </button>
                    )}
                    {r.approvalStatus !== 'rejected' && (
                      <button type="button" className="btn btn--danger-ghost btn--sm" onClick={() => setRejecting(r)}>
                        Reject<span className="visually-hidden"> {r.fullName}</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )

  return (
    <>
      <PageHeader
        title="Student Registrations"
        description="New students cannot sign in until you approve their registration. Rejected or revoked students lose access immediately."
      />
      {error && registrations && <Alert>Could not refresh the list: {error.message}</Alert>}
      <div className="filters">
        <select className="input" aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}>
          {STATUS_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="card card--flush">{content}</div>

      {approving && (
        <ConfirmDialog
          title="Approve registration?"
          confirmLabel="Approve"
          busy={busy}
          error={approveError}
          onConfirm={confirmApprove}
          onClose={() => setApproving(null)}
        >
          <p>
            <strong>{approving.fullName}</strong> ({approving.email}) will be able to sign in. Approval does not give access to
            any course; that is granted separately.
          </p>
        </ConfirmDialog>
      )}
      {rejecting && (
        <RejectModal
          registration={rejecting}
          onClose={() => setRejecting(null)}
          onRejected={(updated) => {
            setRejecting(null)
            toast.success(`${updated.fullName}'s registration was rejected.`)
            reload()
          }}
        />
      )}
    </>
  )
}
