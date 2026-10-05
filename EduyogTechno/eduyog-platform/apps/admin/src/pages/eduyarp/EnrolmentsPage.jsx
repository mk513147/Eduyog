import { useState } from 'react'
import { eduyarpApi } from '../../api/endpoints'
import { EnrolmentStatusBadge } from '../../components/Badge'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { PageHeader } from '../../components/PageHeader'
import { Alert, EmptyState, ErrorState, LoadingState } from '../../components/States'
import { useResource } from '../../hooks/useResource'
import { Link } from '../../router/Link'
import { useToast } from '../../toast/useToast'
import { EMPTY_FILTERS, courseOptions, filterEnrolments, hasActiveFilters } from '../../utils/enrolmentFilters'
import { formatDateTime } from '../../utils/format'

const STATUS_OPTIONS = [
  ['active', 'Active'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
]

export default function EnrolmentsPage() {
  const { data: enrolments, error, loading, reload } = useResource(eduyarpApi.enrolments.list)
  const toast = useToast()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const setFilter = (field, value) => setFilters((prev) => ({ ...prev, [field]: value }))
  // The enrolment being confirmed for cancellation.
  const [cancelling, setCancelling] = useState(null)
  const [busy, setBusy] = useState(false)
  const [cancelError, setCancelError] = useState(null)

  const confirmCancel = async () => {
    setBusy(true)
    setCancelError(null)
    try {
      await eduyarpApi.enrolments.cancel(cancelling.id)
      toast.success(`Cancelled ${cancelling.student.fullName}'s enrolment in ${cancelling.course.title}.`)
      setCancelling(null)
      reload()
    } catch (err) {
      // 409 if it is no longer active (changed elsewhere); refresh to show the truth.
      setCancelError(err.message)
      if (err.status === 409 || err.status === 404) reload()
    } finally {
      setBusy(false)
    }
  }

  const visible = enrolments ? filterEnrolments(enrolments, filters) : []

  let content
  if (loading) content = <LoadingState label="Loading enrolments…" />
  else if (error && !enrolments) content = <ErrorState error={error} onRetry={reload} />
  else if (enrolments.length === 0)
    content = (
      <EmptyState
        title="No enrolments yet"
        description="Students who enrol in a published course on Eduyarp will appear here."
      />
    )
  else if (visible.length === 0)
    content = (
      <EmptyState
        title="No enrolments match the current filters."
        action={
          <button type="button" className="btn btn--secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
            Clear filters
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
              <th scope="col">Student</th>
              <th scope="col">Email</th>
              <th scope="col">Course</th>
              <th scope="col">Enrolled</th>
              <th scope="col">Status</th>
              <th scope="col">Progress</th>
              <th scope="col" className="table__actions-head">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((enrolment) => (
              <tr key={enrolment.id}>
                <td className="cell-primary">{enrolment.student.fullName}</td>
                <td className="cell-break">{enrolment.student.email}</td>
                <td>
                  <Link to={`/eduyarp/courses/${enrolment.course.id}`}>{enrolment.course.title}</Link>
                </td>
                <td className="cell-nowrap">{formatDateTime(enrolment.enrolledAt)}</td>
                <td>
                  <EnrolmentStatusBadge status={enrolment.status} />
                </td>
                <td>
                  <div className="mini-progress" title={`${enrolment.progress.completedTopics} of ${enrolment.progress.totalTopics} topics`}>
                    <div className="mini-progress__track" aria-hidden="true">
                      <div className="mini-progress__fill" style={{ width: `${enrolment.progress.percent}%` }} />
                    </div>
                    <span>{enrolment.progress.percent}%</span>
                  </div>
                </td>
                <td>
                  <div className="row-actions">
                    {enrolment.status === 'active' ? (
                      <button
                        type="button"
                        className="btn btn--danger-ghost btn--sm"
                        onClick={() => {
                          setCancelError(null)
                          setCancelling(enrolment)
                        }}
                      >
                        Cancel
                        <span className="visually-hidden">
                          {' '}enrolment of {enrolment.student.fullName} in {enrolment.course.title}
                        </span>
                      </button>
                    ) : (
                      <span className="muted" aria-label="No actions available">—</span>
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
        title="Eduyarp Enrolments"
        description="All student enrolments, newest first. Cancelled enrolments are kept as history."
      />
      {error && enrolments && <Alert>Could not refresh the list: {error.message}</Alert>}
      {enrolments && enrolments.length > 0 && (
        <div className="filters">
          <input
            type="search"
            className="input filters__search"
            placeholder="Search student or course..."
            aria-label="Search student or course"
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
          />
          <select
            className="input"
            aria-label="Filter by status"
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value)}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="input"
            aria-label="Filter by course"
            value={filters.courseId}
            onChange={(e) => setFilter('courseId', e.target.value)}
          >
            <option value="">All courses</option>
            {courseOptions(enrolments).map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => setFilters(EMPTY_FILTERS)}
            disabled={!hasActiveFilters(filters)}
          >
            Clear filters
          </button>
        </div>
      )}
      <div className="card card--flush">{content}</div>

      {cancelling && (
        <ConfirmDialog
          title="Cancel enrolment?"
          confirmLabel="Cancel enrolment"
          cancelLabel="Keep enrolment"
          tone="danger"
          busy={busy}
          error={cancelError}
          onConfirm={confirmCancel}
          onClose={() => setCancelling(null)}
        >
          <p>
            <strong>Student:</strong> {cancelling.student.fullName}
            <br />
            <strong>Course:</strong> {cancelling.course.title}
          </p>
          <p>
            This will remove the student&apos;s access to the course. Their progress will be kept as
            historical data.
          </p>
        </ConfirmDialog>
      )}
    </>
  )
}
