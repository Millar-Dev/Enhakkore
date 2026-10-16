import Image from 'next/image';
import { cx } from '@/components/ui';

/**
 * The charity partner lockup.
 *
 * One definition of the partner's name, logo and wording, used in the hero, on
 * the impact pages and beside the contribution form. Changing partner — or
 * adding a second — is a change here and nowhere else.
 *
 * The logo is supplied artwork and is not recoloured, stretched or placed on a
 * busy background: it sits on its own white surface wherever it appears, which
 * is both the respectful thing to do with someone else's mark and the only way
 * a navy logo stays legible over a photograph.
 */

export const PARTNER = {
  name: 'WSC',
  fullName: 'WSC',
  tagline: 'No child deserves to grow up in poverty',
  logo: '/partners/wsc.webp',
  /** Set this once WSC have a page to link to. */
  href: null as string | null,
};

interface PartnerLogoProps {
  /** Rendered width in pixels; height follows the artwork. */
  width?: number;
  className?: string;
  priority?: boolean;
}

/** The mark alone, on white, at a fixed width. */
export function PartnerLogo({ width = 120, className, priority }: PartnerLogoProps) {
  return (
    <Image
      src={PARTNER.logo}
      alt={`${PARTNER.fullName} logo`}
      width={width}
      height={Math.round((width * 289) / 512)}
      priority={priority}
      className={cx('h-auto w-auto', className)}
      style={{ width, height: 'auto' }}
    />
  );
}

/**
 * The compact form for dark surfaces — a white pill carrying the logo, with a
 * line saying what the relationship is. Deliberately quiet: it belongs under
 * the headline, not competing with it.
 */
export function PartnerPill({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        'inline-flex items-center gap-3 rounded-[var(--radius-pill)] bg-white/95 py-2 pl-4 pr-3 shadow-sm backdrop-blur-md',
        className,
      )}
    >
      <span className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">
        In partnership with
      </span>
      <PartnerLogo width={86} />
    </div>
  );
}

/**
 * The fuller form, for the impact pages and beside the contribution form,
 * where someone deciding whether to give deserves to see who they are giving
 * alongside.
 */
export function PartnerCard({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div
      className={cx(
        'flex flex-col items-start gap-5 rounded-[var(--radius-card)] border border-line bg-white p-6 sm:flex-row sm:items-center sm:gap-7',
        className,
      )}
    >
      <PartnerLogo width={132} className="shrink-0" />
      <div className="min-w-0">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          Charity partner
        </p>
        <p className="mt-1.5 text-[1.0625rem] font-bold leading-snug tracking-tight text-ink">
          {PARTNER.tagline}
        </p>
        {children && <div className="mt-2 text-[0.875rem] leading-relaxed text-ink-muted">{children}</div>}
      </div>
    </div>
  );
}
