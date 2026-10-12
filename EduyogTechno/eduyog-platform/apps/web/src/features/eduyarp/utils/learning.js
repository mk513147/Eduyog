// Pure helpers for the learning page. They only read the course the API already returned; progress
// numbers always come from the API (course.enrolment.progress), never from here.

/**
 * Every topic in course order (module order, then topic order), each annotated with where it sits.
 * Modules and topics arrive already ordered from the API.
 */
export function flattenTopics(modules) {
  const flat = []
  modules.forEach((module, moduleIndex) => {
    module.topics.forEach((topic, topicIndex) => {
      flat.push({ topic, moduleId: module.id, moduleIndex, moduleTitle: module.title, topicIndex, position: flat.length })
    })
  })
  return flat
}

/**
 * Where to start: the first topic not yet completed, otherwise (all done) the first topic.
 * Returns an entry from flattenTopics, or null for a course with no topics.
 */
export function defaultTopicEntry(flat) {
  return flat.find((entry) => !entry.topic.completed) ?? flat[0] ?? null
}

/** The entry for a topic id, or null (e.g. the id is no longer in the course). */
export function findTopicEntry(flat, topicId) {
  return flat.find((entry) => entry.topic.id === topicId) ?? null
}
