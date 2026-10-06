import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Code2,
  GraduationCap,
  Layers,
  LayoutGrid,
  LogOut,
  Menu,
  PlayCircle,
  Sparkles,
  Target,
  User,
  Users,
  Video,
  X,
} from 'lucide-react'

// One icon system (Lucide). Names are the ones used across the app.
const ICONS = {
  book: BookOpen,
  clock: Clock,
  level: BarChart3,
  user: User,
  users: Users,
  calendar: CalendarDays,
  video: Video,
  play: PlayCircle,
  check: Check,
  arrowRight: ArrowRight,
  arrowLeft: ArrowLeft,
  logout: LogOut,
  menu: Menu,
  close: X,
  target: Target,
  grid: LayoutGrid,
  layers: Layers,
  sparkles: Sparkles,
  code: Code2,
  cap: GraduationCap,
  chevronDown: ChevronDown,
}

export function Icon({ name, size = 18, className }) {
  const Component = ICONS[name]
  if (!Component) return null
  return <Component className={className} size={size} strokeWidth={2} aria-hidden="true" focusable="false" />
}
