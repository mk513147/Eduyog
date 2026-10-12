import { useEffect, useRef, useState } from 'react'
import { BrandLogo } from '../components/BrandLogo'
import { CONTACT_EMAIL, WHATSAPP_URL } from '../config'
import { Link } from '../router/Link'
import { useFocusMainOnNavigation } from '../router/useFocusMainOnNavigation'

const MOBILE_NAV_QUERY = '(max-width: 1080px)'

const NAV_LINKS = [
  { to: '/#home', label: 'Home' },
  { to: '/#learn', label: 'Eduyarp' },
  { to: '/#fitness', label: 'Fitness' },
  { to: '/#education', label: 'Platforms' },
  { to: '/#contact', label: 'Contact' },
]

const FOOTER_LINKS = [
  { to: '/#home', label: 'Home' },
  { to: '/#education', label: 'Education' },
  { to: '/#fitness', label: 'Fitness' },
  { to: '/#about', label: 'About' },
  { to: '/#contact', label: 'Contact' },
]

// Public-visitor layout: shared header, footer and WhatsApp button. Role-specific layouts (student,
// trainer, admin) are separate and are added when those areas are migrated; public navigation must
// stay distinct from them.
export function PublicLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false)
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

      <header className="site-header" id="top">
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
                <li key={item.to}>
                  <Link className="site-nav__link" to={item.to} onClick={closeMenu}>
                    {item.label}
                  </Link>
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

      <footer className="site-footer">
        <div className="container footer__inner">
          <div className="footer__brand">
            <Link className="logo logo--light" to="/#home" aria-label="Eduyog home">
              <BrandLogo />
              <span className="logo__text">
                Eduyog<span className="logo__accent">.</span>
              </span>
            </Link>
            <p className="footer__tagline">Education, Skills, Careers &amp; Fitness – One Integrated Platform.</p>
            <p className="footer__email">
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </p>
          </div>

          <nav aria-label="Footer">
            <ul className="footer__links">
              {FOOTER_LINKS.map((item) => (
                <li key={item.to}>
                  <Link to={item.to}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="container footer__bottom">
          <p>&copy; {new Date().getFullYear()} Eduyog Techno Solution Pvt. Ltd. All rights reserved.</p>
        </div>
      </footer>

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
