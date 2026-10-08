import { useEffect, useState } from 'react'
import { profileApi } from '../api/endpoints'
import { setToken } from '../api/session'
import { useAuth } from '../auth/useAuth'
import { Avatar } from '../components/Avatar'
import { SelectField, TextAreaField, TextField } from '../components/Fields'
import { Alert, ErrorState, LoadingState, Spinner } from '../components/States'
import { usePageTitle } from '../hooks/usePageTitle'
import { useResource } from '../hooks/useResource'
import { splitApiError } from '../utils/errors'
import { checkImageUrl } from '../utils/imageUrl'
import {
  BIO_MAX,
  ROLE_LABELS,
  STUDY_LEVELS,
  formToPayload,
  profileToForm,
  validatePasswordForm,
  validateProfileForm,
} from '../utils/profile'

const PROFILE_FIELDS = ['fullName', 'phone', 'institution', 'studyLevel', 'fieldOfStudy', 'graduationYear', 'bio', 'avatarUrl']
const PASSWORD_FIELDS = ['currentPassword', 'newPassword']

// The avatar preview waits until typing pauses, so half-typed addresses are not requested.
function useSettled(value, delay = 600) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}

function ProfileForm({ profile, onSaved }) {
  const { updateUser } = useAuth()
  const [form, setForm] = useState(() => profileToForm(profile))
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const avatarUrl = form.avatarUrl.trim()
  const settledAvatar = useSettled(avatarUrl)
  const previewUrl = avatarUrl !== '' && !checkImageUrl(avatarUrl) && settledAvatar === avatarUrl ? avatarUrl : ''

  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
    setSaved(false)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError(null)
    setSaved(false)
    const problems = validateProfileForm(form)
    setErrors(problems)
    if (Object.keys(problems).length > 0) return
    setBusy(true)
    try {
      const updated = await profileApi.update(formToPayload(form))
      updateUser({ fullName: updated.fullName })
      onSaved(updated)
      setForm(profileToForm(updated))
      setSaved(true)
    } catch (err) {
      const split = splitApiError(err, PROFILE_FIELDS)
      setErrors(split.fieldErrors)
      setFormError(split.formError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate aria-busy={busy}>
      {formError && <Alert>{formError}</Alert>}
      {saved && <Alert tone="success">Your profile has been saved.</Alert>}

      <div className="form__row">
        <TextField label="Full name" value={form.fullName} onChange={update('fullName')} error={errors.fullName} maxLength={150} autoComplete="name" required />
        <TextField label="Email" value={profile.email} readOnly hint="Your email address cannot be changed here." autoComplete="email" />
      </div>
      <div className="form__row">
        <TextField label="Role" value={ROLE_LABELS[profile.role] ?? profile.role} readOnly hint="Roles are managed by an Admin." />
        <TextField label="Phone" type="tel" value={form.phone} onChange={update('phone')} error={errors.phone} maxLength={30} autoComplete="tel" hint="Optional." />
      </div>

      <fieldset className="form__group">
        <legend className="form__legend">Academic information</legend>
        <TextField label="Institution" value={form.institution} onChange={update('institution')} error={errors.institution} maxLength={200} hint="School, college or university. Optional." />
        <div className="form__row">
          <SelectField label="Study level" value={form.studyLevel} onChange={update('studyLevel')} error={errors.studyLevel}>
            <option value="">Not specified</option>
            {STUDY_LEVELS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <TextField label="Graduation year" type="number" inputMode="numeric" min="1950" max="2100" value={form.graduationYear} onChange={update('graduationYear')} error={errors.graduationYear} hint="Optional." />
        </div>
        <TextField label="Field of study" value={form.fieldOfStudy} onChange={update('fieldOfStudy')} error={errors.fieldOfStudy} maxLength={150} hint="Optional." />
      </fieldset>

      <TextAreaField
        label="Bio"
        value={form.bio}
        onChange={update('bio')}
        error={errors.bio}
        rows={4}
        maxLength={BIO_MAX}
        hint={`A short introduction. ${form.bio.length}/${BIO_MAX} characters.`}
      />

      <div className="avatar-field">
        <TextField
          label="Profile image URL"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://"
          value={form.avatarUrl}
          onChange={update('avatarUrl')}
          error={errors.avatarUrl}
          maxLength={2048}
          hint="Optional. Link to an image hosted online; images are not uploaded here."
        />
        <div className="avatar-field__preview">
          <Avatar url={previewUrl} name={form.fullName} size="lg" />
          <span className="muted small">{previewUrl ? 'Preview' : 'Your initial is shown until a valid image address is added.'}</span>
        </div>
      </div>

      <div className="form__actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy && <Spinner size="sm" />}
          Save changes
        </button>
      </div>
    </form>
  )
}

const EMPTY_PASSWORDS = { currentPassword: '', newPassword: '', confirmPassword: '' }

function PasswordForm() {
  const { logout } = useAuth()
  const [form, setForm] = useState(EMPTY_PASSWORDS)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
    setDone(false)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError(null)
    setDone(false)
    const problems = validatePasswordForm(form)
    setErrors(problems)
    if (Object.keys(problems).length > 0) return
    setBusy(true)
    try {
      const result = await profileApi.changePassword(form.currentPassword, form.newPassword)
      // Older tokens (including other devices) stop working; keep this session on the new one.
      if (result?.token) {
        setToken(result.token)
        setForm(EMPTY_PASSWORDS)
        setDone(true)
      } else {
        logout('Your password was changed. Please log in again.')
      }
    } catch (err) {
      // A wrong current password is a 400 with a field error, so the session is untouched.
      const split = splitApiError(err, PASSWORD_FIELDS)
      setErrors(split.fieldErrors)
      setFormError(err.status === 429 ? 'Too many attempts. Please try again in a few minutes.' : split.formError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate aria-busy={busy}>
      {formError && <Alert>{formError}</Alert>}
      {done && <Alert tone="success">Your password has been changed. You have been signed out on other devices.</Alert>}
      <TextField label="Current password" type="password" autoComplete="current-password" value={form.currentPassword} onChange={update('currentPassword')} error={errors.currentPassword} />
      <TextField label="New password" type="password" autoComplete="new-password" value={form.newPassword} onChange={update('newPassword')} error={errors.newPassword} hint="At least 8 characters." />
      <TextField label="Confirm new password" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={update('confirmPassword')} error={errors.confirmPassword} />
      <div className="form__actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy && <Spinner size="sm" />}
          Change password
        </button>
      </div>
    </form>
  )
}

export default function ProfilePage() {
  usePageTitle('Profile')
  const { data: profile, error, loading, reload, setData } = useResource(profileApi.get)

  if (loading) return <LoadingState label="Loading your profile…" />
  if (error && !profile) return <ErrorState error={error} onRetry={reload} />

  return (
    <div className="container page profile-page">
      <header className="profile-head">
        <Avatar url={profile.avatarUrl} name={profile.fullName} size="lg" />
        <div>
          <p className="eyebrow">Profile and account settings</p>
          <h1 className="page__title">{profile.fullName}</h1>
          <p className="muted">
            {profile.email} · {ROLE_LABELS[profile.role] ?? profile.role}
          </p>
        </div>
      </header>

      <div className="profile-grid">
        <section className="card" aria-labelledby="profile-title">
          <h2 id="profile-title" className="card__title">
            Your profile
          </h2>
          <ProfileForm key={profile.id} profile={profile} onSaved={setData} />
        </section>

        <section className="card" aria-labelledby="password-title">
          <h2 id="password-title" className="card__title">
            Change password
          </h2>
          <p className="muted small profile-note">Changing your password signs you out on all other devices.</p>
          <PasswordForm />
        </section>
      </div>
    </div>
  )
}
