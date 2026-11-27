'use client';

import { useEffect, useRef, useState } from 'react';
import { SocialIcon } from './SocialIcon';

/**
 * The floating WhatsApp button on larger screens. It steps aside whenever a
 * form field or button would be underneath it, so it never covers a control.
 */
export function FloatingWhatsApp({ href, label }: { href: string; label: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const button = ref.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      if (rect.width === 0) return;
      const pad = 12;
      const points: [number, number][] = [
        [rect.left - pad, rect.top - pad],
        [rect.right, rect.top - pad],
        [rect.left - pad, rect.bottom],
        [rect.left + rect.width / 2, rect.top + rect.height / 2],
        [rect.right, rect.bottom],
      ];
      const covers = points.some(([x, y]) =>
        document.elementsFromPoint(Math.max(0, x), Math.max(0, y)).some((el) => el !== button && !button.contains(el) && el.closest('input, textarea, select, button, form label')),
      );
      setHidden(covers);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <a
      ref={ref}
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={label}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      className={`fixed bottom-6 right-6 z-40 hidden h-14 w-14 items-center justify-center rounded-full bg-[#1f9d55] text-white shadow-[0_10px_30px_-8px_rgba(0,0,0,0.45)] transition duration-200 hover:scale-105 md:inline-flex ${hidden ? 'pointer-events-none translate-y-4 opacity-0' : ''}`}
    >
      <SocialIcon platform="whatsapp" size={28} />
    </a>
  );
}
