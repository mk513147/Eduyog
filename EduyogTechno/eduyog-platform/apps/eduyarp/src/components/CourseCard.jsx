import { Link } from '../router/Link'
import { coverStyle } from '../utils/courseVisual'
import { formatFee } from '../utils/format'
import { CourseStatusBadge, LevelBadge } from './Badges'
import { CourseArt } from './CourseArt'
import { CourseIcon } from './CourseIcon'
import { Icon } from './Icon'

export function CourseCard({ course }) {
  return (
    <article className="course-card">
      <div className="course-card__cover" style={coverStyle(course.id)} aria-hidden="true">
        <CourseArt course={course} />
        <CourseIcon course={course} size="lg" />
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
