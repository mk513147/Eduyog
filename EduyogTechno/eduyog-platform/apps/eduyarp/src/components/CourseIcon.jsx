import { useState } from 'react'
import { coverStyle, courseIconName } from '../utils/courseVisual'
import { Icon } from './Icon'

/**
 * Rounded icon tile for a course. Decorative (the course title is always next to it), so it is
 * hidden from assistive technology. size: 'md' | 'lg'.
 * Uses the course's own icon (course.iconUrl, set in Admin) when it has one and it loads;
 * otherwise the default Lucide icon matched from the course title.
 */
export function CourseIcon({ course, size = 'md' }) {
  const [customFailed, setCustomFailed] = useState(false)
  const iconSize = size === 'lg' ? 28 : 22
  const custom = !customFailed && course.iconUrl ? course.iconUrl : null
  return (
    <span
      className={`course-icon course-icon--${size}${custom ? ' course-icon--image' : ''}`}
      style={coverStyle(course.id)}
      aria-hidden="true"
    >
      {custom ? (
        <img
          src={custom}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setCustomFailed(true)}
        />
      ) : (
        <Icon name={courseIconName(course)} size={iconSize} />
      )}
    </span>
  )
}
