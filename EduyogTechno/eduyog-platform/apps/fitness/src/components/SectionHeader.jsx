export function SectionHeader({ id, eyebrow, title, text, align = 'center' }) {
  return (
    <div className={`section-header section-header--${align}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="section-title" id={id}>
        {title}
      </h2>
      {text && <p className="section-text">{text}</p>}
    </div>
  )
}
