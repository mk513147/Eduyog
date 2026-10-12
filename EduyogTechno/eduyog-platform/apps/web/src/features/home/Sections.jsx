import { Reveal } from '../../components/Reveal'
import { CONTACT_EMAIL } from '../../config'
import { Link } from '../../router/Link'
import learningImage from '../../assets/home/eduyarp-learning.webp'
import fitnessImage from '../../assets/home/fitness-home.webp'
import { StrokeIcon } from './Svg'

export function ProofStrip() {
  // Counts of real platforms and verticals only.
  return (
    <section className="proof" aria-label="Eduyog at a glance">
      <ul className="container proof__list">
        <Reveal as="li" className="proof__item">
          <strong>2</strong>
          <span>business verticals: Education and Fitness</span>
        </Reveal>
        <Reveal as="li" className="proof__item">
          <strong>4</strong>
          <span>platforms: Eduyarp, Fitness, Saritex and StudentAQ</span>
        </Reveal>
        <Reveal as="li" className="proof__item">
          <strong>1</strong>
          <span>brand: one clear place to start</span>
        </Reveal>
      </ul>
    </section>
  )
}

export function About() {
  return (
    <section className="section" id="about" aria-labelledby="about-title">
      <div className="container about">
        <Reveal className="about__intro">
          <p className="eyebrow">About Eduyog</p>
          <h2 className="section__title" id="about-title">
            One brand, two focused verticals
          </h2>
          <p>
            Eduyog is the primary digital brand of Eduyog Techno Solution Pvt. Ltd. It is the central entry point
            for the company&apos;s two business verticals, Education and Fitness.
          </p>
          <p>
            Each platform under Eduyog has its own clear purpose, audience and way of working, so students and
            businesses always know which service they are using.
          </p>
        </Reveal>

        <ul className="vertical-grid">
          <Reveal as="li" className="vertical vertical--education">
            <span className="vertical__icon" aria-hidden="true">
              <StrokeIcon size={22}>
                <path d="M2 9l10-5 10 5-10 5z" />
                <path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
              </StrokeIcon>
            </span>
            <h3 className="vertical__title">Education</h3>
            <p className="vertical__text">
              Three independent platforms: <strong>Saritex</strong> for academic support, <strong>Eduyarp</strong>{' '}
              for professional training and technical classes, and <strong>StudentAQ</strong> for international
              student career support.
            </p>
            <Link className="vertical__link" to="/#education">
              See Education
            </Link>
          </Reveal>
          <Reveal as="li" className="vertical vertical--fitness">
            <span className="vertical__icon" aria-hidden="true">
              <StrokeIcon size={22} d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
            </span>
            <h3 className="vertical__title">Fitness</h3>
            <p className="vertical__text">
              A B2B-focused platform offering marketing, promotional and digital support to fitness and wellness
              businesses.
            </p>
            <Link className="vertical__link" to="/#fitness">
              See Fitness
            </Link>
          </Reveal>
        </ul>
      </div>
    </section>
  )
}

const STEPS = [
  { num: '01', title: 'Learn', text: 'Work through modules and topics, with video lessons where trainers add them.' },
  { num: '02', title: 'Practice', text: 'Join scheduled live classes with your trainers.' },
  { num: '03', title: 'Progress', text: 'Mark topics complete and see your course progress update.' },
]

