import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '@/components/ui';
import { MKURANGA } from '@/content/mkuranga';

/**
 * Travel with Purpose — the charity card beside the trips.
 *
 * Placed level with the featured departures rather than in a section further
 * down, because that is the claim: the travel and the community work are the
 * same undertaking. Giving it equal weight on the row is the argument.
 *
 * The photograph is from Mkuranga — a day that actually happened — rather than
 * a stock picture of children, which is the difference between showing your
 * work and borrowing someone else's.
 */
export function PurposeCard() {
  return (
    <Link
      href={`/impact/${MKURANGA.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-clay-100 bg-clay-50 transition-transform duration-300 hover:-translate-y-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-clay-400/30"
    >
      <div className="p-6 md:p-7">
        <span className="grid h-11 w-11 place-items-center rounded-[var(--radius-field)] bg-clay-400 text-acacia-600">
          <Icon.heart size={20} />
        </span>

        <h3 className="mt-5 text-[1.5rem] font-extrabold leading-tight tracking-[-0.02em] text-acacia-600">
          Travel with Purpose
        </h3>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
          Your journey helps us get back out to communities like Hoyoyo. See what that looked like on the
          day — and how to be part of the next one.
        </p>

        <span className="mt-6 inline-flex items-center gap-2 rounded-[var(--radius-field)] bg-clay-400 px-5 py-3 text-[0.875rem] font-bold text-acacia-600 transition-colors duration-200 group-hover:bg-clay-500 group-hover:text-white">
          Explore the work
          <Icon.arrow />
        </span>
      </div>

      <div className="relative mt-auto aspect-[16/10] w-full overflow-hidden">
        <Image
          src={MKURANGA.cover.src}
          alt={MKURANGA.cover.alt}
          fill
          sizes="(max-width: 1024px) 100vw, 22rem"
          loading="lazy"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
      </div>
    </Link>
  );
}
