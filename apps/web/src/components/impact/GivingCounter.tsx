'use client';

import { useEffect, useRef, useState } from 'react';
import type { Money } from '@enhakkore/shared';
import { DemoBadge, cx } from '@/components/ui';
import { price } from '@/lib/format';

/* ==========================================================================
   Giving so far
   --------------------------------------------------------------------------
   How many people have given, and how much. The figures count up once, when
   the panel first comes into view — movement that says "this is still
   growing" without animating forever in the corner of someone's eye.

   Anyone who has asked their system for less motion sees the final numbers
   immediately, and so does anyone without JavaScript, because the markup
   starts at the real value and only steps back once the animation takes over.
   ========================================================================== */

interface GivingCounterProps {
  /** Distinct people who have given — not the number of contributions. */
  donors: number;
  contributions: number;
  total: Money;
  isDemoData?: boolean;
  className?: string;
}

const DURATION = 1100;

/** Eases out, so the number slows as it lands rather than stopping dead. */
function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

function useCountUp(target: number, start: boolean): number {
  const [value, setValue] = useState(target);

  useEffect(() => {
    if (!start) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || target === 0) {
      setValue(target);
      return;
    }

    let frame = 0;
    const began = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - began) / DURATION);
      setValue(Math.round(target * easeOut(progress)));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, start]);

  return value;
}

export function GivingCounter({ donors, contributions, total, isDemoData, className }: GivingCounterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const shownDonors = useCountUp(donors, visible);
  const shownContributions = useCountUp(contributions, visible);
  const shownAmount = useCountUp(total.amount, visible);

  return (
    <div
      ref={ref}
      className={cx(
        'rounded-[var(--radius-card)] border border-line bg-white p-6 md:p-8',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          Giving so far
        </h2>
        {isDemoData && <DemoBadge label="Demonstration figures" />}
      </div>

      <dl className="mt-5 grid gap-6 sm:grid-cols-3">
        <div>
          <dd className="text-[2rem] font-bold leading-none tracking-tight text-clay-600 md:text-[2.5rem] tabular-nums">
            {price({ amount: shownAmount, currency: total.currency }, true)}
          </dd>
          <dt className="mt-2 text-[0.875rem] text-ink-muted">Given in total</dt>
        </div>
        <div>
          <dd className="text-[2rem] font-bold leading-none tracking-tight text-ink md:text-[2.5rem] tabular-nums">
            {shownDonors.toLocaleString('en-GB')}
          </dd>
          <dt className="mt-2 text-[0.875rem] text-ink-muted">
            {donors === 1 ? 'Person has given' : 'People have given'}
          </dt>
        </div>
        <div>
          <dd className="text-[2rem] font-bold leading-none tracking-tight text-ink md:text-[2.5rem] tabular-nums">
            {shownContributions.toLocaleString('en-GB')}
          </dd>
          <dt className="mt-2 text-[0.875rem] text-ink-muted">
            {contributions === 1 ? 'Contribution' : 'Contributions'}
          </dt>
        </div>
      </dl>

      <p className="mt-5 border-t border-line pt-4 text-[0.8125rem] leading-relaxed text-ink-muted">
        Counted from contributions whose payment succeeded. Every figure is calculated from the records
        themselves — none of it is typed in by hand.
      </p>
    </div>
  );
}
