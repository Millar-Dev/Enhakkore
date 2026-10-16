import Image from 'next/image';
import { cx } from '@/components/ui';

/**
 * The Enhakkore × WSC partnership lockup.
 *
 * One definition of both marks, their order and the wording, used in the
 * heroes, on the impact pages, beside the contribution form and on the Arusha
 * package. Changing partner — or adding a second — is a change here and
 * nowhere else.
 *
 * Neither logo is recoloured, stretched or placed on a busy background: both
 * sit together on their own white surface, which is the respectful thing to do
 * with supplied artwork and the only way navy marks stay legible over a
 * photograph. They are sized by height so the two read as equals rather than
 * one dominating by accident of its proportions.
 */

export const PARTNER = {
  name: 'WSC',
  fullName: 'WSC — We Save Children Charity Group',
  tagline: 'No child deserves to grow up in poverty',
  logo: '/partners/wsc.webp',
  /** The same mark in cream, for dark surfaces. Not a tint — a second artwork. */
  logoLight: '/partners/wsc-light.webp',
  /** Set this once WSC have a page to link to. */
  href: null as string | null,
};

export const BRAND = {
  name: 'Enhakkore Travel & Impact',
  logo: '/partners/enhakkore-wordmark.webp',
  /** The emblem in cream, for dark surfaces. */
  logoLight: '/partners/enhakkore-mark-light.webp',
};

/** Rendered heights, in pixels, for each lockup size. */
const SIZES = {
  sm: { wsc: 30, brand: 40, gap: 'gap-3', pad: 'px-4 py-2.5' },
  md: { wsc: 38, brand: 52, gap: 'gap-4', pad: 'px-5 py-3' },
  lg: { wsc: 52, brand: 70, gap: 'gap-5', pad: 'px-6 py-4' },
} as const;

/** The WSC mark alone. `light` selects the cream artwork, for dark surfaces. */
export function PartnerLogo({
  height = 38,
  className,
  light = false,
}: {
  height?: number;
  className?: string;
  light?: boolean;
}) {
  return (
    <Image
      src={light ? PARTNER.logoLight : PARTNER.logo}
      alt={`${PARTNER.fullName} logo`}
      width={Math.round((height * 512) / 289)}
      height={height}
      className={cx('w-auto', className)}
      style={{ height, width: 'auto' }}
    />
  );
}

/** The Enhakkore mark alone. `light` selects the cream artwork. */
export function BrandLogo({
  height = 52,
  className,
  light = false,
}: {
  height?: number;
  className?: string;
  light?: boolean;
}) {
  return (
    <Image
      src={light ? BRAND.logoLight : BRAND.logo}
      alt={`${BRAND.name} logo`}
      width={Math.round((height * 640) / 500)}
      height={height}
      className={cx('w-auto', className)}
      style={{ height, width: 'auto' }}
    />
  );
}

/**
 * Both marks together, WSC first, joined by a multiplication sign — the
 * convention for a collaboration between equals. On a white surface so it can
 * sit over a photograph or a dark section without either logo being altered.
 */
export function PartnershipLockup({
  size = 'md',
  className,
  tone = 'dark',
}: {
  size?: keyof typeof SIZES;
  className?: string;
  /**
   * `light` uses the cream artworks, for dark backgrounds. Neither tone puts
   * the marks on a card — a logo in a white box looks like a picture someone
   * pasted on, which is the opposite of what a brand mark should look like.
   */
  tone?: 'light' | 'dark';
}) {
  const s = SIZES[size];
  const light = tone === 'light';
  return (
    <div className={cx('inline-flex items-center', s.gap, className)}>
      <PartnerLogo height={s.wsc} light={light} />
      <span
        aria-hidden
        className={cx(
          'select-none text-[1.125rem] font-light leading-none',
          light ? 'text-gold-300/80' : 'text-gold-500/80',
        )}
      >
        ×
      </span>
      <BrandLogo height={s.brand} light={light} />
      <span className="sr-only">
        {PARTNER.fullName} and {BRAND.name}
      </span>
    </div>
  );
}

/**
 * The fuller form, where someone deciding whether to give or to book deserves
 * to see who they are doing it alongside.
 */
export function PartnerCard({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div
      className={cx(
        'flex flex-col items-start gap-5 rounded-[var(--radius-card)] border border-line bg-white p-6 sm:flex-row sm:items-center sm:gap-7',
        className,
      )}
    >
      <PartnershipLockup size="lg" className="shrink-0" />
      <div className="min-w-0">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          Why we travel
        </p>
        <p className="mt-1.5 text-[1.0625rem] font-bold leading-snug tracking-tight text-ink">
          {PARTNER.tagline}
        </p>
        {children && <div className="mt-2 text-[0.875rem] leading-relaxed text-ink-muted">{children}</div>}
      </div>
    </div>
  );
}
