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
  { href: '/explore', label: 'Explore', icon: Icon.pin },
  { href: '/experiences', label: 'Experiences', icon: Icon.users },
  { href: '/travel', label: 'Travel', icon: Icon.compass },
  // Impact stays one tap away in the header menu and on the homepage.
  { href: '/account', label: 'Me', icon: Icon.user },
];

// Screens with their own pinned bottom action, or their own navigation.
// `/trips/` with the trailing slash matches trip detail (where the booking bar
// lives) without matching `/trips` itself.
const HIDDEN_PREFIXES = ['/book', '/organizer', '/admin', '/account/groups/', '/trips/', '/travel/'];

/** Whether the tab bar shows on this route for this account type. */
function useTabBarVisible(): boolean {
  const pathname = usePathname();
  const { user } = useSession();

  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return false;
  if (user && user.role === 'ORGANIZER') return false;
  return true;
}

export function MobileTabBar() {
  const pathname = usePathname();
  const visible = useTabBarVisible();

  if (!visible) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-acacia-700/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
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
                  'flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 truncate px-0.5 text-[0.625rem] font-semibold tracking-wide transition-colors',
                  active ? 'text-clay-400' : 'text-white/65',
                )}
              >
                <TabIcon size={19} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Matching spacer so page content is never hidden behind the bar — and no dead
 * space is left on the screens where the bar does not render.
 */
export function MobileTabBarSpacer() {
  const visible = useTabBarVisible();
  if (!visible) return null;
  return <div className="h-[calc(3.5rem+env(safe-area-inset-bottom))] bg-[#030b17] md:hidden" aria-hidden="true" />;
}
