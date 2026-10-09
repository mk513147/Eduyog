import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { NotificationBell } from '../notifications/NotificationBell'
import { Link } from '../router/Link'
import { useRouter } from '../router/useRouter'
import { loginPath } from '../router/match'
import { BrandLogo } from './BrandLogo'
import { Icon } from './Icon'

export function Layout({ children }) {
  const { status, user, isStudent, isTrainer, logout } = useAuth()
  const { path, fullPath, navigate } = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  // Return here after logging in, except from the login/register pages.
  const loginLink = path === '/login' || path === '/register' ? '/login' : loginPath(fullPath)
  const closeMenu = () => setMenuOpen(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!menuOpen) return undefined
    const onKey = (event) => event.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const handleLogout = () => {
    closeMenu()
    logout()
    navigate('/')
  }

  return (
    <div className="site">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className={`header${scrolled ? ' header--scrolled' : ''}${menuOpen ? ' header--open' : ''}`}>
        <div className="container header__inner">
          <Link to="/" className="brand" onClick={closeMenu}>
            <BrandLogo />
            <span>
              <span className="brand__name">Eduyarp</span>
              <span className="brand__sub">by Eduyog</span>
            </span>
          </Link>

          {status === 'authenticated' && <NotificationBell className="bell--header" watch />}

          <button
            type="button"
            className="btn btn--ghost btn--icon header__toggle"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="site-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} size={20} />
          </button>

          <nav id="site-nav" className={`nav${menuOpen ? ' nav--open' : ''}`} aria-label="Main">
            <Link to="/courses" className="nav__link" onClick={closeMenu}>
              Courses
            </Link>
            {isStudent && (
              <Link to="/dashboard" className="nav__link" onClick={closeMenu}>
                My dashboard
              </Link>
            )}
            {isStudent && (
              <Link to="/certificates" className="nav__link" onClick={closeMenu}>
                Certificates
              </Link>
            )}
            {isTrainer && (
              <Link to="/trainer" className="nav__link" onClick={closeMenu}>
                Trainer dashboard
              </Link>
            )}
            <div className="nav__actions">
              {status === 'authenticated' ? (
                <>
                  <NotificationBell className="bell--nav" />
                  <Link to="/profile" className="nav__user" title={`${user.email} · Profile and account settings`} onClick={closeMenu}>
                    <span className="avatar avatar--sm" aria-hidden="true">
                      {user.fullName.charAt(0).toUpperCase()}
                    </span>
                    {user.fullName}
                    <span className="visually-hidden"> (profile and account settings)</span>
                  </Link>
                  <button type="button" className="btn btn--secondary btn--sm" onClick={handleLogout}>
                    <Icon name="logout" size={16} />
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link to={loginLink} className="btn btn--ghost btn--sm" onClick={closeMenu}>
                    Log in
                  </Link>
                  <Link to="/register" className="btn btn--primary btn--sm" onClick={closeMenu}>
                    Get started
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      </header>

      <main id="main" className="main" tabIndex={-1}>
        {children}
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <div className="footer__brand">
            <BrandLogo />
            <p>
              <strong>Eduyarp</strong>
              <span>Professional training and technical classes by Eduyog Techno Solution Pvt. Ltd.</span>
            </p>
          </div>
          <nav className="footer__links" aria-label="Footer">
            <Link to="/courses">Courses</Link>
            {isStudent && <Link to="/dashboard">My dashboard</Link>}
            {isStudent && <Link to="/certificates">Certificates</Link>}
            {isTrainer && <Link to="/trainer">Trainer dashboard</Link>}
            {status === 'authenticated' && <Link to="/notifications">Notifications</Link>}
            {status === 'authenticated' ? <Link to="/profile">Profile</Link> : <Link to="/login">Log in</Link>}
          </nav>
        </div>
      </footer>
    </div>
  )
}
