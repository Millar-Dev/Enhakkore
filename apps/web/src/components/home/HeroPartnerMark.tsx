import Image from 'next/image';
import Link from 'next/link';
import { PARTNER } from '@/components/brand/Partner';

/**
 * WSC's mark at the foot of the hero.
 *
 * Enhakkore's logo holds the top of the page; this sits at the bottom of the
 * same hero, so the two are never read as a pair of badges side by side. It is
 * not labelled as an outside partner — WSC is the impact side of what we do,
 * not a sponsor bolted on.
 *
 * No card and no tile: the ivory artwork sits straight on the photograph, with
 * a faint shadow only so the strapline survives a pale frame of video. The
 * width is a clamp, so it fits every screen between a small phone and a wide
 * desktop without a breakpoint for each, and it steps out of the way entirely
 * on short screens where the headline needs the height.
 */
export function HeroPartnerMark() {
  return (
    <Link
      href="/impact"
      aria-label={`${PARTNER.fullName} — see the impact work`}
      className="group hidden [@media(min-height:560px)]:block"
    >
      <Image
        src={PARTNER.logoLight}
        alt={`${PARTNER.fullName} logo`}
        width={200}
        height={113}
        className="h-auto opacity-90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] transition-opacity duration-300 group-hover:opacity-100"
        style={{ width: 'clamp(4.5rem, 8vw, 7rem)' }}
      />
    </Link>
  );
}