export function EduyarpShowcase() {
  return (
    <section className="section showcase" id="learn" aria-labelledby="learn-title">
      <div className="container showcase__grid">
        <Reveal className="showcase__copy">
          <p className="eyebrow">Eduyarp</p>
          <h2 className="section__title" id="learn-title">
            Learn, practice and track your progress
          </h2>
          <p className="section__lead section__lead--left">
            Eduyarp is the professional training platform: structured courses, live classes and a dashboard that
            shows where you are.
          </p>
          <ol className="steps">
            {STEPS.map((step) => (
              <li className="steps__item" key={step.num}>
                <span className="steps__num">{step.num}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
        <Reveal className="showcase__media">
          <figure className="frame frame--flat">
            <div className="frame__bar">
              <i></i>
              <i></i>
              <i></i>
            </div>
            <img
              src={learningImage}
              alt="Screenshot of the Eduyarp learning page, showing course progress and the modules and topics of a course"
              width="1200"
              height="780"
              loading="lazy"
            />
          </figure>
          <p className="showcase__caption">Eduyarp learning page (screenshot with demo data).</p>
        </Reveal>
      </div>
    </section>
  )
}

const BUSINESS_AREAS = ['Yoga', 'Gym', 'Zumba/Jumba', 'Karate', 'Other Fitness & Wellness Services']

const FITNESS_SERVICES = [
  ['Digital & social media marketing', 'Planning and running digital and social media marketing.'],
  ['Promotional campaigns & content', 'Promotional campaigns with supporting content.'],
  ['Lead generation & brand promotion', 'Reaching new customers and building brand visibility.'],
  ['Website & digital presence', 'Support for websites and online presence.'],
  ['Campaign & client engagement', 'Campaign management and client-engagement support.'],
]

// `renderPartnerLink` is passed in so this section stays free of routing and configuration details.
export function FitnessSection({ renderPartnerLink }) {
  return (
    <section className="section section--fitness" id="fitness" aria-labelledby="fitness-title">
      <div className="container">
        <Reveal as="header" className="section__header">
          <p className="eyebrow">Fitness · For business</p>
          <h2 className="section__title" id="fitness-title">
            Marketing and digital support for fitness &amp; wellness businesses
          </h2>
          <p className="section__lead">
            Eduyog Fitness is a B2B-focused platform. It offers marketing, promotional and digital support to
            businesses and service providers in the fitness and wellness space.
          </p>
        </Reveal>

        <div className="fitness">
          <Reveal className="fitness__block">
            <h3 className="fitness__heading">Business areas</h3>
            <ul className="chip-list">
              {BUSINESS_AREAS.map((area) => (
                <li className="chip-tag" key={area}>
                  {area}
                </li>
              ))}
            </ul>
            <figure className="frame frame--flat frame--fitness">
              <div className="frame__bar">
                <i></i>
                <i></i>
                <i></i>
              </div>
              <img
                src={fitnessImage}
                alt="Screenshot of the Eduyog Fitness website with its headline, services and enquiry call to action"
                width="1200"
                height="780"
                loading="lazy"
              />
            </figure>
          </Reveal>

          <Reveal className="fitness__block">
            <h3 className="fitness__heading">Services offered</h3>
            <ul className="service-list">
              {FITNESS_SERVICES.map(([title, text]) => (
                <li className="service" key={title}>
                  <span className="service__title">{title}</span>
                  <span className="service__text">{text}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal className="partner-cta" id="fitness-partner">
          <div>
            <h3 className="partner-cta__title">For Business / Become a Partner</h3>
            <p className="partner-cta__text">
              Run a fitness or wellness business and want support with marketing and your digital presence? Get in
              touch with Eduyog.
            </p>
          </div>
          {renderPartnerLink({ className: 'btn btn--primary', children: 'Become a Partner' })}
        </Reveal>
      </div>
    </section>
  )
}

export function ContactSection({ renderPartnerLink }) {
  return (
    <section className="section section--cta" id="contact" aria-labelledby="contact-title">
      <div className="container">
        <Reveal className="contact-card">
          <div>
            <p className="eyebrow eyebrow--light">Contact</p>
            <h2 className="section__title section__title--light" id="contact-title">
              Ready to learn, grow or partner with Eduyog?
            </h2>
            <p className="contact-card__intro">For Education enquiries and Fitness business partnerships.</p>
            <p className="contact-card__email">
              Email us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </p>
          </div>
          <div className="contact-card__actions">
            <Link className="btn btn--light btn--lg" to="/#education">
              Explore Education
            </Link>
            {renderPartnerLink({ className: 'btn btn--outline-light btn--lg', children: 'Become a Partner' })}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
