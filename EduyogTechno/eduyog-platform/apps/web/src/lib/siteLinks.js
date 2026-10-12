// The public sections of the unified site, for cross-section navigation (footers, "Back to Eduyog").
// Pure data + helpers (no browser or Vite globals). Only destinations that exist in this app are listed:
// React routes use the client-side router, the static sites (StudentAQ, Saritex) are separate documents
// and need plain links. `base` is the public base path without a trailing slash ("" or "/eduyog").
import { staticSiteHref } from '../staticSites.js'

export const SECTIONS = [
  { id: 'eduyog', label: 'Eduyog home', to: '/' },
  { id: 'eduyarp', label: 'Eduyarp', to: '/eduyarp' },
  { id: 'fitness', label: 'Eduyog Fitness', to: '/fitness' },
  { id: 'studentaq', label: 'StudentAQ', site: 'studentaq' },
  { id: 'saritex', label: 'Saritex', site: 'saritex' },
]

// Links to the other public sections (every section except `current`), as { label, to } for React routes
// or { label, href } for the static sites.
export function sectionLinks(current, base = '') {
  return SECTIONS.filter((section) => section.id !== current).map((section) =>
    section.site
      ? { id: section.id, label: section.label, href: staticSiteHref(section.site, base) }
      : { id: section.id, label: section.label, to: section.to },
  )
}
