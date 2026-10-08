import { checkImageUrl } from './imageUrl'

export const RESOURCE_TYPES = [
  ['video', 'Video'],
  ['pdf', 'PDF'],
  ['document', 'Document'],
  ['presentation', 'Presentation'],
  ['external', 'External link'],
]

export const RESOURCE_TYPE_LABELS = Object.fromEntries(RESOURCE_TYPES)

export const RESOURCE_ICONS = {
  video: 'video',
  pdf: 'file',
  document: 'file',
  presentation: 'slides',
  external: 'link',
}

// Client-side pre-check only; the backend is the authority. Returns null when fine.
export function checkResourceUrl(value) {
  if (value.trim() === '') return 'Address is required'
  return checkImageUrl(value)
}

// "https://www.example.com/a/b" -> "example.com", shown next to the open link.
export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

// Groups a resource list (already in curriculum order) into course-wide and per-module sections.
export function groupResources(resources) {
  const sections = []
  for (const resource of resources) {
    const key = resource.moduleId ?? 'course'
    let section = sections.find((s) => s.key === key)
    if (!section) {
      section = { key, title: resource.moduleId ? resource.moduleTitle : 'Whole course', items: [] }
      sections.push(section)
    }
    section.items.push(resource)
  }
  return sections
}
