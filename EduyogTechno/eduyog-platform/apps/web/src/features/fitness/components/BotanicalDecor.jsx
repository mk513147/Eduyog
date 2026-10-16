// Small Fitness-only botanical SVGs used as decorative background artwork.
export function BotanicalDecor({ variant = 'sprig', className = '' }) {
  return (
    <svg
      className={`fitness-botanical fitness-botanical--${variant} ${className}`.trim()}
      viewBox="0 0 240 300"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {variant === 'flow' ? (
        <g>
          <path d="M-14 226C44 208 37 162 93 151s73 15 116-30 37-83 65-103" />
          <path d="M-20 248c50-16 72-8 108-33 29-20 42-54 81-67 30-10 56-6 85-35" />
          <path d="M26 266c23-7 44-6 63-18" />
        </g>
      ) : variant === 'silhouette' ? (
        <g>
          <path d="M28 278C31 161 94 63 218 21c-8 121-69 220-190 257Z" fill="currentColor" />
          <path d="M36 272 205 31M82 206c-2-40-17-67-44-82M111 163c39-4 70-19 96-47M72 220c-1-31-11-53-30-67M137 124c29-4 51-15 69-32" />
        </g>
      ) : (
        <g>
          <path d="M24 278C69 229 102 170 132 92c23-59 54-78 85-81" />
          <path d="M74 219c-43-6-64-32-67-77 45 6 70 33 67 77ZM103 161c-7-43 9-73 49-91 8 43-8 73-49 91ZM130 104c-5-35 9-59 42-73 6 34-8 59-42 73ZM48 252c-34 0-55-17-64-51 34 0 56 17 64 51ZM157 63c-2-28 10-47 37-58 3 28-9 47-37 58Z" />
          <path d="M91 191c-30-13-43-37-38-72 31 14 43 38 38 72ZM121 130c-28-17-37-42-27-76 28 18 37 43 27 76Z" />
        </g>
      )}
    </svg>
  )
}
