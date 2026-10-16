'use client';

import { useEffect, useRef, useState } from 'react';
import { cx } from '@/components/ui';

/**
 * Lifts its children into place the first time they come into view.
 *
 * Deliberately small: a short rise and fade, once, never repeated. Movement
 * should make a long page feel alive as you travel down it, not perform at the
 * reader. Anyone who has asked their system for less motion gets the content
 * immediately and completely still — and so does anyone without JavaScript,
 * because the visible state is the default and the animation only takes over
 * once the observer is actually running.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  /** Milliseconds, for staggering a row of cards. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(true);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    // Only hide once we know we can reveal it again.
    setArmed(true);
    setShown(node.getBoundingClientRect().top < window.innerHeight * 0.9);

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={armed ? { transitionDelay: `${delay}ms` } : undefined}
      className={cx(
        armed && 'transition-[opacity,transform] duration-700 ease-out',
        armed && !shown && 'translate-y-6 opacity-0',
        armed && shown && 'translate-y-0 opacity-100',
        className,
      )}
    >
      {children}
    </div>
  );
}
