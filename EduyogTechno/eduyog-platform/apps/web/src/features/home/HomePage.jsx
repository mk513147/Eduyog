import { FITNESS_URL } from '../../config'
import { resolvePartnerLink } from '../../lib/partnerLink'
import { usePageTitle } from '../../lib/usePageTitle'
import { EducationSection } from './EducationSection'
import { Hero } from './Hero'
import { PartnerLinkButton } from './PartnerLinkButton'
import { About, ContactSection, EduyarpShowcase, FitnessSection, ProofStrip } from './Sections'

// Same title as the original page and as index.html (kept in step so client-side navigation back to
// the homepage restores it).
const HOME_TITLE = 'Eduyog — Education, Skills, Careers & Fitness'

export default function HomePage() {
  usePageTitle(HOME_TITLE)
  // "Become a Partner" goes to the unified /fitness page (VITE_FITNESS_URL can override it).
  const partnerLink = resolvePartnerLink({ configuredUrl: FITNESS_URL })

  const renderPartnerLink = ({ className, children }) => (
    <PartnerLinkButton link={partnerLink} className={className}>
      {children}
    </PartnerLinkButton>
  )

  return (
    <>
      <Hero />
      <ProofStrip />
      <About />
      <EducationSection />
      <EduyarpShowcase />
      <FitnessSection renderPartnerLink={renderPartnerLink} />
      <ContactSection renderPartnerLink={renderPartnerLink} />
    </>
  )
}
