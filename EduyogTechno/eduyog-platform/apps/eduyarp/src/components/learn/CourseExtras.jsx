import { useCallback } from 'react'
import { studentApi } from '../../api/endpoints'
import { useResource } from '../../hooks/useResource'
import { Icon } from '../Icon'
import { FaqList, ResourceList } from '../ResourceList'
import { ErrorState, LoadingState } from '../States'
import { AssignmentsCard } from './AssignmentsCard'

// Learning resources and FAQs for a course the student can currently access. Shown below
// the learning workspace; each section loads on its own so one failure does not hide the other.
export function CourseExtras({ courseId }) {
  const resourcesLoader = useCallback(() => studentApi.resources(courseId), [courseId])
  const faqsLoader = useCallback(() => studentApi.faqs(courseId), [courseId])
  const resources = useResource(resourcesLoader)
  const faqs = useResource(faqsLoader)

  return (
    <div className="extras">
      <AssignmentsCard courseId={courseId} />

      <section className="card" aria-labelledby="extras-resources">
        <h2 id="extras-resources" className="card__title">
          <Icon name="file" /> Learning resources
        </h2>
        {resources.loading && <LoadingState label="Loading resources…" />}
        {resources.error && !resources.data && <ErrorState error={resources.error} onRetry={resources.reload} />}
        {resources.data && resources.data.length === 0 && (
          <p className="muted">No resources have been added to this course yet.</p>
        )}
        {resources.data && resources.data.length > 0 && <ResourceList resources={resources.data} />}
      </section>

      <section className="card" aria-labelledby="extras-faqs">
        <h2 id="extras-faqs" className="card__title">
          <Icon name="help" /> Frequently asked questions
        </h2>
        {faqs.loading && <LoadingState label="Loading questions…" />}
        {faqs.error && !faqs.data && <ErrorState error={faqs.error} onRetry={faqs.reload} />}
        {faqs.data && faqs.data.length === 0 && <p className="muted">No questions have been added to this course yet.</p>}
        {faqs.data && faqs.data.length > 0 && <FaqList faqs={faqs.data} />}
      </section>
    </div>
  )
}
