import Image from 'next/image';
import Link from 'next/link';
import { PARTNER } from '@/components/brand/Partner';

/**
 * WSC's mark in the hero, on the right, on its own.
 *
 * No card, no tile, no white box: the cream artwork sits directly on the
 * photograph, the way the Enhakkore mark does. A faint drop shadow is the only
 * thing added, and only so the strapline survives a pale frame of video.
 *
 * Sizing is fluid rather than stepped — a clamp between a floor that stays
 * legible on a small phone and a ceiling that stops it competing with the
 * headline — so it fits every viewport in between without a breakpoint for
 * each one. On short screens, where the headline needs every pixel of height,
 * it is dropped entirely.
 */
export function HeroPartnerMark() {
  return (
    <Link
      href="/impact"
      aria-label={`${PARTNER.fullName} — see our impact work`}
      className="group pointer-events-auto absolute right-4 top-24 z-10 hidden [@media(min-height:520px)]:block md:right-8 md:top-28 lg:right-12"
    >
      <span className="flex flex-col items-center gap-2 transition-transform duration-300 group-hover:-translate-y-0.5">
        <Image
          src={PARTNER.logoLight}
          alt={`${PARTNER.fullName} logo`}
          width={200}
          height={113}
          priority
          className="h-auto drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]"
          style={{ width: 'clamp(5rem, 10vw, 9rem)' }}
        />
        <span className="text-center text-[0.5625rem] font-semibold uppercase leading-tight tracking-[0.14em] text-white/75 drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)] md:text-[0.625rem]">
          Social impact partner
        </span>
      </span>
    </Link>
  );
}
