import { useCallback, useState } from 'react'
import { usersApi } from '../api/endpoints'
import { RoleBadge } from '../components/Badge'
import { SelectField, TextAreaField, TextField } from '../components/Fields'
import { ImageUrlField } from '../components/ImageUrlField'
import { Modal } from '../components/Modal'
import { Alert, ErrorState, LoadingState, Spinner } from '../components/States'
import { useResource } from '../hooks/useResource'
import { splitApiError } from '../utils/errors'
import { formatDate } from '../utils/format'
import { STUDY_LEVELS } from '../utils/labels'
import { checkImageUrl } from '../utils/imageUrl'

const FIELDS = ['fullName', 'phone', 'institution', 'studyLevel', 'fieldOfStudy', 'graduationYear', 'bio', 'avatarUrl']

const toForm = (p) => ({
  fullName: p.fullName ?? '',
  phone: p.phone ?? '',
  institution: p.institution ?? '',
  studyLevel: p.studyLevel ?? '',
  fieldOfStudy: p.fieldOfStudy ?? '',
  graduationYear: p.graduationYear == null ? '' : String(p.graduationYear),
  bio: p.bio ?? '',
  avatarUrl: p.avatarUrl ?? '',
})

// Empty optional fields are sent as null so they are cleared.
function toPayload(form) {
  const text = (value) => (value.trim() === '' ? null : value.trim())
  return {
    fullName: form.fullName.trim(),
    phone: text(form.phone),
    institution: text(form.institution),
    studyLevel: form.studyLevel === '' ? null : form.studyLevel,
    fieldOfStudy: text(form.fieldOfStudy),
    graduationYear: form.graduationYear.trim() === '' ? null : Number(form.graduationYear),
    bio: text(form.bio),
    avatarUrl: text(form.avatarUrl),
  }
}

function ProfileForm({ profile, onSaved, onBusyChange }) {
  const [form, setForm] = useState(() => toForm(profile))
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)

  const update = (field) => (value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }
  const onInput = (field) => (event) => update(field)(event.target.value)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError(null)
    const problems = {}
    if (form.fullName.trim() === '') problems.fullName = 'Full name is required'
    const avatarProblem = checkImageUrl(form.avatarUrl)
    if (avatarProblem) problems.avatarUrl = avatarProblem
    setFieldErrors(problems)
    if (Object.keys(problems).length > 0) return
    onBusyChange(true)
    try {
      onSaved(await usersApi.updateProfile(profile.id, toPayload(form)))
    } catch (err) {
      const split = splitApiError(err, FIELDS)
      setFieldErrors(split.fieldErrors)
      setFormError(split.formError)
      onBusyChange(false)
    }
  }

  return (
    <form id="user-profile-form" className="form" onSubmit={handleSubmit} noValidate>
      {formError && <Alert>{formError}</Alert>}

      <dl className="details">
        <div>
          <dt>Email</dt>
          <dd className="cell-break">{profile.email}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>
            <RoleBadge role={profile.role} />
          </dd>
        </div>
        <div>
          <dt>Joined</dt>
          <dd>{formatDate(profile.createdAt)}</dd>
        </div>
      </dl>
      <p className="field__hint">Email and password cannot be edited here. Change the role from the Users list.</p>

      <TextField label="Full name" value={form.fullName} onChange={onInput('fullName')} error={fieldErrors.fullName} maxLength={150} required />
      <div className="form__row">
        <TextField label="Phone" type="tel" value={form.phone} onChange={onInput('phone')} error={fieldErrors.phone} maxLength={30} />
        <TextField label="Institution" value={form.institution} onChange={onInput('institution')} error={fieldErrors.institution} maxLength={200} />
      </div>
      <div className="form__row">
        <SelectField label="Study level" value={form.studyLevel} onChange={onInput('studyLevel')} error={fieldErrors.studyLevel}>
          <option value="">Not specified</option>
          {STUDY_LEVELS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <TextField label="Graduation year" type="number" min="1950" max="2100" value={form.graduationYear} onChange={onInput('graduationYear')} error={fieldErrors.graduationYear} />
      </div>
      <TextField label="Field of study" value={form.fieldOfStudy} onChange={onInput('fieldOfStudy')} error={fieldErrors.fieldOfStudy} maxLength={150} />
      <TextAreaField label="Bio" value={form.bio} onChange={onInput('bio')} error={fieldErrors.bio} maxLength={1000} rows={3} hint={`${form.bio.length}/1000 characters`} />
      <ImageUrlField
        label="Profile image URL"
        variant="icon"
        value={form.avatarUrl}
        onChange={update('avatarUrl')}
        error={fieldErrors.avatarUrl}
        hint="Optional. A link to an image hosted online."
        clearLabel="Remove image"
      />
    </form>
  )
}

// View and edit one user's profile. Email, password and role are not editable here.
export function UserProfileModal({ userId, onClose, onSaved }) {
  const loader = useCallback(() => usersApi.get(userId), [userId])
  const { data: profile, error, loading, reload } = useResource(loader)
  const [busy, setBusy] = useState(false)

  const close = () => {
    if (!busy) onClose()
  }

  return (
    <Modal
      title={profile ? `${profile.fullName} — profile` : 'User profile'}
      onClose={close}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={close} disabled={busy}>
            {profile ? 'Cancel' : 'Close'}
          </button>
          {profile && (
            <button type="submit" form="user-profile-form" className="btn btn--primary" disabled={busy}>
              {busy && <Spinner size="sm" />}
              Save changes
            </button>
          )}
        </>
      }
    >
      {loading && <LoadingState label="Loading profile…" />}
      {error && !profile && <ErrorState error={error} onRetry={reload} />}
      {profile && <ProfileForm profile={profile} onSaved={onSaved} onBusyChange={setBusy} />}
    </Modal>
  )
}
