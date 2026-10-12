import { useRef } from 'react'
import { useFocusMainOnNavigation } from '../../router/useFocusMainOnNavigation'
import { About } from './components/About'
import { Approach } from './components/Approach'
import { Contact } from './components/Contact'
import { Footer } from './components/Footer'
import { Hero } from './components/Hero'
import { Navbar } from './components/Navbar'
import { Services } from './components/Services'

// Adapted from apps/fitness/src/App.jsx. The Fitness page keeps its own header and footer (its own
// brand and design); .fitness-site is the root every Fitness style is scoped to.
export default function FitnessPage() {
  const mainRef = useRef(null)
  useFocusMainOnNavigation(mainRef)

  return (
    <div className="fitness-site">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Navbar />
      <main id="main" ref={mainRef} tabIndex="-1">
        <Hero />
        <Services />
        <Approach />
        <About />
        <Contact />
      </main>
      <Footer />
    </div>
  )
}
