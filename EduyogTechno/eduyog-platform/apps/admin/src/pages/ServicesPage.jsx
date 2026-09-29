import { useState } from 'react'
import { platformsApi, servicesApi } from '../api/endpoints'
import { StatusBadge } from '../components/Badge'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/PageHeader'
import { Alert, EmptyState, ErrorState, LoadingState } from '../components/States'
import { useResource } from '../hooks/useResource'
import { useToast } from '../toast/useToast'
import { formatDate } from '../utils/format'
import { ServiceFormModal } from './ServiceFormModal'

export default function ServicesPage() {
  const { data: services, error, loading, reload } = useResource(servicesApi.list)
  const platforms = useResource(platformsApi.list)
  const toast = useToast()
  const [formState, setFormState] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [togglingId, setTogglingId] = useState(null)

  const openCreate = () => setFormState({ service: null })

  const handleSaved = (service, isEdit) => {
    setFormState(null)
    toast.success(isEdit ? `Saved ${service.name}.` : `Added ${service.name}.`)
    reload()
  }

  const toggleActive = async (service) => {
    setTogglingId(service.id)
    try {
      const updated = await servicesApi.update(service.id, { isActive: !service.isActive })
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
      await servicesApi.remove(deleting.id)
      toast.success(`Deleted ${deleting.name}.`)
      setDeleting(null)
      reload()
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleteBusy(false)
    }
  }

  let content
  if (loading) content = <LoadingState label="Loading services…" />
  else if (error && !services) content = <ErrorState error={error} onRetry={reload} />
  else if (services.length === 0)
    content = (
      <EmptyState
        title="No services yet"
        description="Services can stand alone or belong to a platform."
        action={
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            <Icon name="plus" /> Add service
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
              <th scope="col">Service</th>
              <th scope="col">Platform</th>
              <th scope="col">Status</th>
              <th scope="col">Updated</th>
              <th scope="col" className="table__actions-head">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id}>
                <td>
                  <div className="cell-primary">{service.name}</div>
                  {service.description && (
                    <div className="cell-secondary line-clamp">{service.description}</div>
                  )}
                </td>
                <td>{service.platformName ?? <span className="muted">No platform</span>}</td>
                <td>
                  <StatusBadge active={service.isActive} />
                </td>
                <td className="cell-nowrap">{formatDate(service.updatedAt)}</td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => setFormState({ service })}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => toggleActive(service)}
                      disabled={togglingId === service.id}
                    >
                      {service.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger-ghost btn--sm"
                      onClick={() => {
                        setDeleteError(null)
                        setDeleting(service)
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
        title="Services"
        description="Services offered by Eduyog, optionally linked to a platform."
        actions={
          services?.length > 0 && (
            <button type="button" className="btn btn--primary" onClick={openCreate}>
              <Icon name="plus" /> Add service
            </button>
          )
        }
      />
      {error && services && <Alert>Could not refresh the list: {error.message}</Alert>}
      <div className="card card--flush">{content}</div>

      {formState && (
        <ServiceFormModal
          service={formState.service}
          platforms={platforms.data}
          platformsError={platforms.error}
          onClose={() => setFormState(null)}
          onSaved={handleSaved}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete service?"
          confirmLabel="Delete service"
          tone="danger"
          busy={deleteBusy}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        >
          <p>
            <strong>{deleting.name}</strong> will be permanently deleted. This cannot be undone.
          </p>
        </ConfirmDialog>
      )}
    </>
  )
}
