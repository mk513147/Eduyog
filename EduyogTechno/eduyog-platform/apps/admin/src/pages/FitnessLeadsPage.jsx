import { useCallback, useState } from 'react'
import { leadsApi } from '../api/endpoints'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { Alert, EmptyState, ErrorState, LoadingState } from '../components/States'
import { useResource } from '../hooks/useResource'
import { formatDateTime } from '../utils/format'

// Detail fields in display order. `long` fields span the full width and keep
// line breaks. Leads created before these fields existed may have them empty.
const DETAIL_FIELDS = [
  { key: 'businessName', label: 'Business Name' },
  { key: 'contactName', label: 'Contact Person' },
  { key: 'email', label: 'Email', className: 'cell-break' },
  { key: 'phone', label: 'Phone' },
  { key: 'businessType', label: 'Business Type' },
  { key: 'location', label: 'Location' },
  { key: 'servicesOffered', label: 'Services Offered', long: true },
  { key: 'marketingRequirements', label: 'Current Marketing Requirements', long: true },
  { key: 'websiteLinks', label: 'Website / Social Media Links', long: true },
  { key: 'marketingObjectives', label: 'Marketing Objectives', long: true },
  { key: 'message', label: 'Additional Requirements', long: true },
]

function LeadDetailModal({ leadId, onClose }) {
  const loader = useCallback(() => leadsApi.get(leadId), [leadId])
  const { data: lead, error, loading, reload } = useResource(loader)

  let body
  if (loading) body = <LoadingState label="Loading enquiry…" />
  else if (error) body = <ErrorState error={error} onRetry={reload} />
  else
    body = (
      <dl className="details">
        {DETAIL_FIELDS.map(({ key, label, long, className }) => (
          <div key={key} className={long ? 'details__full' : undefined}>
            <dt>{label}</dt>
            <dd className={long ? 'details__message' : className}>
              {lead[key] || <span className="muted">Not provided</span>}
            </dd>
          </div>
        ))}
        <div>
          <dt>Received</dt>
          <dd>{formatDateTime(lead.createdAt)}</dd>
        </div>
      </dl>
    )

  return (
    <Modal title="Fitness enquiry" onClose={onClose}>
      {body}
    </Modal>
  )
}

export default function FitnessLeadsPage() {
  const { data: leads, error, loading, reload } = useResource(leadsApi.list, { refetchOnFocus: true })
  const [selectedId, setSelectedId] = useState(null)

  let content
  if (loading) content = <LoadingState label="Loading Fitness leads…" />
  else if (error && !leads) content = <ErrorState error={error} onRetry={reload} />
  else if (leads.length === 0)
    content = (
      <EmptyState
        title="No enquiries yet"
        description="Business enquiries submitted on the Fitness site will appear here."
      />
    )
  else
    content = (
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Business</th>
              <th scope="col">Contact</th>
              <th scope="col">Phone</th>
              <th scope="col">Received</th>
              <th scope="col" className="table__actions-head">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td>
                  <div className="cell-primary">{lead.businessName}</div>
                </td>
                <td>
                  <div>{lead.contactName}</div>
                  <div className="cell-secondary cell-break">{lead.email}</div>
                </td>
                <td className="cell-nowrap">{lead.phone || <span className="muted">—</span>}</td>
                <td className="cell-nowrap">{formatDateTime(lead.createdAt)}</td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => setSelectedId(lead.id)}
                    >
                      View
                      <span className="visually-hidden"> enquiry from {lead.businessName}</span>
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
        title="Fitness Leads"
        description="Business enquiries from the Fitness site, newest first."
      />
      {error && leads && <Alert>Could not refresh the list: {error.message}</Alert>}
      <div className="card card--flush">{content}</div>

      {selectedId && <LeadDetailModal leadId={selectedId} onClose={() => setSelectedId(null)} />}
    </>
  )
}
