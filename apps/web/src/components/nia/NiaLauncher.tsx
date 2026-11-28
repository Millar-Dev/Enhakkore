'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NiaOrb } from './NiaOrb';

/**
 * The small Nia button. It only links to /nia, so no chat code loads on
 * ordinary pages. Hidden on Nia's own page, the admin area and checkout-like
 * forms where it could get in the way.
 */
export function NiaLauncher() {
  const pathname = usePathname();
  if (pathname.startsWith('/nia') || pathname.startsWith('/admin') || pathname.startsWith('/join') || pathname.startsWith('/signin')) return null;
  return (
    <Link
      href="/nia"
      aria-label="Ask Nia, the Enhakkore assistant"
      title="Ask Nia"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] left-3 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#06152a] shadow-[0_8px_24px_rgba(6,21,42,0.35)] ring-1 ring-[#d4a64a]/40 transition-transform hover:scale-105 md:bottom-6 md:left-6"
    >
      <NiaOrb size={44} />
    </Link>
  );
}
