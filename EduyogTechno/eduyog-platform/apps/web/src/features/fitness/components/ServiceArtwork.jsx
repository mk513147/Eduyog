export function ServiceArtwork({ variant, src, alt, width, height }) {
  return (
    <div className={`service-card__media service-card__media--${variant}`}>
      <img
        className="service-card__image"
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
      />
    </div>
  )
}
