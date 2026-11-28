/**
 * Nia's appearance: a holographic, atom-inspired orb — navy core, gold
 * orbital rings and a few glowing particles. No face. Pure SVG and CSS (no 3D
 * library), so it costs almost nothing to load; it moves faster while Nia is
 * thinking or speaking, and stays still for people who prefer reduced motion.
 */
export function NiaOrb({ size = 56, state = 'idle', className = '' }: { size?: number; state?: 'idle' | 'thinking' | 'speaking'; className?: string }) {
  const speed = state === 'idle' ? 18 : state === 'thinking' ? 4 : 7;
  return (
    <span className={`nia-orb relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }} aria-hidden data-state={state}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="overflow-visible">
        <defs>
          <radialGradient id="nia-core" cx="45%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#3b6ea8" />
            <stop offset="55%" stopColor="#0b2547" />
            <stop offset="100%" stopColor="#06152a" />
          </radialGradient>
          <radialGradient id="nia-glow" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="#d4a64a" stopOpacity="0" />
            <stop offset="100%" stopColor="#d4a64a" stopOpacity="0.35" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="49" fill="url(#nia-glow)" className={state !== 'idle' ? 'nia-pulse' : ''} />
        <circle cx="50" cy="50" r="22" fill="url(#nia-core)" stroke="#d4a64a" strokeOpacity="0.6" strokeWidth="1" />
        <circle cx="44" cy="43" r="6" fill="#ffffff" fillOpacity="0.18" />
        {[0, 60, 120].map((angle, index) => (
          <g key={angle} transform={`rotate(${angle} 50 50)`}>
            <ellipse cx="50" cy="50" rx="44" ry="15" fill="none" stroke="#e2bd6a" strokeOpacity="0.8" strokeWidth="1.4" />
            <circle r="3.2" fill="#f4d78f" className="nia-electron" style={{ offsetPath: 'path("M 6 50 a 44 15 0 1 0 88 0 a 44 15 0 1 0 -88 0")', animationDuration: `${speed + index * 2}s`, animationDelay: `${-index * 1.3}s` }} />
          </g>
        ))}
      </svg>
    </span>
  );
}
