import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { Link } from '../router/Link'
import { Icon } from './Icon'

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: 'overview' },
  { to: '/platforms', label: 'Platforms', icon: 'platforms' },
  { to: '/services', label: 'Services', icon: 'services' },
  { to: '/users', label: 'Users', icon: 'users' },
  { to: '/fitness-leads', label: 'Fitness Leads', icon: 'leads' },
]

export function Layout({ children }) {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="layout">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className="topbar">
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen}
          aria-controls="sidebar"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Icon name={menuOpen ? 'close' : 'menu'} />
        </button>
        <span className="brand brand--compact">
          <span className="brand__mark" aria-hidden="true">E</span>
          Eduyog Admin
        </span>
      </header>

      <aside id="sidebar" className={`sidebar${menuOpen ? ' sidebar--open' : ''}`}>
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">E</span>
          <span>
            <span className="brand__name">Eduyog</span>
            <span className="brand__sub">Admin Console</span>
          </span>
        </div>

        <nav className="nav" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <Link key={item.to} to={item.to} className="nav__link" onClick={closeMenu}>
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <span className="sidebar__user-name">{user.fullName}</span>
            <span className="sidebar__user-email">{user.email}</span>
          </div>
          <button type="button" className="btn btn--ghost btn--block" onClick={logout}>
            <Icon name="logout" />
            Log out
          </button>
        </div>
      </aside>

      {menuOpen && <div className="scrim" onClick={closeMenu} aria-hidden="true" />}

      <main id="main" className="main" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}
