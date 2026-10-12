import { useEffect, useState } from 'react'
import { checkImageUrl } from '../utils/imageUrl'
import { TextField } from './Fields'

// Remounted (via key) whenever the URL changes, so a failed load never sticks to a new URL.
function Preview({ url, variant }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={`media-preview media-preview--${variant}`}>
      {failed ? (
        <span className="media-preview__fallback">Image unavailable</span>
      ) : (
        <img
          src={url}
          alt={variant === 'icon' ? 'Preview of the course icon' : 'Preview of the course cover image'}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}

/**
 * An optional image URL input with a live preview and a button to clear it.
 * variant: 'cover' | 'icon'. The value is stored as NULL when emptied.
 */
export function ImageUrlField({ label, value, onChange, error, hint, variant, clearLabel }) {
  const localError = checkImageUrl(value)
  const trimmed = value.trim()
  // The preview loads the image from its host, so wait until typing pauses instead of
  // requesting every half-typed address. An existing value previews immediately.
  const [settled, setSettled] = useState(trimmed)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(trimmed), 600)
    return () => clearTimeout(timer)
  }, [trimmed])
  return (
    <div className="media-field">
      <TextField
        label={label}
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={error || localError}
        hint={hint}
        maxLength={2048}
        placeholder="https://"
        inputMode="url"
        autoComplete="off"
      />
      {trimmed !== '' && !localError && settled === trimmed && <Preview key={trimmed} url={trimmed} variant={variant} />}
      {trimmed !== '' && (
        <button type="button" className="btn btn--secondary btn--sm media-field__clear" onClick={() => onChange('')}>
          {clearLabel}
        </button>
      )}
    </div>
  )
}
