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

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const { data: users, error, loading, reload } = useResource(usersApi.list)
  const toast = useToast()
  // { user, role } while confirming a role change.
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [changeError, setChangeError] = useState(null)

  const requestChange = (user) => {
    setChangeError(null)
    setPending({ user, role: user.role === 'admin' ? 'student' : 'admin' })
  }

  const confirmChange = async () => {
    setBusy(true)
    setChangeError(null)
    try {
      const updated = await usersApi.changeRole(pending.user.id, pending.role)
      toast.success(`${updated.fullName} is now ${updated.role === 'admin' ? 'an Admin' : 'a Student'}.`)
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
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => requestChange(user)}
                      >
                        {user.role === 'admin' ? 'Make student' : 'Make admin'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )

  const isSelfDemotion = pending && pending.user.id === currentUser.id && pending.role === 'student'

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
          title={pending.role === 'admin' ? 'Grant Admin access?' : 'Remove Admin access?'}
          confirmLabel={pending.role === 'admin' ? 'Make admin' : 'Make student'}
          tone={pending.role === 'admin' ? 'primary' : 'danger'}
          busy={busy}
          error={changeError}
          onConfirm={confirmChange}
          onClose={() => setPending(null)}
        >
          {pending.role === 'admin' ? (
            <p>
              <strong>{pending.user.fullName}</strong> will be able to manage platforms, services,
              users and Fitness leads.
            </p>
          ) : (
            <p>
              <strong>{pending.user.fullName}</strong> will become a Student and lose access to
              this console.
            </p>
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
