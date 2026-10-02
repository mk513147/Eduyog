import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { Link } from '../router/Link'
import { useRouter } from '../router/useRouter'
import { loginPath } from '../router/match'
import { Icon } from './Icon'

export function Layout({ children }) {
  const { status, user, isStudent, logout } = useAuth()
  const { path, fullPath, navigate } = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  // Return here after logging in, except from the login/register pages.
  const loginLink = path === '/login' || path === '/register' ? '/login' : loginPath(fullPath)
  const closeMenu = () => setMenuOpen(false)

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

      <header className="header">
        <div className="container header__inner">
          <Link to="/" className="brand" onClick={closeMenu}>
            <span className="brand__mark" aria-hidden="true">
              E
            </span>
            <span>
              <span className="brand__name">Eduyarp</span>
              <span className="brand__sub">by Eduyog</span>
            </span>
          </Link>

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
            <div className="nav__actions">
              {status === 'authenticated' ? (
                <>
                  <span className="nav__user" title={user.email}>
                    <Icon name="user" size={16} />
                    {user.fullName}
                  </span>
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
          <p>
            <strong>Eduyarp</strong> · Professional training and technical classes by Eduyog Techno
            Solution Pvt. Ltd.
          </p>
        </div>
      </footer>
    </div>
  )
}
