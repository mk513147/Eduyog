// A compact circular progress indicator. The number is always written out as text as well; the ring is a
// visual summary only (aria-hidden), so nothing depends on colour or on the drawing.
export function ProgressRing({ percent, size = 76, stroke = 7 }) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const value = Math.max(0, Math.min(100, percent))
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
        <circle className="ring__track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
        <circle
          className="ring__value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="ring__label">{value}%</span>
    </div>
  )
}
