import { useState } from 'react'
import { eduyarpApi, usersApi } from '../../api/endpoints'
import { SelectField } from '../../components/Fields'
import { Modal } from '../../components/Modal'
import { Alert, ErrorState, LoadingState, Spinner } from '../../components/States'
import { useResource } from '../../hooks/useResource'

// Loads the approved Students and published courses, then grants full-course access (an active enrolment).
// The backend decides everything that matters (approved student, published course, one active course).
function useOptions() {
  const users = useResource(usersApi.list)
  const courses = useResource(eduyarpApi.courses.list)
  return {
    loading: users.loading || courses.loading,
    error: users.error || courses.error,
    reload: () => {
      users.reload()
      courses.reload()
    },
    students: (users.data ?? []).filter((u) => u.role === 'student' && u.approvalStatus === 'approved'),
    courses: (courses.data ?? []).filter((c) => c.status === 'published'),
  }
}

export function GrantAccessModal({ onClose, onGranted }) {
  const options = useOptions()
  const [studentId, setStudentId] = useState('')
  const [courseId, setCourseId] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    if (!studentId || !courseId) {
      setError('Choose a student and a course.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await eduyarpApi.enrolments.grant(studentId, courseId)
      const student = options.students.find((s) => String(s.id) === studentId)
      const course = options.courses.find((c) => String(c.id) === courseId)
      onGranted(student, course)
    } catch (err) {
      // 409: the student already has an active course (or this one); 404/409 otherwise.
      setError(err.message)
      setBusy(false)
    }
  }

  const close = () => {
    if (!busy) onClose()
  }

  let body
  if (options.loading) body = <LoadingState label="Loading students and courses…" />
  else if (options.error) body = <ErrorState error={options.error} onRetry={options.reload} />
  else
    body = (
      <form id="grant-access-form" className="form" onSubmit={submit} noValidate>
        {error && <Alert>{error}</Alert>}
        <SelectField label="Student" value={studentId} onChange={(event) => setStudentId(event.target.value)} required>
          <option value="">Choose a student…</option>
          {options.students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName} ({s.email})
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Course"
          value={courseId}
          onChange={(event) => setCourseId(event.target.value)}
          hint="Published courses only. A student can have one active course at a time."
          required
        >
          <option value="">Choose a course…</option>
          {options.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </SelectField>
      </form>
    )

  return (
    <Modal
      title="Grant course access"
      size="sm"
      onClose={close}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="grant-access-form" className="btn btn--primary" disabled={busy || options.loading || Boolean(options.error)}>
            {busy && <Spinner size="sm" />}
            Grant access
          </button>
        </>
      }
    >
      {body}
    </Modal>
  )
}
