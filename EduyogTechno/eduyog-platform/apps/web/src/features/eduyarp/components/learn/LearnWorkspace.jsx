import { motion, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { defaultTopicEntry, findTopicEntry, flattenTopics } from '../../utils/learning'
import { formatShortDate } from '../../utils/format'
import { Icon } from '../Icon'
import { Spinner } from '../States'
import { CourseOutline } from './CourseOutline'
import { TopicPlayer } from './TopicPlayer'

// Courses with at most this many topics open every module at first; larger ones open only the
// module the learner is in, so the outline stays short.
const SMALL_COURSE_TOPICS = 12

const matches = (query) => typeof window !== 'undefined' && window.matchMedia(query).matches

/**
 * The learning workspace: player + topic details + course outline. Presentation only. The
 * course, its completion flags and its progress all come from the API via props; completing a
 * topic is delegated to `onComplete`, which resolves to true when it was saved.
 */
export function LearnWorkspace({ course, busyTopicId, onComplete }) {
  const reduce = useReducedMotion()
  const flat = useMemo(() => flattenTopics(course.modules), [course.modules])

  // The starting topic is chosen once, when the workspace mounts. It must NOT keep following
  // "first incomplete topic", or marking a topic complete would silently move the learner on.
  const [selectedId, setSelectedId] = useState(() => defaultTopicEntry(flat)?.topic.id ?? null)
  const [toggles, setToggles] = useState({}) // moduleId -> the learner's explicit open/closed choice
  const [outlineOpen, setOutlineOpen] = useState(() => matches('(min-width: 768px)'))
  const [announcement, setAnnouncement] = useState(null)

  const current = findTopicEntry(flat, selectedId) ?? defaultTopicEntry(flat)
  const previous = current ? flat[current.position - 1] : undefined
  const next = current ? flat[current.position + 1] : undefined
  const { progress } = course.enrolment

  const isModuleOpen = (moduleId) => toggles[moduleId] ?? (flat.length <= SMALL_COURSE_TOPICS || moduleId === current?.moduleId)
  const toggleModule = (moduleId) => setToggles((prev) => ({ ...prev, [moduleId]: !isModuleOpen(moduleId) }))

  const selectTopic = (topicId) => {
    const entry = findTopicEntry(flat, topicId)
    if (!entry) return
    setSelectedId(topicId)
    // The module you move into is always shown, so you never have to hunt for your topic.
    setToggles((prev) => ({ ...prev, [entry.moduleId]: true }))
    setAnnouncement({ kind: 'viewing', title: entry.topic.title })
    // Stacked layouts: bring the player back into view (and tuck the list away on phones).
    if (matches('(max-width: 1023px)')) {
      if (matches('(max-width: 767px)')) setOutlineOpen(false)
      document.getElementById('learn-player')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    }
  }

  const complete = async () => {
    const saved = await onComplete(current.topic)
    if (saved) setAnnouncement({ kind: 'completed', title: current.topic.title })
  }

  if (course.modules.length === 0) {
    return (
      <div className="card learn-empty">
        <p className="muted">The course content will appear here once it is published.</p>
      </div>
    )
  }

  const topic = current?.topic
  const busy = topic ? busyTopicId === topic.id : false
  const totalTopics = flat.length
  const allDone = progress.percent === 100 && progress.totalTopics > 0

  return (
    <div className="learn-grid">
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement?.kind === 'viewing' && `Now viewing: ${announcement.title}`}
        {announcement?.kind === 'completed' && `Topic completed: ${announcement.title}. Course progress ${progress.percent}%.`}
      </p>

      <div className="learn-main">
        <div id="learn-player" className="learn-player-wrap">
          {topic ? <TopicPlayer key={topic.id} topic={topic} /> : null}
        </div>

        {topic ? (
          <motion.section
            key={topic.id}
            className="card learn-topic"
            aria-labelledby="learn-topic-title"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="learn-topic__where">
              <Icon name="module" size={14} />
              Module {current.moduleIndex + 1}: {current.moduleTitle}
              <span aria-hidden="true"> · </span>
              <span>
                Topic {current.position + 1} of {totalTopics}
              </span>
            </p>
            <div className="learn-topic__titlerow">
              <h2 id="learn-topic-title" className="learn-topic__title">
                {topic.title}
              </h2>
              {topic.completed ? (
                <span className="badge badge--success learn-topic__status">
                  <Icon name="check" size={13} /> Completed {topic.completedAt ? formatShortDate(topic.completedAt) : ''}
                </span>
              ) : (
                <span className="badge learn-topic__status">Not completed</span>
              )}
            </div>
            {topic.description && <p className="learn-topic__text">{topic.description}</p>}

            <div className="learn-actions">
              <button
                type="button"
                className="btn btn--secondary learn-actions__prev"
                disabled={!previous}
                onClick={() => previous && selectTopic(previous.topic.id)}
              >
                <Icon name="arrowLeft" size={16} /> Previous
                <span className="visually-hidden"> topic</span>
              </button>

              {!topic.completed && (
                <button type="button" className="btn btn--primary learn-actions__complete" onClick={complete} disabled={busy}>
                  {busy ? <Spinner size="sm" /> : <Icon name="check" size={16} />}
                  Mark complete
                  <span className="visually-hidden">: {topic.title}</span>
                </button>
              )}

              <button
                type="button"
                className={`btn learn-actions__next ${topic.completed ? 'btn--primary' : 'btn--secondary'}`}
                disabled={!next}
                onClick={() => next && selectTopic(next.topic.id)}
              >
                Next
                <span className="visually-hidden"> topic</span>
                <Icon name="arrowRight" size={16} />
              </button>
            </div>
            {!next && <p className="learn-topic__note">This is the last topic in the course.</p>}
            {allDone && (
              <p className="learn-done">
                <Icon name="check" size={16} /> Well done — you have completed every topic.
              </p>
            )}
          </motion.section>
        ) : (
          <div className="card learn-empty">
            <p className="muted">There are no topics in this course yet.</p>
          </div>
        )}
      </div>

      <aside className="learn-outline" aria-label="Course navigation">
        <button
          type="button"
          className="learn-outline__toggle"
          aria-expanded={outlineOpen}
          aria-controls="learn-outline-panel"
          onClick={() => setOutlineOpen((open) => !open)}
        >
          <span className="learn-outline__toggle-icon">
            <Icon name="outline" size={20} />
          </span>
          <span className="learn-outline__toggle-text">
            <strong>Course content</strong>
            <span>
              {course.modules.length} {course.modules.length === 1 ? 'module' : 'modules'} · {totalTopics}{' '}
              {totalTopics === 1 ? 'topic' : 'topics'}
            </span>
          </span>
          <Icon name="chevronDown" size={18} className="learn-outline__chev" />
        </button>

        <div id="learn-outline-panel" className={`learn-outline__panel${outlineOpen ? '' : ' is-collapsed'}`}>
          <div className="learn-outline__head">
            <h2 className="learn-outline__title">
              <Icon name="outline" size={18} /> Course content
            </h2>
            <p className="learn-outline__sub">
              {course.modules.length} {course.modules.length === 1 ? 'module' : 'modules'} · {totalTopics}{' '}
              {totalTopics === 1 ? 'topic' : 'topics'}
            </p>
          </div>
          <CourseOutline
            modules={course.modules}
            currentTopicId={topic?.id}
            isModuleOpen={isModuleOpen}
            onToggleModule={toggleModule}
            onSelectTopic={selectTopic}
          />
        </div>
      </aside>
    </div>
  )
}
