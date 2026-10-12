import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Icon } from '../Icon'

function TopicButton({ topic, current, onSelect }) {
  const iconName = topic.completed ? 'topicDone' : current ? 'topicCurrent' : 'topicOpen'
  return (
    <li>
      <button
        type="button"
        className={`outline-topic${current ? ' is-current' : ''}${topic.completed ? ' is-done' : ''}`}
        aria-current={current ? 'true' : undefined}
        onClick={() => onSelect(topic.id)}
      >
        <span className="outline-topic__icon">
          <Icon name={iconName} size={20} />
        </span>
        <span className="outline-topic__body">
          <span className="outline-topic__title">{topic.title}</span>
          {/* State is always written out as well as shown by icon and colour. */}
          <span className="outline-topic__meta">
            {current && <span className="outline-topic__now">Currently viewing</span>}
            {topic.completed && <span>Completed</span>}
            {topic.videoEmbedUrl && (
              <span className="outline-topic__video">
                <Icon name="video" size={13} /> Video
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  )
}

/**
 * Modules and topics exactly as the API returned them. Each module is a disclosure button
 * (aria-expanded); whether it is open is decided by the parent.
 */
export function CourseOutline({ modules, currentTopicId, isModuleOpen, onToggleModule, onSelectTopic }) {
  const reduce = useReducedMotion()

  return (
    <nav aria-label="Course content">
      <ol className="outline">
        {modules.map((module, index) => {
          const open = isModuleOpen(module.id)
          const done = module.topics.filter((t) => t.completed).length
          const panelId = `outline-module-${module.id}`
          return (
            <li key={module.id} className="outline__module">
              <h3 className="outline__heading">
                <button
                  type="button"
                  className="outline__head"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => onToggleModule(module.id)}
                >
                  <span className="outline__module-icon">
                    <Icon name="module" size={18} />
                  </span>
                  <span className="outline__titles">
                    <span className="outline__number">Module {index + 1}</span>
                    <span className="outline__name">{module.title}</span>
                  </span>
                  <span className="outline__count">
                    <span className="visually-hidden">{done} of {module.topics.length} topics completed</span>
                    <span aria-hidden="true">
                      {done}/{module.topics.length}
                    </span>
                  </span>
                  <Icon name="chevronDown" size={18} className="outline__chev" />
                </button>
              </h3>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    key="panel"
                    id={panelId}
                    className="outline__panel"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: reduce ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {module.topics.length === 0 ? (
                      <p className="outline__empty">No topics in this module yet.</p>
                    ) : (
                      <ul className="outline__topics">
                        {module.topics.map((topic) => (
                          <TopicButton key={topic.id} topic={topic} current={topic.id === currentTopicId} onSelect={onSelectTopic} />
                        ))}
                      </ul>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
