import { Link } from '../../router/Link'
import { BrandLogo } from '../../components/BrandLogo'
import { ICON_PATHS } from './iconPaths'
import { ArrowIcon, StrokeIcon } from './Svg'

const FEATURES = [
  { icon: ICON_PATHS.book, title: 'Education', text: 'Learn new skills' },
  { icon: ICON_PATHS.people, title: 'Career Support', text: 'Global opportunities' },
  { icon: ICON_PATHS.heart, title: 'Fitness & Wellness', text: 'Healthier, happier you' },
]

const delay = (ms) => ({ '--d': `${ms}ms` })

export function Hero() {
  return (
    <section className="hero" id="home" aria-labelledby="hero-title">
      <div className="hero__bg" aria-hidden="true"></div>
      <div className="container hero__inner">
        <div className="hero__content">
          <p className="hero__eyebrow hero-in" style={delay(0)}>
            Eduyog Techno Solution Pvt. Ltd.
          </p>
          <h1 className="hero__title hero-in" id="hero-title" style={delay(80)}>
            Learn, Grow,
            <br className="hero__break" />{' '}
            <span className="text-gradient">Build Your Future</span>
          </h1>
          <p className="hero__lead hero-in" style={delay(160)}>
            Education, career support and fitness &amp; wellness — together in one integrated platform.
          </p>
          <div className="hero__actions hero-in" style={delay(240)}>
            <Link className="btn btn--brand btn--lg" to="/#education">
              Explore Platforms
              <ArrowIcon />
            </Link>
            <Link className="btn btn--brand-outline btn--lg" to="/#fitness">
              Explore Fitness
              <ArrowIcon />
            </Link>
          </div>
          <ul className="hero__features hero-in" style={delay(320)}>
            {FEATURES.map((feature) => (
              <li key={feature.title}>
                <span className="hero__feature-icon">
                  <StrokeIcon d={feature.icon} />
                </span>
                <span>
                  <strong>{feature.title}</strong>
                  <small>{feature.text}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Decorative illustration: CSS shapes, inline icons and the Eduyog logo. */}
        <div className="hero__visual hero-in" style={delay(200)} aria-hidden="true">
          <div className="art">
            <div className="art__blob"></div>
            <svg className="art__ribbons" viewBox="0 0 400 400" fill="none" focusable="false">
              <defs>
                <linearGradient id="art-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#1f8a89" />
                  <stop offset="1" stopColor="#16c06f" />
                </linearGradient>
              </defs>
              <path d="M22 262C70 360 220 396 330 318 372 288 392 240 388 196" stroke="url(#art-grad)" strokeWidth="14" strokeLinecap="round" opacity=".55" />
              <path d="M46 226C84 322 210 360 304 296" stroke="url(#art-grad)" strokeWidth="5" strokeLinecap="round" opacity=".45" />
              <path d="M330 70C372 100 392 150 386 196" stroke="#16c06f" strokeWidth="5" strokeLinecap="round" opacity=".35" />
            </svg>
            <BrandLogo className="art__logo" size={220} />
            <svg className="art__leaf art__leaf--a" viewBox="0 0 64 64" focusable="false">
              <path d="M8 56C8 26 28 8 58 6c0 30-18 50-50 50z" fill="#16c06f" opacity=".85" />
              <path d="M10 54C24 36 38 24 54 10" stroke="#fff" strokeWidth="2" fill="none" opacity=".7" />
            </svg>
            <svg className="art__leaf art__leaf--b" viewBox="0 0 64 64" focusable="false">
              <path d="M56 56C56 26 36 8 6 6c0 30 18 50 50 50z" fill="#1f8a89" opacity=".8" />
              <path d="M54 54C40 36 26 24 10 10" stroke="#fff" strokeWidth="2" fill="none" opacity=".7" />
            </svg>
            <span className="art__bubble art__bubble--a">
              <StrokeIcon d={ICON_PATHS.cap} />
            </span>
            <span className="art__bubble art__bubble--b">
              <StrokeIcon d={ICON_PATHS.personPlus} />
            </span>
            <span className="art__bubble art__bubble--c">
              <StrokeIcon d={ICON_PATHS.heart} />
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
