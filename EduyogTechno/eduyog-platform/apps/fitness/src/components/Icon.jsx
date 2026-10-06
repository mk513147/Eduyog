import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  Heart,
  Info,
  Menu,
  Target,
  Users,
  X,
} from 'lucide-react'

// One icon system (Lucide). Decorative by default.
const ICONS = {
  menu: Menu,
  close: X,
  'arrow-right': ArrowRight,
  'arrow-left': ArrowLeft,
  building: Building2,
  activity: Activity,
  users: Users,
  target: Target,
  calendar: CalendarDays,
  heart: Heart,
  check: Check,
  info: Info,
}

export function Icon({ name, size = 20, className }) {
  const Component = ICONS[name]
  if (!Component) return null
  return <Component className={className} size={size} strokeWidth={1.9} aria-hidden="true" focusable="false" />
}
