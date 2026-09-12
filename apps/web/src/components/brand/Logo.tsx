import type { CSSProperties } from 'react';

/**
 * The Enhakkore mark.
 *
 * The name comes from a spring — a source. The emblem reads as ripples moving
 * out from a point, with one line leaving the centre and travelling beyond
 * them: a journey that starts at a source and carries outward. It is three
 * elements only, so it survives being rendered at 16px as a favicon or cropped
 * into a circle as an avatar.
 *
 * Geometry is fixed on a 32×32 grid. The ripple arcs are open toward the upper
 * right; the travelling stroke leaves through that opening.
 */

interface MarkProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

export function EnhakkoreMark({ size = 32, className, style, title }: MarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      style={style}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer ripple */}
      <path
        d="M18.98 4.89A11.5 11.5 0 1 0 27.33 14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.34"
      />
      {/* Inner ripple */}
      <path
        d="M17.81 9.24A7 7 0 1 0 22.89 14.78"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.62"
      />
      {/* The journey: leaves the source and passes through the opening */}
      <path
        d="M16 16C19.6 15.2 22.6 12.4 26.6 6.1"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {/* The source */}
      <circle cx="16" cy="16" r="2.7" fill="currentColor" />
    </svg>
  );
}

interface LogoProps {
  /** `full` pairs the mark with the wordmark; `mark` is the emblem alone. */
  variant?: 'full' | 'mark';
  /** Adds the TRAVEL & IMPACT descriptor beneath the wordmark. */
  withDescriptor?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Inverts to white for use over photography. */
  inverted?: boolean;
}

const SIZES = {
  sm: { mark: 24, word: 'text-[0.95rem]', descriptor: 'text-[0.5rem]', gap: 'gap-2' },
  md: { mark: 30, word: 'text-[1.15rem]', descriptor: 'text-[0.55rem]', gap: 'gap-2.5' },
  lg: { mark: 44, word: 'text-[1.7rem]', descriptor: 'text-[0.7rem]', gap: 'gap-3.5' },
} as const;

export function Logo({
  variant = 'full',
  withDescriptor = false,
  size = 'md',
  className = '',
  inverted = false,
}: LogoProps) {
  const scale = SIZES[size];
  const tone = inverted ? 'text-white' : 'text-acacia-700';

  if (variant === 'mark') {
    return <EnhakkoreMark size={scale.mark} className={`${tone} ${className}`} title="Enhakkore" />;
  }

  return (
    <span className={`inline-flex items-center ${scale.gap} ${className}`}>
      <EnhakkoreMark size={scale.mark} className={tone} title="Enhakkore" />
      <span className="flex flex-col leading-none">
        <span
          className={`${scale.word} font-bold tracking-[0.14em] ${inverted ? 'text-white' : 'text-ink'}`}
        >
          ENHAKKORE
        </span>
        {withDescriptor && (
          <span
            className={`${scale.descriptor} mt-1 font-semibold tracking-[0.28em] ${
              inverted ? 'text-white/65' : 'text-ink-muted'
            }`}
          >
            TRAVEL &amp; IMPACT
          </span>
        )}
      </span>
    </span>
  );
}
