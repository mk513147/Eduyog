// Small inline stroke icons (24px grid) so no icon package is needed.
const PATHS = {
  overview: 'M4 13h6V4H4zm10 7h6V11h-6zM4 20h6v-4H4zm10-11h6V4h-6z',
  platforms:
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-9 9h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z',
  services: 'M4 7h16M4 12h16M4 17h10',
  users:
    'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm10 8v-1.5a3.5 3.5 0 0 0-2.6-3.4M15 4.1a3.5 3.5 0 0 1 0 6.8',
  leads: 'M4 5h16v14H4zM4 7l8 6 8-6',
  logout: 'M15 17l5-5-5-5M20 12H9M12 20H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  courses: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zm0 16V5M8 7h7',
  trainers: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1M16 4l2 2 3-3',
  enrolments: 'M9 5h10v15H5V9zM9 5v4H5M9 13h6M9 16h4',
  classes: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  back: 'M19 12H5M11 6l-6 6 6 6',
  activity: 'M3 12h4l3-8 4 16 3-8h4',
  alert: 'M12 4l9 16H3zM12 10v4M12 17v.5',
  arrow: 'M5 12h14M13 6l6 6-6 6',
}

export function Icon({ name, size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
