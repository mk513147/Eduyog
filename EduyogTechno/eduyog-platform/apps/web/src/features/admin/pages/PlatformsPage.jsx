import { useState } from 'react'
import { platformsApi } from '../api/endpoints'
import { StatusBadge } from '../components/Badge'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/PageHeader'
import { Alert, EmptyState, ErrorState, LoadingState } from '../components/States'
import { useResource } from '../hooks/useResource'
import { useToast } from '../toast/useToast'
import { formatDate } from '../utils/format'
import { PlatformFormModal } from './PlatformFormModal'

export default function PlatformsPage() {
  const { data: platforms, error, loading, reload } = useResource(platformsApi.list)
  const toast = useToast()
  // null = closed, { platform: null } = create, { platform } = edit
  const [formState, setFormState] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [togglingId, setTogglingId] = useState(null)

  const openCreate = () => setFormState({ platform: null })

  const handleSaved = (platform, isEdit) => {
    setFormState(null)
    toast.success(isEdit ? `Saved ${platform.name}.` : `Added ${platform.name}.`)
    reload()
  }

  const toggleActive = async (platform) => {
    setTogglingId(platform.id)
    try {
      const updated = await platformsApi.update(platform.id, { isActive: !platform.isActive })
      toast.success(`${updated.name} is now ${updated.isActive ? 'active' : 'inactive'}.`)
      reload()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setTogglingId(null)
    }
  }

  const confirmDelete = async () => {
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      await platformsApi.remove(deleting.id)
      toast.success(`Deleted ${deleting.name}.`)
      setDeleting(null)
      reload()
    } catch (err) {
      // 409 when the platform still has services.
      setDeleteError(err.message)
    } finally {
      setDeleteBusy(false)
    }
  }

  let content
  if (loading) content = <LoadingState label="Loading platforms…" />
  else if (error && !platforms) content = <ErrorState error={error} onRetry={reload} />
  else if (platforms.length === 0)
    content = (
      <EmptyState
        title="No platforms yet"
        description="Add an external website link to get started."
        action={
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            <Icon name="plus" /> Add platform
          </button>
        }
      />
    )
  else
    content = (
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Website</th>
              <th scope="col">Status</th>
              <th scope="col">Updated</th>
              <th scope="col" className="table__actions-head">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {platforms.map((platform) => (
              <tr key={platform.id}>
                <td>
                  <div className="cell-primary">{platform.name}</div>
                  <div className="cell-secondary">{platform.slug}</div>
                </td>
                <td>
                  <a
                    href={platform.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="external-link"
                  >
                    <span className="truncate">{platform.url}</span>
                    <Icon name="external" size={14} />
                    <span className="visually-hidden">(opens in a new tab)</span>
                  </a>
                </td>
                <td>
                  <StatusBadge active={platform.isActive} />
                </td>
                <td className="cell-nowrap">{formatDate(platform.updatedAt)}</td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => setFormState({ platform })}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => toggleActive(platform)}
                      disabled={togglingId === platform.id}
                    >
                      {platform.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger-ghost btn--sm"
                      onClick={() => {
                        setDeleteError(null)
                        setDeleting(platform)
                      }}
                    >
                      Delete
                    </button>
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
        title="Platforms"
        description="External websites managed by Eduyog. Phase 1 supports website links only."
        actions={
          platforms?.length > 0 && (
            <button type="button" className="btn btn--primary" onClick={openCreate}>
              <Icon name="plus" /> Add platform
            </button>
          )
        }
      />
      {error && platforms && <Alert>Could not refresh the list: {error.message}</Alert>}
      <div className="card card--flush">{content}</div>

      {formState && (
        <PlatformFormModal
          platform={formState.platform}
          onClose={() => setFormState(null)}
          onSaved={handleSaved}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete platform?"
          confirmLabel="Delete platform"
          tone="danger"
          busy={deleteBusy}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        >
          <p>
            <strong>{deleting.name}</strong> will be permanently deleted. This cannot be undone.
          </p>
          <p className="muted">
            Platforms that still have services cannot be deleted. Deactivate them instead.
          </p>
        </ConfirmDialog>
      )}
    </>
  )
}
