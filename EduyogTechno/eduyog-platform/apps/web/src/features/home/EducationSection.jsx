import { findPlatform } from '../../api/platforms'
import { Reveal } from '../../components/Reveal'
import { BASE_PATH } from '../../config'
import { Link } from '../../router/Link'
import { ROUTE_PATHS } from '../../routes'
import { usePlatforms } from './usePlatforms'
import { staticSiteHref } from '../../staticSites'
import { StrokeIcon } from './Svg'

// A card with a `site` (a static site, see staticSites.js) or a `route` (a React route of this app) is
// hosted here and always links to it, whatever the API says: the destination exists in this build. A
// card with neither would be matched to an active platform from GET /api/platforms by slug (or, failing
// that, by name); edit the slugs here if the Admin uses different ones.
const CARDS = [
  {
    slug: 'saritex',
    site: 'saritex',
    name: 'Saritex',
    subtitle: 'Academic Assignment, Essay & Thesis Support',
    text: 'Academic support for international students, covering assignments, essays, theses, academic research and academic guidance across a wide range of disciplines.',
    icon: (
      <StrokeIcon size={22}>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M9 13h6M9 17h4" />
      </StrokeIcon>
    ),
  },
  {
    slug: 'eduyarp',
    route: ROUTE_PATHS.eduyarp,
    name: 'Eduyarp',
    subtitle: 'Professional Training & Technical Classes',
    text: 'Training, courses and classes for UG, PG and PhD students, focused on Data Science, Artificial Intelligence, Prompt Engineering and Software Development.',
    icon: (
      <StrokeIcon size={22}>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4M9 9l-2 1.5L9 12M15 9l2 1.5-2 1.5" />
      </StrokeIcon>
    ),
  },
  {
    slug: 'studentaq',
    site: 'studentaq',
    name: 'StudentAQ',
    subtitle: 'International Student Career & Interview Support',
    text: 'Career guidance for international students, including job research, job shortlisting, application support and interview coordination.',
    icon: (
      <StrokeIcon size={22}>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />
      </StrokeIcon>
    ),
  },
]

function CardAction({ status, platform, name, internalHref, routePath }) {
  if (routePath) {
    // A route of this app: client-side navigation (the Eduyarp module loads on demand).
    return (
      <Link className="btn btn--primary btn--sm edu-card__link" to={routePath} aria-label={`Learn more about ${name}`}>
        Learn more
        <span className="edu-card__arrow" aria-hidden="true">
          →
        </span>
      </Link>
    )
  }
  if (internalHref) {
    // A plain anchor on purpose: the static site is a separate document, so this must be a full page
    // load (a client-side navigation would render the not-found route).
    return (
      <a className="btn btn--primary btn--sm edu-card__link" href={internalHref} aria-label={`Learn more about ${name}`}>
        Learn more
        <span className="edu-card__arrow" aria-hidden="true">
          →
        </span>
      </a>
    )
  }
  if (status === 'loading') {
    return <span className="edu-card__pending edu-card__pending--loading">Checking website…</span>
  }
  if (status !== 'ready') {
    return <span className="edu-card__pending">Website link unavailable</span>
  }
  if (platform?.url) {
    return (
      <a
        className="btn btn--primary btn--sm edu-card__link"
        href={platform.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Learn more about ${name} (opens in a new tab)`}
      >
        Learn more
        <span className="edu-card__arrow" aria-hidden="true">
          ↗
        </span>
      </a>
    )
  }
  return <span className="edu-card__pending">Website coming soon</span>
}

// Status of the API-driven links only. Cards hosted by this app (`site`) do not depend on the API, so
// the messages name just the platforms that do (currently Eduyarp).
function Status({ status, platforms, linked, retry, apiNames }) {
  if (apiNames.length === 0) return null
  const subject = apiNames.join(' and ')
  const noun = apiNames.length > 1 ? 'links' : 'link'
  const verb = apiNames.length > 1 ? 'are' : 'is'
  if (status === 'loading') return <p className="visually-hidden">Checking platform websites…</p>
  if (status === 'unavailable') {
    return <p className="edu-status__note">The {subject} website {noun} {verb} not available right now.</p>
  }
  if (status === 'error') {
    return (
      <div className="notice notice--compact notice--error">
        <div>
          <p className="notice__title">The {subject} website {noun} {verb} unavailable right now</p>
          <p>We could not load the {noun}. Please try again in a moment.</p>
        </div>
        <button className="btn btn--ghost btn--sm" type="button" onClick={retry}>
          Try again
        </button>
      </div>
    )
  }
  if (platforms.length === 0) {
    return <p className="edu-status__note">The {subject} website will be linked here as soon as it goes live.</p>
  }
  return (
    <p className="visually-hidden">
      {linked === 1 ? '1 platform website available.' : `${linked} platform websites available.`}
    </p>
  )
}

// Cards whose destination is not hosted by this app and so still comes from GET /api/platforms. Today
// every card is hosted here, so this is empty and the page makes no platforms request.
const apiNames = CARDS.filter((card) => !card.site && !card.route).map((card) => card.name)

export function EducationSection() {
  const { status, platforms, retry } = usePlatforms({ enabled: apiNames.length > 0 })
  const matches = CARDS.map((card) => (!card.site && !card.route && status === 'ready' ? findPlatform(platforms, card) : null))
  const internalHrefs = CARDS.map((card) => (card.site ? staticSiteHref(card.site, BASE_PATH) : null))
  const linked = matches.filter((platform) => platform?.url).length

  return (
    <section className="section section--alt" id="education" aria-labelledby="education-title">
      <div className="container">
        <Reveal as="header" className="section__header">
          <p className="eyebrow">Education</p>
          <h2 className="section__title" id="education-title">
            Three platforms, three clear purposes
          </h2>
          <p className="section__lead">
            Choose the platform that matches what you need: academic support, professional training or
            international career support.
          </p>
        </Reveal>

        <div className="edu-status" role="status" aria-live="polite">
          <Status status={status} platforms={platforms} linked={linked} retry={retry} apiNames={apiNames} />
        </div>

        <ul className="edu-grid">
          {CARDS.map((card, index) => (
            <Reveal
              as="li"
              delayIndex={index}
              className={`edu-card edu-card--${card.slug}${matches[index]?.url || internalHrefs[index] || card.route ? ' edu-card--linked' : ''}`}
              id={card.slug}
              key={card.slug}
            >
              <span className="edu-card__icon" aria-hidden="true">
                {card.icon}
              </span>
              <h3 className="edu-card__title">{card.name}</h3>
              <p className="edu-card__subtitle">{card.subtitle}</p>
              <p className="edu-card__text">{card.text}</p>
              <div className="edu-card__action">
                <CardAction status={status} platform={matches[index]} name={card.name} internalHref={internalHrefs[index]} routePath={card.route} />
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
