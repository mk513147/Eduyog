import { Link } from '../router/Link'
import { formatFee } from '../utils/format'
import { CourseStatusBadge, LevelBadge } from './Badges'
import { Icon } from './Icon'

export function CourseCard({ course }) {
  return (
    <article className="course-card">
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
    </article>
  )
}
