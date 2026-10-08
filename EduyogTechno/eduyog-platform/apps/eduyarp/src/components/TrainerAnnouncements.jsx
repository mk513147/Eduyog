import { useCallback, useState } from 'react'
import { trainerApi } from '../api/endpoints'
import { useResource } from '../hooks/useResource'
import { splitApiError } from '../utils/errors'
import { formatDateTime } from '../utils/format'
import { TextAreaField, TextField } from './Fields'
import { Icon } from './Icon'
import { Alert, ErrorState, LoadingState, Spinner } from './States'

const TITLE_MAX = 200
const BODY_MAX = 3000

// Announcements for one assigned course: post a new one, read the list, delete your own.
// Text is shown exactly as typed (plain text, line breaks kept).
export function TrainerAnnouncements({ courseId }) {
  const loader = useCallback(() => trainerApi.announcements(courseId), [courseId])
  const { data, error, loading, reload, setData } = useResource(loader)
  const [form, setForm] = useState({ title: '', body: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
    setNotice(null)
  }

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    setFormError(null)
    setNotice(null)
    const problems = {}
    if (form.title.trim() === '') problems.title = 'Title is required'
    if (form.body.trim() === '') problems.body = 'Message is required'
    setErrors(problems)
    if (Object.keys(problems).length > 0) return
    setBusy(true)
    try {
      const created = await trainerApi.createAnnouncement(courseId, form)
      setData((prev) => [created, ...(prev ?? [])])
      setForm({ title: '', body: '' })
      setNotice(
        created.notifiedCount === 1 ? 'Posted. 1 person was notified.' : `Posted. ${created.notifiedCount} people were notified.`,
      )
    } catch (err) {
      const split = splitApiError(err, ['title', 'body'])
      setErrors(split.fieldErrors)
      setFormError(split.formError)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (announcement) => {
    if (deleting) return
    if (!window.confirm('Delete this announcement? Students keep any notification they already received.')) return
    setDeleting(announcement.id)
    setFormError(null)
    try {
      await trainerApi.deleteAnnouncement(announcement.id)
      setData((prev) => prev.filter((a) => a.id !== announcement.id))
    } catch (err) {
      setFormError(err.message)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <section className="card t-grid__wide" aria-labelledby="t-announce-title">
      <h2 id="t-announce-title" className="card__title">
        <Icon name="megaphone" /> Announcements
      </h2>
      <p className="muted small profile-note">
        Students currently in this course are notified when you post. Plain text only.
      </p>

      <form className="announce-form" onSubmit={submit} noValidate>
        {formError && <Alert>{formError}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
        <TextField
          label="Title"
          value={form.title}
          onChange={update('title')}
          error={errors.title}
          maxLength={TITLE_MAX}
          autoComplete="off"
        />
        <TextAreaField
          label="Message"
          value={form.body}
          onChange={update('body')}
          error={errors.body}
          maxLength={BODY_MAX}
          rows={4}
          hint={`${form.body.length}/${BODY_MAX} characters`}
        />
        <div className="form__actions">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? <Spinner size="sm" /> : <Icon name="megaphone" size={16} />}
            Post announcement
          </button>
        </div>
      </form>

      {loading && <LoadingState label="Loading announcements…" />}
      {error && !data && <ErrorState error={error} onRetry={reload} />}
      {data && data.length === 0 && <p className="muted">No announcements for this course yet.</p>}
      {data && data.length > 0 && (
        <ul className="announce-list announce-list--inline">
          {data.map((a) => (
            <li key={a.id} className="announce">
              <div className="announce__meta">
                <span className="muted small">
                  {a.authorName} · <time dateTime={a.createdAt}>{formatDateTime(a.createdAt)}</time>
                </span>
                {a.mine && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => remove(a)}
                    disabled={deleting === a.id}
                  >
                    {deleting === a.id ? <Spinner size="sm" /> : <Icon name="trash" size={16} />}
                    Delete<span className="visually-hidden"> announcement: {a.title}</span>
                  </button>
                )}
              </div>
              <h3 className="announce__title">{a.title}</h3>
              <p className="announce__body">{a.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
