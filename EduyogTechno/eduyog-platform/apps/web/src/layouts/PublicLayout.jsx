import { useEffect, useRef, useState } from 'react'
import { BrandLogo } from '../components/BrandLogo'
import { SiteFooter } from '../components/SiteFooter'
import { BASE_PATH, WHATSAPP_URL } from '../config'
import { sectionLinks } from '../lib/siteLinks'
import { Link } from '../router/Link'
import { useRouter } from '../router/useRouter'
import { useFocusMainOnNavigation } from '../router/useFocusMainOnNavigation'

const MOBILE_NAV_QUERY = '(max-width: 1080px)'

// Header items: a plain link, or the Education dropdown ("menu": its items come from the shared section list,
// so the destinations are the existing Eduyarp route and the StudentAQ and Saritex static sites).
const NAV_LINKS = [
  { to: '/#home', label: 'Home' },
  { menu: 'education', label: 'Education' },
  { to: '/fitness', label: 'Fitness' },
  { to: '/#contact', label: 'Contact' },
]
const EDUCATION_IDS = ['eduyarp', 'studentaq', 'saritex']
const educationItems = () => {
  const all = sectionLinks('eduyog', BASE_PATH)
  return EDUCATION_IDS.map((id) => all.find((item) => item.id === id))
}

const FOOTER_LINKS = [
  { to: '/#home', label: 'Home' },
  { to: '/#education', label: 'Education' },
  { to: '/#fitness', label: 'Fitness' },
  { to: '/#about', label: 'About' },
  { to: '/#contact', label: 'Contact' },
]

// A disclosure dropdown: click, tap or Enter/Space/ArrowDown opens it; Escape (focus returns to the button),
// a click outside or Tab closes it; ArrowUp/Down, Home and End move between the items. On narrow screens it
// opens inline inside the mobile menu, so it cannot run off the screen.
function EducationMenu({ onNavigate }) {
  const [open, setOpen] = useState(false)
  const focusFirst = useRef(false)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const listRef = useRef(null)
  const items = educationItems()

  useEffect(() => {
    if (!open) return undefined
    const onClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (open && focusFirst.current) listRef.current?.querySelector('[role="menuitem"]')?.focus()
    focusFirst.current = false
  }, [open])

  const onButtonKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      focusFirst.current = true
    }
  }

  const onListKeyDown = (event) => {
    const links = [...listRef.current.querySelectorAll('[role="menuitem"]')]
    const index = links.indexOf(document.activeElement)
    const move = { ArrowDown: (index + 1) % links.length, ArrowUp: (index - 1 + links.length) % links.length, Home: 0, End: links.length - 1 }[event.key]
    if (move !== undefined) {
      event.preventDefault()
      links[move].focus()
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  const choose = () => {
    setOpen(false)
    onNavigate()
  }

  return (
    <div className="nav-dropdown" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="site-nav__link nav-dropdown__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="education-menu"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onButtonKeyDown}
      >
        Education
        <svg className="nav-dropdown__chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <ul id="education-menu" ref={listRef} className="nav-dropdown__menu" role="menu" aria-label="Education" hidden={!open} onKeyDown={onListKeyDown}>
        {items.map((item) => (
          <li key={item.id} role="none">
            {item.to ? (
              <Link role="menuitem" className="nav-dropdown__item" to={item.to} onClick={choose}>
                {item.label}
              </Link>
            ) : (
              <a role="menuitem" className="nav-dropdown__item" href={item.href} onClick={choose}>
                {item.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Public-visitor layout: shared header, footer and WhatsApp button. Role-specific layouts (student,
// trainer, admin) are separate and are added when those areas are migrated; public navigation must
// stay distinct from them.
export function PublicLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > 8)
  const { path } = useRouter()
  const toggleRef = useRef(null)
  const navRef = useRef(null)
  const mainRef = useRef(null)

  useFocusMainOnNavigation(mainRef)

  useEffect(() => {
    if (!menuOpen) return undefined
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      toggleRef.current?.focus()
    }
    const onPointerDown = (event) => {
      if (navRef.current?.contains(event.target) || toggleRef.current?.contains(event.target)) return
      setMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('click', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('click', onPointerDown)
    }
  }, [menuOpen])

  // A hairline and a soft shadow appear under the header once the page has scrolled.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Reset when switching to the desktop layout.
  useEffect(() => {
    const query = window.matchMedia?.(MOBILE_NAV_QUERY)
    if (!query?.addEventListener) return undefined
    const onChange = (event) => {
      if (!event.matches) setMenuOpen(false)
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="eduyog-site">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>

      <header className={`site-header${scrolled ? ' is-scrolled' : ''}`} id="top">
        <div className="container header__inner">
          <Link className="logo" to="/#home" aria-label="Eduyog home">
            <BrandLogo />
            <span className="logo__text">
              Eduyog<span className="logo__accent"></span>
            </span>
          </Link>

          <button
            ref={toggleRef}
            className="nav-toggle"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="site-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="nav-toggle__bar" aria-hidden="true"></span>
            <span className="nav-toggle__bar" aria-hidden="true"></span>
            <span className="nav-toggle__bar" aria-hidden="true"></span>
          </button>

          <nav ref={navRef} className={`site-nav${menuOpen ? ' is-open' : ''}`} id="site-nav" aria-label="Main">
            <ul className="site-nav__list">
              {NAV_LINKS.map((item) => (
                <li key={item.to ?? item.menu}>
                  {item.menu ? (
                    <EducationMenu onNavigate={closeMenu} />
                  ) : (
                    <Link
                      className="site-nav__link"
                      to={item.to}
                      onClick={closeMenu}
                      aria-current={item.to === '/#home' && path === '/' ? 'page' : undefined}
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            <Link className="btn btn--primary btn--sm site-nav__cta" to="/#education" onClick={closeMenu}>
              Explore platforms
            </Link>
          </nav>
        </div>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1}>
        {children}
      </main>

      <SiteFooter
        current="eduyog"
        brandLabel="Eduyog"
        tagline="Education, Skills, Careers & Fitness – One Integrated Platform."
        exploreTitle="Explore"
        exploreLinks={FOOTER_LINKS}
      />

      {/* Floating WhatsApp contact. The number is the one used by the StudentAQ site (websites/studentaq/assets/js/data.js). */}
      <a
        className="whatsapp-fab"
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contact Eduyog on WhatsApp (opens in a new tab)"
        title="Chat with us on WhatsApp"
      >
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
          />
        </svg>
      </a>
    </div>
  )
}
