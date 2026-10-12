import { motion, useReducedMotion } from 'motion/react'

// Decorative "learning journey" linework: fine teal paths with a few nodes, drawn once when they scroll
// into view. It only ever sits BEHIND content (absolute, z-index 0, pointer-events none, aria-hidden) and is
// clipped to its own box, so it cannot add horizontal scroll or intercept clicks. With reduced motion the
// final drawing is rendered at once. The paths keep to the edges of their section so they do not cross
// headings, buttons or media.
//
//   variant  hero   the large composition in the Eduyarp hero (right side and top edge)
//            band   a thin wave that straddles the boundary between two sections
//            corner a calmer corner motif for the catalogue hero and the closing call to action
//   tone     dark (on ink backgrounds) | light (on white or mint)
const SETS = {
  hero: {
    viewBox: '0 0 1200 640',
    fit: 'xMidYMid slice',
    paths: [
      'M560 670 C 620 520, 720 470, 800 400 S 980 300, 1060 180 S 1180 40, 1270 20',
      'M700 670 C 760 580, 900 560, 980 500 S 1130 420, 1270 440',
      'M820 -20 C 860 60, 960 90, 1040 60',
    ],
    nodes: [
      [800, 400],
      [1060, 180],
      [980, 500],
      [1040, 60],
    ],
  },
  band: {
    viewBox: '0 0 1200 90',
    fit: 'none',
    paths: ['M-20 46 C 160 90, 320 0, 520 40 S 860 84, 1000 30 S 1180 10, 1240 36'],
    nodes: [
      [520, 40],
      [1000, 30],
    ],
  },
  corner: {
    viewBox: '0 0 600 300',
    fit: 'xMaxYMid slice',
    paths: ['M620 20 C 520 40, 480 120, 400 140 S 260 120, 200 220 S 80 300, -20 290', 'M620 120 C 560 130, 520 200, 470 210 S 380 250, 330 300'],
    nodes: [
      [400, 140],
      [200, 220],
      [470, 210],
    ],
  },
}

export function Linework({ variant = 'hero', tone = 'dark', className = '' }) {
  const reduce = useReducedMotion()
  const set = SETS[variant]
  const draw = (delay) =>
    reduce
      ? {}
      : {
          initial: { pathLength: 0, opacity: 0 },
          whileInView: { pathLength: 1, opacity: 1 },
          viewport: { once: true, margin: '0px 0px -10% 0px' },
          transition: { duration: 1.6, delay, ease: [0.22, 1, 0.36, 1] },
        }
  const appear = (delay) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, scale: 0.4 },
          whileInView: { opacity: 1, scale: 1 },
          viewport: { once: true, margin: '0px 0px -10% 0px' },
          transition: { duration: 0.4, delay, ease: 'easeOut' },
        }

  return (
    <svg
      className={`linework linework--${variant} linework--${tone}${className ? ` ${className}` : ''}`}
      viewBox={set.viewBox}
      preserveAspectRatio={set.fit}
      aria-hidden="true"
      focusable="false"
    >
      {set.paths.map((d, index) => (
        <motion.path
          key={d}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          {...draw(index * 0.18)}
        />
      ))}
      {set.nodes.map(([cx, cy], index) => (
        <g key={`${cx}-${cy}`}>
          <motion.circle cx={cx} cy={cy} r="9" fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" {...appear(0.9 + index * 0.15)} />
          <motion.circle cx={cx} cy={cy} r="3.2" fill="currentColor" {...appear(1 + index * 0.15)} />
        </g>
      ))}
    </svg>
  )
}

// The hero's lower edge: a gentle curve in the colour of the next section, with a thin line riding it, so
// the hero flows into the page instead of ending in a straight cut.
export function HeroDivider() {
  return (
    <svg className="hero-divider" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M0 90 V52 C 240 6, 480 0, 720 28 S 1200 84, 1440 30 V90 Z" className="hero-divider__fill" />
      <path d="M0 52 C 240 6, 480 0, 720 28 S 1200 84, 1440 30" className="hero-divider__line" fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

// A four-node journey under the hero player: two modules done, one in progress, one ahead.
export function HeroJourney() {
  const reduce = useReducedMotion()
  const nodes = [
    { x: 30, y: 62, state: 'done' },
    { x: 140, y: 30, state: 'done' },
    { x: 250, y: 58, state: 'now' },
    { x: 360, y: 24, state: 'next' },
  ]
  const path = 'M30 62 C 80 62, 90 30, 140 30 S 200 58, 250 58 S 310 24, 360 24'
  return (
    <svg className="hero-journey" viewBox="0 0 390 90" aria-hidden="true" focusable="false">
      <path d={path} fill="none" stroke="rgba(205,238,228,0.22)" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 7" />
      <motion.path
        d="M30 62 C 80 62, 90 30, 140 30 S 200 58, 250 58"
        fill="none"
        stroke="#5eead4"
        strokeWidth="2.2"
        strokeLinecap="round"
        {...(reduce ? {} : { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 1.4, delay: 0.7, ease: [0.22, 1, 0.36, 1] } })}
      />
      {nodes.map((n, i) => (
        <motion.g key={i} {...(reduce ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: 0.8 + i * 0.25, duration: 0.3 } })}>
          <circle cx={n.x} cy={n.y} r="11" fill={n.state === 'done' ? '#16c06f' : 'rgba(11,18,48,0.7)'} stroke={n.state === 'next' ? 'rgba(205,238,228,0.4)' : '#5eead4'} strokeWidth="1.5" />
          {n.state === 'done' ? (
            <path d={`M${n.x - 4} ${n.y} l3 3 l5 -6`} fill="none" stroke="#06231f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <text x={n.x} y={n.y + 3.6} textAnchor="middle" fontSize="10" fontWeight="700" fill={n.state === 'now' ? '#5eead4' : 'rgba(205,238,228,0.6)'}>
              {i + 1}
            </text>
          )}
        </motion.g>
      ))}
    </svg>
  )
}
