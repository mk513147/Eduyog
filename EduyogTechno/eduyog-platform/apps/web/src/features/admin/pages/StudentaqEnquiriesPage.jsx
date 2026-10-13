import { useState } from 'react'
import { studentaqEnquiriesApi } from '../api/endpoints'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { Alert, EmptyState, ErrorState, LoadingState } from '../components/States'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { useResource } from '../hooks/useResource'
import { formatDateTime } from '../utils/format'

// Detail fields in display order: the fields of the StudentAQ enquiry form that are stored.
// `long` fields span the full width and keep line breaks. Optional ones may be empty.
const DETAIL_FIELDS = [
  { key: 'fullName', label: 'Full Name' },
  { key: 'email', label: 'Email', className: 'cell-break' },
  { key: 'phone', label: 'WhatsApp Number' },
  { key: 'currentCountry', label: 'Based In' },
  { key: 'status', label: 'Current Status' },
  { key: 'targetCountry', label: 'Wants to Work In' },
  { key: 'university', label: 'University / College' },
  { key: 'course', label: 'Course / Field of Study' },
  { key: 'services', label: 'Help Needed With', long: true, format: (value) => value.join(', ') },
  { key: 'message', label: 'Additional Information', long: true },
]

function EnquiryDetailModal({ enquiry, onClose }) {
  return (
    <Modal title="StudentAQ enquiry" onClose={onClose}>
      <dl className="details">
        {DETAIL_FIELDS.map(({ key, label, long, className, format }) => {
          const value = enquiry[key]
          const text = format && value ? format(value) : value
          return (
            <div key={key} className={long ? 'details__full' : undefined}>
              <dt>{label}</dt>
              <dd className={long ? 'details__message' : className}>
                {text || <span className="muted">Not provided</span>}
              </dd>
            </div>
          )
        })}
        <div>
          <dt>Received</dt>
          <dd>{formatDateTime(enquiry.createdAt)}</dd>
        </div>
      </dl>
    </Modal>
  )
}

export default function StudentaqEnquiriesPage() {
  const { data, error, loading, reload } = useResource(studentaqEnquiriesApi.list)
  useAutoRefresh(reload, { enabled: Boolean(data) })
  const [selected, setSelected] = useState(null)
  const enquiries = data?.enquiries

  let content
  if (loading) content = <LoadingState label="Loading StudentAQ enquiries…" />
  else if (error && !data) content = <ErrorState error={error} onRetry={reload} />
  else if (enquiries.length === 0)
    content = (
      <EmptyState
        title="No enquiries yet"
        description="Enquiries submitted on the StudentAQ site will appear here."
      />
    )
  else
    content = (
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Phone</th>
              <th scope="col">Wants to work in</th>
              <th scope="col">Help needed</th>
              <th scope="col">Received</th>
              <th scope="col" className="table__actions-head">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {enquiries.map((enquiry) => (
              <tr key={enquiry.id}>
                <td>
                  <div className="cell-primary">{enquiry.fullName}</div>
                  <div className="cell-secondary cell-break">{enquiry.email}</div>
                </td>
                <td className="cell-nowrap">{enquiry.phone}</td>
                <td>{enquiry.targetCountry}</td>
                <td className="cell-break">{enquiry.services.join(', ')}</td>
                <td className="cell-nowrap">{formatDateTime(enquiry.createdAt)}</td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => setSelected(enquiry)}>
                      View
                      <span className="visually-hidden"> enquiry from {enquiry.fullName}</span>
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
      <PageHeader title="StudentAQ Enquiries" description="Enquiries from the StudentAQ site, newest first." />
      {error && data && <Alert>Could not refresh the list: {error.message}</Alert>}
      <div className="card card--flush">{content}</div>
      {data && data.total > enquiries.length && (
        <p className="muted">Showing the newest {enquiries.length} of {data.total} enquiries.</p>
      )}

      {selected && <EnquiryDetailModal enquiry={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
