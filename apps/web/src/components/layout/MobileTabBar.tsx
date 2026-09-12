'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, cx } from '@/components/ui';
import { useSession } from '@/lib/session';

/**
 * Phone tab bar for travellers.
 *
 * Designed for the phone, not shrunk from the desktop nav: five destinations,
 * thumb-reachable, always visible while browsing. Hidden for organizer and
 * admin accounts, which have their own dashboard navigation, and on the
 * checkout and chat screens where it would compete with the primary action.
 */

const TABS = [
  { href: '/', label: 'Home', icon: Icon.home, exact: true },
  { href: '/trips', label: 'Explore', icon: Icon.compass },
  { href: '/account/trips', label: 'Trips', icon: Icon.ticket },
  { href: '/impact', label: 'Impact', icon: Icon.ripple },
  { href: '/account', label: 'Profile', icon: Icon.user, exact: true },
];

const HIDDEN_PREFIXES = ['/book', '/organizer', '/admin', '/account/groups/'];

export function MobileTabBar() {
  const pathname = usePathname();
  const { user } = useSession();

  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;
  if (user && user.role !== 'TRAVELER') return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      aria-label="Main"
    >
      <ul className="grid grid-cols-5">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          const TabIcon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex h-16 flex-col items-center justify-center gap-1 text-[0.625rem] font-semibold tracking-wide transition-colors',
                  active ? 'text-acacia-700' : 'text-ink-faint',
                )}
              >
                <TabIcon size={21} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Matching spacer so page content is never hidden behind the bar. */
export function MobileTabBarSpacer() {
  return <div className="h-16 md:hidden" aria-hidden="true" />;
}
