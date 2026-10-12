import { BrandLogo } from '../../../components/BrandLogo'
import { Link } from '../../../router/Link'
import { NAV_ITEMS } from '../content'
import { Icon } from './Icon'

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div className="footer__brand">
            <a className="brand brand--light" href="#home" aria-label="Eduyog Fitness home">
              <BrandLogo className="brand__logo" />
              <span className="brand__name">
                Eduyog <span>Fitness</span>
              </span>
            </a>
            <p className="footer__about">
              Corporate wellness, fitness programs and employee fitness initiatives from Eduyog
              Techno Solution.
            </p>
          </div>

          <nav className="footer__nav" aria-label="Footer">
            <h2 className="footer__title">Explore</h2>
            <ul className="footer__links">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="footer__eduyog">
            <h2 className="footer__title">Eduyog</h2>
            <Link className="btn btn--ghost-light btn--sm" to="/">
              <Icon name="arrow-left" size={16} />
              Back to Eduyog
            </Link>
          </div>
        </div>

        <p className="footer__bottom">
          © {new Date().getFullYear()} Eduyog Techno Solution. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
