import { useState } from 'react'

// Profile picture from an externally hosted URL, with the person's initial as the
// neutral fallback (no URL, or the image cannot load). Decorative: the name is
// always shown next to it. Remounted by `key` when the URL changes.
function AvatarImage({ url, name, size }) {
  const [failed, setFailed] = useState(false)
  if (!url || failed) {
    return (
      <span className={`profile-avatar profile-avatar--${size} profile-avatar--initial`} aria-hidden="true">
        {(name || '?').trim().charAt(0).toUpperCase() || '?'}
      </span>
    )
  }
  return (
    <span className={`profile-avatar profile-avatar--${size}`} aria-hidden="true">
      <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    </span>
  )
}

export function Avatar({ url, name, size = 'md' }) {
  return <AvatarImage key={url || 'none'} url={url} name={name} size={size} />
}
