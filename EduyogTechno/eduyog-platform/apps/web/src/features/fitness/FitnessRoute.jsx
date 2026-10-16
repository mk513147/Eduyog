import { MotionConfig } from 'motion/react'
import '@fontsource-variable/inter'
import { usePageMeta } from '../../lib/usePageTitle'
import FitnessPage from './FitnessPage'
import './styles/tokens.css'
import './styles/base.css'
import './styles/premium.css'
import './styles/root.css'

// Lazy-loaded route module for /fitness: everything Fitness needs (motion, icons, Inter, CSS) lives
// behind this import, so the homepage does not download any of it.
const FITNESS_META = {
  title: 'Eduyog Fitness',
  description: 'Corporate wellness, fitness programs and employee fitness initiatives from Eduyog Techno Solution.',
}

export default function FitnessRoute() {
  usePageMeta(FITNESS_META)
  return (
    // As in the original app: movement is turned off for visitors who prefer reduced motion.
    <MotionConfig reducedMotion="user">
      <FitnessPage />
    </MotionConfig>
  )
}
