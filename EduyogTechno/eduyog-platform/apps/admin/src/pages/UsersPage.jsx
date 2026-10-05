import { useState } from 'react'
import { usersApi } from '../api/endpoints'
import { useAuth } from '../auth/useAuth'
import { RoleBadge } from '../components/Badge'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PageHeader } from '../components/PageHeader'
import { Alert, EmptyState, ErrorState, LoadingState } from '../components/States'
import { useResource } from '../hooks/useResource'
import { useToast } from '../toast/useToast'
import { formatDate } from '../utils/format'
import { ROLE_LABELS, ROLES } from '../utils/labels'

const ROLE_ARTICLES = { student: 'a Student', trainer: 'a Trainer', admin: 'an Admin' }

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const { data: users, error, loading, reload } = useResource(usersApi.list, { refetchOnFocus: true })
  const toast = useToast()
  // { user, role } while confirming a role change.
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [changeError, setChangeError] = useState(null)

  const requestChange = (user, role) => {
    if (role === user.role) return
    setChangeError(null)
    setPending({ user, role })
  }

  const confirmChange = async () => {
    setBusy(true)
    setChangeError(null)
    try {
      const updated = await usersApi.changeRole(pending.user.id, pending.role)
      toast.success(`${updated.fullName} is now ${ROLE_ARTICLES[updated.role]}.`)
      setPending(null)
      // If you demoted yourself, this reload returns 403 and ends the session.
      reload()
    } catch (err) {
      // 409 when demoting the last Admin.
      setChangeError(err.message)
    } finally {
      setBusy(false)
    }
  }

  let content
  if (loading) content = <LoadingState label="Loading users…" />
  else if (error && !users) content = <ErrorState error={error} onRetry={reload} />
  else if (users.length === 0) content = <EmptyState title="No users yet" />
  else
    content = (
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Role</th>
              <th scope="col">Joined</th>
              <th scope="col" className="table__actions-head">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user.id === currentUser.id
              return (
                <tr key={user.id}>
                  <td>
                    <div className="cell-primary">
                      {user.fullName}
                      {isSelf && <span className="you-tag">You</span>}
                    </div>
                  </td>
                  <td className="cell-break">{user.email}</td>
                  <td>
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="cell-nowrap">{formatDate(user.createdAt)}</td>
                  <td>
                    <div className="row-actions">
                      <select
                        className="input input--sm"
                        value={user.role}
                        onChange={(e) => requestChange(user, e.target.value)}
                        aria-label={`Role for ${user.fullName}`}
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )

  const isSelfDemotion = pending && pending.user.id === currentUser.id && pending.role !== 'admin'
  const losesAdmin = pending && pending.user.role === 'admin' && pending.role !== 'admin'
  // Mirrors the backend: a Student leaving the Student role has their active
  // Eduyarp enrolments cancelled (not restored if they become a Student again).
  const cancelsEnrolments = pending && pending.user.role === 'student' && pending.role !== 'student'

  return (
    <>
      <PageHeader
        title="Users"
        description="New registrations are Students. Only Admins can change roles."
      />
      {error && users && <Alert>Could not refresh the list: {error.message}</Alert>}
      <div className="card card--flush">{content}</div>

      {pending && (
        <ConfirmDialog
          title={
            pending.role === 'admin'
              ? 'Grant Admin access?'
              : losesAdmin
                ? 'Remove Admin access?'
                : `Make ${pending.user.fullName} ${ROLE_ARTICLES[pending.role]}?`
          }
          confirmLabel={`Make ${ROLE_LABELS[pending.role].toLowerCase()}`}
          tone={losesAdmin ? 'danger' : 'primary'}
          busy={busy}
          error={changeError}
          onConfirm={confirmChange}
          onClose={() => setPending(null)}
        >
          {pending.role === 'admin' && (
            <p>
              <strong>{pending.user.fullName}</strong> will be able to manage platforms, services,
              users, Fitness leads and Eduyarp.
            </p>
          )}
          {pending.role === 'trainer' && (
            <p>
              <strong>{pending.user.fullName}</strong> will become a Trainer and can then be
              assigned to Eduyarp courses. Trainers only have access to the courses they are
              assigned to{losesAdmin ? ' and lose access to this console' : ''}.
            </p>
          )}
          {pending.role === 'student' && (
            <p>
              <strong>{pending.user.fullName}</strong> will become a Student
              {losesAdmin ? ' and lose access to this console' : ''}
              {pending.user.role === 'trainer' ? ' and lose access to assigned courses' : ''}.
            </p>
          )}
          {cancelsEnrolments && (
            <Alert tone="warning">
              Any active Eduyarp enrolments of this user will be cancelled. Their progress is kept,
              but enrolments are not restored if they become a Student again.
            </Alert>
          )}
          {isSelfDemotion && (
            <Alert tone="warning">
              This is your own account. You will be signed out immediately.
            </Alert>
          )}
        </ConfirmDialog>
      )}
    </>
  )
}
