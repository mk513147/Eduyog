import { Link } from '../router/Link'
import { formatFee } from '../utils/format'
import { CourseStatusBadge, LevelBadge } from './Badges'
import { Icon } from './Icon'

// Generated cover: a stable hue per course id, so no imagery is invented.
function coverStyle(id) {
  const hue = (Number(id) * 47 + 230) % 360
  return {
    '--cover-a': `hsl(${hue} 78% 52%)`,
    '--cover-b': `hsl(${(hue + 48) % 360} 80% 38%)`,
  }
}

export function CourseCard({ course }) {
  return (
    <article className="course-card">
      <div className="course-card__cover" style={coverStyle(course.id)} aria-hidden="true">
        <Icon name="code" size={26} />
        <span className="course-card__cover-label">{course.title.slice(0, 2).toUpperCase()}</span>
      </div>
      <div className="course-card__body">
        <div className="course-card__badges">
          <LevelBadge level={course.level} />
          <CourseStatusBadge status={course.status} />
        </div>
        <h3 className="course-card__title">
          <Link to={`/courses/${course.slug}`} className="course-card__link">
            {course.title}
          </Link>
        </h3>
        {course.description && <p className="course-card__text line-clamp">{course.description}</p>}
        <div className="course-card__footer">
          <span className="meta">
            <Icon name="clock" size={16} />
            {course.duration || 'Flexible'}
          </span>
          <span className="course-card__fee">{formatFee(course.fee)}</span>
        </div>
        <span className="course-card__cta" aria-hidden="true">
          View course <Icon name="arrowRight" size={16} />
        </span>
      </div>
    </article>
  )
}
