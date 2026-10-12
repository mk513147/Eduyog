import { useRef, useState } from 'react'
import { useFocusMainOnNavigation } from '../../../router/useFocusMainOnNavigation'
import { useAuth } from '../auth/useAuth'
import { Link } from '../router/Link'
import { BrandLogo } from './BrandLogo'
import { Icon } from './Icon'

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { to: '/admin', label: 'Dashboard', icon: 'overview' },
      { to: '/admin/platforms', label: 'Platforms', icon: 'platforms' },
      { to: '/admin/services', label: 'Services', icon: 'services' },
      { to: '/admin/users', label: 'Users', icon: 'users' },
      { to: '/admin/fitness-leads', label: 'Fitness Leads', icon: 'leads' },
    ],
  },
  {
    label: 'Eduyarp',
    items: [
      { to: '/admin/eduyarp/courses', label: 'Courses', icon: 'courses' },
      { to: '/admin/eduyarp/trainers', label: 'Trainers', icon: 'trainers' },
      { to: '/admin/eduyarp/enrolments', label: 'Enrolments', icon: 'enrolments' },
      { to: '/admin/eduyarp/classes', label: 'Classes', icon: 'classes' },
      { to: '/admin/eduyarp/certificates', label: 'Certificates', icon: 'certificates' },
      { to: '/admin/eduyarp/announcements', label: 'Announcements', icon: 'announcements' },
    ],
  },
]

export function Layout({ children }) {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const mainRef = useRef(null)
  // After navigating to another page, focus moves to the main content (shared shell behaviour).
  useFocusMainOnNavigation(mainRef)
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
          <BrandLogo />
          Eduyog Admin
        </span>
      </header>

      <aside id="sidebar" className={`sidebar${menuOpen ? ' sidebar--open' : ''}`}>
        <div className="brand">
          <BrandLogo />
          <span>
            <span className="brand__name">Eduyog</span>
            <span className="brand__sub">Admin Console</span>
          </span>
        </div>

        <nav className="nav" aria-label="Main">
          {NAV_GROUPS.map((group) => (
            <div key={group.label ?? 'main'} className="nav__group">
              {group.label && <p className="nav__heading">{group.label}</p>}
              {group.items.map((item) => (
                <Link key={item.to} to={item.to} className="nav__link" onClick={closeMenu}>
                  <Icon name={item.icon} />
                  {item.label}
                </Link>
              ))}
            </div>
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

      <main id="main" ref={mainRef} className="main" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}
