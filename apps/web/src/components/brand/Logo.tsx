import Image from 'next/image';
import type { CSSProperties } from 'react';

/**
 * The Enhakkore mark — the supplied artwork, not a drawing of it.
 *
 * The emblem is the top of the full logo, cropped from the file provided, so
 * the letterform, the orbit, the globe and the aircraft keep the shapes they
 * were designed with. Two colourways are generated from that one artwork:
 * forest green with a champagne-gold orbit for light grounds, and warm beige
 * with the same gold for dark ones. The E is never gold.
 *
 * A third, single-colour charcoal version lives at
 * /partners/enhakkore-mark-mono.webp for print.
 *
 * The full logo, wordmark and descriptor included, lives at
 * /partners/enhakkore-wordmark.webp and is used where there is room for it.
 */

const MARK = '/partners/enhakkore-mark.webp';
/** The same mark in cream, for dark surfaces. Not a tint — a second artwork. */
const MARK_LIGHT = '/partners/enhakkore-mark.webp';
/** Intrinsic proportions of the cropped emblem. */
const MARK_RATIO = 300 / 155;

interface MarkProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
  /** Use the cream artwork, for dark backgrounds. */
  light?: boolean;
}

export function EnhakkoreMark({ size = 32, className, style, title, light = false }: MarkProps) {
  return (
    <Image
      src={light ? MARK_LIGHT : MARK}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      width={Math.round(size * MARK_RATIO)}
      height={size}
      className={className}
      style={{ height: size, width: 'auto', ...style }}
      priority
    />
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

/**
 * The wordmark shrinks on small screens. It has to: "ENHAKKORE | WSC" set at
 * the desktop size is 307px wide, which on a 375px phone pushed the whole
 * document wider than the screen and let the page be dragged sideways.
 */
const SIZES = {
  sm: {
    mark: 22,
    word: 'text-[0.8125rem] tracking-[0.08em] sm:text-[0.95rem] sm:tracking-[0.14em]',
    descriptor: 'text-[0.5rem]',
    gap: 'gap-2',
  },
  md: {
    mark: 26,
    word: 'text-[0.8125rem] tracking-[0.08em] sm:text-[1.15rem] sm:tracking-[0.14em]',
    descriptor: 'text-[0.55rem]',
    gap: 'gap-2 sm:gap-2.5',
  },
  lg: {
    mark: 36,
    word: 'text-[1.125rem] tracking-[0.1em] sm:text-[1.7rem] sm:tracking-[0.14em]',
    descriptor: 'text-[0.625rem] sm:text-[0.7rem]',
    gap: 'gap-2.5 sm:gap-3.5',
  },
} as const;

/**
 * The original Enhakkore logo, exactly as supplied — used everywhere the
 * site shows the brand. Navy artwork, so on a dark ground (`inverted`) it sits
 * on a small cream plate rather than being recoloured.
 */
export function Logo({ size = 'md', className = '', inverted = false }: LogoProps) {
  const height = size === 'sm' ? 40 : size === 'md' ? 52 : 84;
  const image = (
    <Image
      src="/partners/enhakkore-wordmark.webp"
      alt="Enhakkore Travel & Impact"
      width={Math.round((height * 640) / 500)}
      height={height}
      priority
      style={{ height, width: 'auto' }}
    />
  );
  return inverted ? (
    <span className={`inline-flex rounded-lg bg-[#f8f4ec] p-1 ${className}`}>{image}</span>
  ) : (
    <span className={`inline-flex ${className}`}>{image}</span>
  );
}
