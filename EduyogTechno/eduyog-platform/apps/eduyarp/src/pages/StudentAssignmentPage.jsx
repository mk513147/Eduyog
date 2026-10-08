import { useCallback, useState } from 'react'
import { studentApi } from '../api/endpoints'
import { AssignmentStatusBadge } from '../components/Badges'
import { TextAreaField, TextField } from '../components/Fields'
import { Icon } from '../components/Icon'
import { Alert, ErrorState, LoadingState, Spinner } from '../components/States'
import { usePageTitle } from '../hooks/usePageTitle'
import { useResource } from '../hooks/useResource'
import { Link } from '../router/Link'
import { splitApiError } from '../utils/errors'
import { formatDateTime } from '../utils/format'
import { checkImageUrl } from '../utils/imageUrl'
import NotFoundPage from './NotFoundPage'

const TEXT_MAX = 5000

function SubmissionForm({ assignmentId, hasPrevious, onSubmitted }) {
  const [form, setForm] = useState({ text: '', url: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    setFormError(null)
    const problems = {}
    if (form.text.trim() === '' && form.url.trim() === '') problems.text = 'Write an answer or add a link'
    const urlProblem = checkImageUrl(form.url)
    if (urlProblem) problems.url = urlProblem
    setErrors(problems)
    if (Object.keys(problems).length > 0) return
    setBusy(true)
    try {
      const saved = await studentApi.submit(assignmentId, form)
      setForm({ text: '', url: '' })
      onSubmitted(saved)
    } catch (err) {
      const split = splitApiError(err, ['text', 'url'])
      setErrors(split.fieldErrors)
      setFormError(split.formError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="asg-form" onSubmit={submit} noValidate aria-label="Submit your work">
      <h2 className="card__title">
        <Icon name="edit" /> {hasPrevious ? 'Submit again' : 'Your submission'}
      </h2>
      {hasPrevious && <p className="muted small">A new submission becomes your current one. Earlier ones are kept below.</p>}
      {formError && <Alert>{formError}</Alert>}
      <TextAreaField
        label="Your answer"
        value={form.text}
        onChange={update('text')}
        error={errors.text}
        maxLength={TEXT_MAX}
        rows={6}
        hint={`Plain text. ${form.text.length}/${TEXT_MAX} characters.`}
      />
      <TextField
        label="Link (optional)"
        type="url"
        value={form.url}
        onChange={update('url')}
        error={errors.url}
        hint="A link to your work starting with http:// or https://. Files are not uploaded here."
        maxLength={2048}
        autoComplete="off"
      />
      <div className="form__actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy && <Spinner size="sm" />}
          {hasPrevious ? 'Submit again' : 'Submit'}
        </button>
      </div>
    </form>
  )
}

export function SubmissionView({ submission, latest }) {
  return (
    <li className={`sub${latest ? ' sub--latest' : ''}`}>
      <div className="sub__head">
        <strong>{latest ? 'Latest submission' : 'Earlier submission'}</strong>
        <time dateTime={submission.submittedAt}>{formatDateTime(submission.submittedAt)}</time>
        {submission.isLate && <span className="badge badge--danger">Late</span>}
        {submission.feedback && <span className="badge badge--success">Feedback received</span>}
      </div>
      {submission.text && <p className="sub__text">{submission.text}</p>}
      {submission.url && (
        <p className="sub__link">
          <a href={submission.url} target="_blank" rel="noopener noreferrer">
            {submission.url}
            <span className="visually-hidden"> (opens in a new tab)</span>
          </a>
        </p>
      )}
      {submission.feedback && (
        <div className="sub__feedback">
          <p className="sub__feedback-title">
            Feedback from {submission.feedback.authorName} · {formatDateTime(submission.feedback.updatedAt)}
          </p>
          <p className="sub__text">{submission.feedback.text}</p>
        </div>
      )}
    </li>
  )
}

export default function StudentAssignmentPage({ params }) {
  const loader = useCallback(() => studentApi.assignment(params.assignmentId), [params.assignmentId])
  const { data: a, error, loading, reload, setData } = useResource(loader)
  usePageTitle(a?.title ?? 'Assignment')
  const [notice, setNotice] = useState(null)

  if (loading) return <LoadingState label="Loading assignment…" />
  if (error?.status === 404 || error?.status === 400) return <NotFoundPage message="This assignment is not available to you." />
  if (error && !a) return <ErrorState error={error} onRetry={reload} />

  const latest = a.submissions[0]
  const onSubmitted = (saved) => {
    setData((prev) => ({ ...prev, submissions: [saved, ...prev.submissions] }))
    setNotice(saved.isLate ? 'Submitted. It was after the due date, so it is marked late.' : 'Submitted. Your trainer has been notified.')
  }

  return (
    <div className="container page">
      <Link to={`/my-courses/${params.courseId}`} className="back-link back-link--dark">
        <Icon name="arrowLeft" size={16} /> Back to course
      </Link>

      <header className="t-head card">
        <div className="my-course__badges">
          <AssignmentStatusBadge status={a.status} />
          {latest ? (
            <span className={`badge ${latest.isLate ? 'badge--danger' : 'badge--primary'}`}>{latest.isLate ? 'Submitted late' : 'Submitted'}</span>
          ) : (
            <span className="badge badge--muted">Not submitted</span>
          )}
          {a.submissions.some((s) => s.feedback) && <span className="badge badge--success">Feedback received</span>}
        </div>
        <h1 className="page__title">{a.title}</h1>
        <p className="meta">
          <Icon name="calendar" size={16} />
          {a.dueAt ? `Due ${formatDateTime(a.dueAt)}` : 'No due date'}
          {a.topicTitle ? ` · Topic: ${a.topicTitle}` : a.moduleTitle ? ` · ${a.moduleTitle}` : ''}
        </p>
        <p className="asg-instructions">{a.instructions}</p>
      </header>

      {notice && <Alert tone="success">{notice}</Alert>}

      {a.canSubmit ? (
        <section className="card">
          <SubmissionForm assignmentId={a.id} hasPrevious={a.submissions.length > 0} onSubmitted={onSubmitted} />
        </section>
      ) : (
        <Alert tone="info">This assignment is closed and no longer accepts submissions.{a.submissions.length > 0 ? ' Your earlier submissions are shown below.' : ''}</Alert>
      )}

      {a.submissions.length > 0 && (
        <section className="card" aria-labelledby="asg-history">
          <h2 id="asg-history" className="card__title">
            <Icon name="layers" /> Your submissions
          </h2>
          <ul className="sub-list">
            {a.submissions.map((s, index) => (
              <SubmissionView key={s.id} submission={s} latest={index === 0} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
