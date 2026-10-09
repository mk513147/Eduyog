import { BrandLogo } from './BrandLogo'
import { useEffect, useState } from 'react'
import { EDUYOG_URL } from '../config'
import { NAV_ITEMS } from '../content'
import { Icon } from './Icon'

const DESKTOP_QUERY = '(min-width: 900px)'
const MENU_ID = 'mobile-menu'

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  useEffect(() => {
    if (!menuOpen) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    const desktop = window.matchMedia(DESKTOP_QUERY)
    const onDesktop = (event) => {
      if (event.matches) setMenuOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    desktop.addEventListener('change', onDesktop)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      desktop.removeEventListener('change', onDesktop)
    }
  }, [menuOpen])

  return (
    <header className={`navbar${menuOpen ? ' navbar--open' : ''}`}>
      <div className="container navbar__inner">
        <a className="brand" href="#home" aria-label="Eduyog Fitness home" onClick={closeMenu}>
          <BrandLogo />
          <span className="brand__name">
            Eduyog <span>Fitness</span>
          </span>
        </a>

        <nav className="navbar__nav" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <a key={item.href} className="navbar__link" href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="navbar__actions">
          {EDUYOG_URL && (
            <a className="btn btn--outline btn--sm navbar__back" href={EDUYOG_URL}>
              <Icon name="arrow-left" size={16} />
              Back to Eduyog
            </a>
          )}
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls={MENU_ID}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} size={22} />
          </button>
        </div>
      </div>

      <div className="mobile-menu" id={MENU_ID} hidden={!menuOpen}>
        <nav className="container mobile-menu__nav" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <a key={item.href} className="mobile-menu__link" href={item.href} onClick={closeMenu}>
              {item.label}
              <Icon name="arrow-right" size={18} />
            </a>
          ))}
          {EDUYOG_URL && (
            <a className="btn btn--outline mobile-menu__back" href={EDUYOG_URL}>
              <Icon name="arrow-left" size={16} />
              Back to Eduyog
            </a>
          )}
        </nav>
      </div>
    </header>
  )
}
