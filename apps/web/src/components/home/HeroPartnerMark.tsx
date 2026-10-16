import Image from 'next/image';
import Link from 'next/link';
import { PARTNER } from '@/components/brand/Partner';

/**
 * WSC's mark in the hero, on the right, on its own.
 *
 * Not paired with the Enhakkore logo and not competing with the headline — it
 * sits in the opposite corner, which reads as "with" rather than "by".
 *
 * Sizing is fluid rather than stepped: the width is a clamp between a floor
 * that stays legible on a small phone and a ceiling that stops it dominating a
 * wide screen, so it fits every viewport in between without a breakpoint for
 * each one. On short screens — a phone held in landscape — it is dropped
 * entirely, because there the headline needs every pixel of height.
 */
export function HeroPartnerMark() {
  return (
    <Link
      href="/impact"
      aria-label={`${PARTNER.fullName} — see our impact work`}
      className="group pointer-events-auto absolute right-4 top-24 z-10 hidden [@media(min-height:520px)]:block md:right-8 md:top-28 lg:right-12"
    >
      <span className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] bg-white/92 px-3 py-3 shadow-lg backdrop-blur-md transition-transform duration-300 group-hover:-translate-y-0.5 md:px-4 md:py-4">
        <Image
          src={PARTNER.logo}
          alt={`${PARTNER.fullName} logo`}
          width={180}
          height={102}
          priority
          className="h-auto"
          style={{ width: 'clamp(4.5rem, 9vw, 8rem)' }}
        />
        <span className="text-center text-[0.5625rem] font-semibold uppercase leading-tight tracking-[0.1em] text-ink-muted md:text-[0.625rem]">
          Social impact
          <br />
          partner
        </span>
      </span>
    </Link>
  );
}
