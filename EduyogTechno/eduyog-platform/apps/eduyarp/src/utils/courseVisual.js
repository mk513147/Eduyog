import artificialIntelligence from '../assets/course-art/artificial-intelligence.svg'
import dataScience from '../assets/course-art/data-science.svg'
import promptEngineering from '../assets/course-art/prompt-engineering.svg'
import softwareDevelopment from '../assets/course-art/software-development.svg'

// TEMPORARY DEMO ARTWORK. Cover art for the four Phase 1 demo courses, matched by course slug.
// To hand over to the company: delete this map (and the files in assets/course-art/); every
// course then falls back to the gradient + icon, and nothing else needs to change. Courses
// created in Admin get no artwork unless their slug is added here.
const DEMO_COURSE_ART = {
  'data-science': dataScience,
  'artificial-intelligence': artificialIntelligence,
  'prompt-engineering': promptEngineering,
  'software-development': softwareDevelopment,
}

/** Artwork URL for a course, or null (the same course always gets the same artwork). */
export function courseArtUrl(course) {
  return DEMO_COURSE_ART[course?.slug] ?? null
}

// Visual identity for a course. Courses have NO category in the database or the API, so none is
// invented here: the icon is only a visual hint matched from words in the course TITLE, with a
// generic book as the fallback. No category label is ever shown or stored.

// First match wins, so more specific topics come before broader ones.
const ICON_RULES = [
  { icon: 'wand', test: /\bprompt/ },
  { icon: 'brain', test: /\b(ai|artificial intelligence|machine learning|deep learning|neural|llm|generative)\b/ },
  { icon: 'code', test: /\b(data structures?|algorithms?)\b/ },
  { icon: 'chart', test: /\b(data|analytics?|statistics?|visuali[sz]ation|bi)\b/ },
  { icon: 'globe', test: /\b(web|website|html|css|front-?end|back-?end|react|node)\b/ },
  { icon: 'code', test: /\b(programming|coding|software|developer|development|python|java|javascript|c\+\+|devops)\b/ },
  { icon: 'briefcase', test: /\b(business|management|marketing|finance|entrepreneur\w*|leadership|sales)\b/ },
  { icon: 'palette', test: /\b(design|ui|ux|graphic|creative|illustration)\b/ },
]

/** Icon name (for the shared <Icon>) for a course. Deterministic: the same title always gives the same icon. */
export function courseIconName(course) {
  const title = String(course?.title ?? '').toLowerCase()
  return ICON_RULES.find((rule) => rule.test.test(title))?.icon ?? 'book'
}

/** Stable gradient per course id, so no imagery is invented. */
export function coverStyle(id) {
  const hue = (Number(id) * 47 + 230) % 360
  return {
    '--cover-a': `hsl(${hue} 78% 52%)`,
    '--cover-b': `hsl(${(hue + 48) % 360} 80% 38%)`,
  }
}
