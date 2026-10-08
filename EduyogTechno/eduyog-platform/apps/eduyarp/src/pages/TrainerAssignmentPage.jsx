import { useCallback, useState } from 'react'
import { trainerApi } from '../api/endpoints'
import { AssignmentStatusBadge } from '../components/Badges'
import { TextAreaField } from '../components/Fields'
import { Icon } from '../components/Icon'
import { Alert, EmptyState, ErrorState, LoadingState, Spinner } from '../components/States'
import { usePageTitle } from '../hooks/usePageTitle'
import { useResource } from '../hooks/useResource'
import { Link } from '../router/Link'
import { useRouter } from '../router/useRouter'
import { splitApiError } from '../utils/errors'
import { formatDateTime } from '../utils/format'
import NotFoundPage from './NotFoundPage'
import { SubmissionView } from './StudentAssignmentPage'

function FeedbackForm({ submission, onSaved }) {
  const [text, setText] = useState(submission.feedback?.text ?? '')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const save = async (event) => {
    event.preventDefault()
    if (busy) return
    if (text.trim() === '') {
      setError('Write some feedback first')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const saved = await trainerApi.setFeedback(submission.id, text)
      onSaved(saved, Boolean(submission.feedback))
    } catch (err) {
      setError(splitApiError(err, ['feedback']).fieldErrors.feedback || err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="asg-form" onSubmit={save} noValidate aria-label="Feedback">
      <TextAreaField
        label={submission.feedback ? 'Edit feedback' : 'Feedback for the student'}
        value={text}
        onChange={(event) => { setText(event.target.value); setError(null) }}
        error={error}
        maxLength={3000}
        rows={4}
        hint={`Written feedback only; there are no grades. ${text.length}/3000 characters.`}
      />
      <div className="form__actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy && <Spinner size="sm" />}
          {submission.feedback ? 'Update feedback' : 'Save feedback'}
        </button>
      </div>
    </form>
  )
}

function SubmissionDetail({ submissionId, onChanged }) {
  const loader = useCallback(() => trainerApi.submission(submissionId), [submissionId])
  const { data, error, loading, reload } = useResource(loader)
  const [notice, setNotice] = useState(null)

  if (loading) return <LoadingState label="Loading submission…" />
  if (error && !data) return <ErrorState error={error} onRetry={reload} />
  const { student, submission, history } = data
  return (
    <div className="sub-detail">
      <h3 className="sub-detail__title">
        {student.name} <span className="muted small break">{student.email}</span>
      </h3>
      <ul className="sub-list">
        <SubmissionView submission={submission} latest={history[0].id === submission.id} />
      </ul>
      {notice && <Alert tone="success">{notice}</Alert>}
      <FeedbackForm
        key={`${submission.id}-${submission.feedback?.updatedAt ?? 'none'}`}
        submission={submission}
        onSaved={(saved, wasUpdate) => {
          setNotice(wasUpdate ? 'Feedback updated.' : 'Feedback saved.')
          reload()
          onChanged()
        }}
      />
      {history.length > 1 && (
        <details className="sub-history">
          <summary>All submissions by {student.name} ({history.length})</summary>
          <ul className="sub-list">
            {history.map((s, index) => (
              <SubmissionView key={s.id} submission={s} latest={index === 0} />
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

export default function TrainerAssignmentPage({ params }) {
  const { query, navigate } = useRouter()
  const loader = useCallback(() => trainerApi.submissions(params.assignmentId), [params.assignmentId])
  const { data, error, loading, reload } = useResource(loader)
  usePageTitle(data?.assignment.title ?? 'Assignment')
  const selected = query.get('submission')
  const rows = data?.submissions

  // The open submission lives in the URL (?submission=ID), so notification links open it directly.
  const openId = selected

  if (loading) return <LoadingState label="Loading submissions…" />
  if (error?.status === 404 || error?.status === 400 || error?.status === 403)
    return <NotFoundPage message="You are not assigned to this course." />
  if (error && !data) return <ErrorState error={error} onRetry={reload} />

  const a = data.assignment
  const open = (id) => navigate(`/trainer/courses/${a.courseId}/assignments/${a.id}?submission=${id}`)

  return (
    <div className="container page">
      <Link to={`/trainer/courses/${a.courseId}`} className="back-link back-link--dark">
        <Icon name="arrowLeft" size={16} /> Back to course
      </Link>
      <header className="t-head card">
        <div className="my-course__badges">
          <AssignmentStatusBadge status={a.status} />
        </div>
        <h1 className="page__title">{a.title}</h1>
        <p className="meta">
          <Icon name="calendar" size={16} />
          {a.dueAt ? `Due ${formatDateTime(a.dueAt)}` : 'No due date'}
          {a.topicTitle ? ` · Topic: ${a.topicTitle}` : a.moduleTitle ? ` · ${a.moduleTitle}` : ''}
        </p>
        <p className="asg-instructions">{a.instructions}</p>
      </header>

      <div className="t-grid">
        <section className="card" aria-labelledby="subs-title">
          <h2 id="subs-title" className="card__title">
            <Icon name="users" /> Submissions
          </h2>
          {rows.length === 0 ? (
            <EmptyState title="No submissions yet" description="Students' submissions appear here, newest first." />
          ) : (
            <ul className="asg-list">
              {rows.map((s) => (
                <li key={s.id} className={`asg${String(openId) === String(s.id) ? ' asg--active' : ''}`}>
                  <div className="asg__main">
                    <div className="asg__top">
                      <button type="button" className="asg__title asg__title--button" onClick={() => open(s.id)}>
                        {s.studentName}
                      </button>
                      {s.isLate && <span className="badge badge--danger">Late</span>}
                      {s.hasFeedback ? <span className="badge badge--success">Feedback given</span> : <span className="badge badge--muted">No feedback yet</span>}
                    </div>
                    <p className="asg__meta break">
                      {s.studentEmail} · {formatDateTime(s.submittedAt)}
                      {s.attempts > 1 ? ` · ${s.attempts} submissions` : ''}
                    </p>
                    {s.preview && <p className="asg__preview">{s.preview}</p>}
                  </div>
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => open(s.id)}>
                    Open<span className="visually-hidden"> submission by {s.studentName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="sub-detail-title">
          <h2 id="sub-detail-title" className="card__title">
            <Icon name="file" /> Submission
          </h2>
          {openId ? (
            <SubmissionDetail key={openId} submissionId={openId} onChanged={reload} />
          ) : (
            <p className="muted">Choose a submission to read it and give feedback.</p>
          )}
        </section>
      </div>
    </div>
  )
}
