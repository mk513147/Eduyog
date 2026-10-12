import { SiteFooter } from '../../../components/SiteFooter'
import { NAV_ITEMS } from '../content'

// The shared Eduyog footer, with the Fitness page's own anchors (plain #anchors on this page).
export function Footer() {
  return (
    <SiteFooter
      current="fitness"
      brandLabel="Eduyog Fitness"
      tagline="Corporate wellness, fitness programs and employee fitness initiatives from Eduyog Techno Solution."
      exploreTitle="Explore"
      exploreLinks={NAV_ITEMS.map((item) => ({ label: item.label, href: item.href }))}
    />
  )
}
