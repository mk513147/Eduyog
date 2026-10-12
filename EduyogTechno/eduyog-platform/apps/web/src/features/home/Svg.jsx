// Outline icon used across the homepage: 24x24 viewBox, currentColor stroke, decorative.
export function StrokeIcon({ d, size, strokeWidth = 1.8, children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {d ? <path d={d} /> : children}
    </svg>
  )
}

export function ArrowIcon() {
  return <StrokeIcon d="M5 12h14M13 6l6 6-6 6" size={18} strokeWidth={2} />
}
