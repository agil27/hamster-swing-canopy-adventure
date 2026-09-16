/** Decorative hamster-in-a-ball used on the title card and the modals. */
export default function HamsterMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <defs>
        <radialGradient id="markFur" cx="38%" cy="32%" r="72%">
          <stop offset="0%" stopColor="#fff1d4" />
          <stop offset="55%" stopColor="#f7d9a8" />
          <stop offset="100%" stopColor="#e0b183" />
        </radialGradient>
        <radialGradient id="markGlass" cx="34%" cy="28%" r="76%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.75)" />
          <stop offset="55%" stopColor="rgba(190,232,255,0.2)" />
          <stop offset="100%" stopColor="rgba(150,205,255,0.45)" />
        </radialGradient>
        <radialGradient id="markGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,236,170,0.85)" />
          <stop offset="100%" stopColor="rgba(255,214,102,0)" />
        </radialGradient>
      </defs>

      <circle cx="60" cy="60" r="58" fill="url(#markGlow)" />

      {/* Ears */}
      <ellipse cx="46" cy="33" rx="9" ry="10" fill="#d8a878" transform="rotate(-16 46 33)" />
      <ellipse cx="46" cy="34" rx="5" ry="6" fill="#ffc9c0" transform="rotate(-16 46 34)" />
      <ellipse cx="72" cy="31" rx="9" ry="10" fill="#d8a878" transform="rotate(14 72 31)" />
      <ellipse cx="72" cy="32" rx="5" ry="6" fill="#ffc9c0" transform="rotate(14 72 32)" />

      {/* Body */}
      <ellipse cx="60" cy="62" rx="30" ry="28" fill="url(#markFur)" />
      <ellipse cx="62" cy="72" rx="20" ry="16" fill="rgba(255,248,232,0.95)" />
      <ellipse cx="70" cy="66" rx="14" ry="11" fill="#fff7e8" />

      {/* Cheeks */}
      <ellipse cx="82" cy="70" rx="7" ry="5" fill="rgba(255,155,165,0.6)" />
      <ellipse cx="45" cy="68" rx="7" ry="5" fill="rgba(255,155,165,0.6)" />

      {/* Eyes */}
      <ellipse cx="52" cy="54" rx="6" ry="7.4" fill="#2a1c14" />
      <ellipse cx="72" cy="53" rx="6" ry="7.4" fill="#2a1c14" />
      <circle cx="54.4" cy="51" r="2.4" fill="#fff" />
      <circle cx="74.4" cy="50" r="2.4" fill="#fff" />

      {/* Nose + mouth */}
      <path d="M62 62h6l-3 4.4z" fill="#ff8fa0" />
      <path d="M65 67q-3.4 3.6-6.4 1.4M65 67q3.4 3.4 6 .6" fill="none" stroke="#8a5a3a" strokeWidth="2" strokeLinecap="round" />

      {/* Whiskers */}
      <g stroke="rgba(120,80,50,0.5)" strokeWidth="1.6" strokeLinecap="round">
        <path d="M78 62l16-3M78 66l16 2M42 63l-16-4M42 67l-16 3" />
      </g>

      {/* Glass ball */}
      <circle cx="60" cy="60" r="52" fill="url(#markGlass)" />
      <circle cx="60" cy="60" r="51" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="3" />
      <path d="M22 76a52 52 0 0 0 66 26" fill="none" stroke="rgba(255,214,150,0.6)" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="38" cy="34" rx="11" ry="7" fill="rgba(255,255,255,0.9)" transform="rotate(-38 38 34)" />
      <ellipse cx="50" cy="24" rx="4.5" ry="3" fill="rgba(255,255,255,0.9)" transform="rotate(-38 50 24)" />
    </svg>
  )
}
