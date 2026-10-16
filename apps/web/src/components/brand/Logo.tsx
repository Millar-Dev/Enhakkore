import Image from 'next/image';
import type { CSSProperties } from 'react';

/**
 * The Enhakkore mark — the supplied artwork, not a drawing of it.
 *
 * The emblem is the top of the full logo, cropped and trimmed from the file
 * provided, so the letterform, the gold orbit, the globe and the aircraft are
 * exactly as they were designed. It is never recoloured: a navy and gold mark
 * cannot be turned white without becoming a different logo. Over photography
 * it sits on a small white tile instead, which keeps it legible and intact.
 *
 * The full logo, wordmark and descriptor included, lives at
 * /partners/enhakkore-wordmark.webp and is used where there is room for it.
 */

const MARK = '/partners/enhakkore-mark.webp';
/** The same mark in cream, for dark surfaces. Not a tint — a second artwork. */
const MARK_LIGHT = '/partners/enhakkore-mark-light.webp';
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

export function Logo({
  variant = 'full',
  withDescriptor = false,
  size = 'md',
  className = '',
  inverted = false,
}: LogoProps) {
  const scale = SIZES[size];

  if (variant === 'mark') {
    return (
      <span className={`inline-flex ${className}`}>
        <EnhakkoreMark size={scale.mark} title="Enhakkore" light={inverted} />
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center ${scale.gap} ${className}`}>
      <EnhakkoreMark size={scale.mark} title="Enhakkore" light={inverted} className="shrink-0" />
      <span className="flex min-w-0 flex-col leading-none">
        <span
          className={`${scale.word} flex items-center whitespace-nowrap font-bold ${
            inverted ? 'text-white' : 'text-ink'
          }`}
        >
          ENHAKKORE
          <span
            aria-hidden
            className={`mx-[0.45em] inline-block h-[1em] w-px ${inverted ? 'bg-white/35' : 'bg-line-strong'}`}
          />
          <span className={inverted ? 'text-white/80' : 'text-ink-muted'}>WSC</span>
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
