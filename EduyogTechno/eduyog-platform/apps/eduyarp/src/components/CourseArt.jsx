import { useState } from 'react'
import { courseArtUrl } from '../utils/courseVisual'

/**
 * Decorative cover for a course, filling its positioned parent. Preference order:
 *   1. the course's own cover image (course.coverImageUrl, set in Admin),
 *   2. the temporary demo artwork for the four demo courses (utils/courseVisual.js),
 *   3. nothing, so the parent's gradient (and the course icon) remain the visual.
 * If the custom image fails to load it falls back to 2, then 3. The course title is always real
 * text next to the cover, so the image carries no information (alt="").
 */
export function CourseArt({ course, className = '', eager = false }) {
  const [customFailed, setCustomFailed] = useState(false)
  const custom = !customFailed && course?.coverImageUrl ? course.coverImageUrl : null
  const src = custom || courseArtUrl(course)
  if (!src) return null
  return (
    <img
      key={src}
      className={`course-art ${className}`.trim()}
      src={src}
      alt=""
      width="600"
      height="256"
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy={custom ? 'no-referrer' : undefined}
      onError={custom ? () => setCustomFailed(true) : undefined}
    />
  )
}
