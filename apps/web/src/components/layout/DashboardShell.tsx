'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import type { Role } from '@enhakkore/shared';
import { Logo } from '@/components/brand/Logo';
import { MobileTabBar, MobileTabBarSpacer } from './MobileTabBar';
import { Avatar, Button, Skeleton, cx } from '@/components/ui';
import { useSession } from '@/lib/session';

export interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
}

/**
 * Shell for every signed-in area: traveller account, organizer workspace and
 * the admin console.
 *
 * It enforces the role gate on the client so a traveller never sees an admin
 * screen flash before the redirect. The API enforces the same rule
 * independently — this is convenience, not security.
 */
export function DashboardShell({
  children,
  nav,
  allow,
  title,
  action,
  wide = false,
}: {
  children: ReactNode;
  nav: NavItem[];
  allow: Role[];
  title?: string;
  action?: ReactNode;
  wide?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, organizer, status, signOut } = useSession();

  useEffect(() => {
    if (status === 'anonymous') {
      router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
    } else if (status === 'authenticated' && user && !allow.includes(user.role)) {
      router.replace('/');
    }
  }, [status, user, allow, router, pathname]);

  if (status !== 'authenticated' || !user || !allow.includes(user.role)) {
    return (
      <div className="min-h-screen bg-sand/40">
        <div className="shell py-16">
          <Skeleton className="h-8 w-48" />
          <div className="mt-8 grid gap-6 md:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-28" />
            ))}
          </div>
          <Skeleton className="mt-8 h-72" />
        </div>
      </div>
    );
  }

  const contextLabel =
    user.role === 'ADMIN' ? 'Admin console' : user.role === 'ORGANIZER' ? organizer?.companyName ?? 'Operator' : 'My account';

  return (
    <div className="min-h-screen bg-sand/40">
      {/* Phones: a compact dark bar — back, the page's name, sign out. */}
      <header className="sticky top-0 z-40 bg-[#06152a] pt-[env(safe-area-inset-top)] text-white md:hidden">
        <div className="shell grid h-14 grid-cols-[3rem_1fr_3rem] items-center">
          <Link href={pathname === '/account' ? '/' : '/account'} aria-label={pathname === '/account' ? 'Home' : 'Back to my account'} className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
          </Link>
          <p className="truncate text-center text-[0.9375rem] font-bold">{pathname === '/account' ? 'My account' : title ?? nav.find((item) => (item.exact ? pathname === item.href : pathname.startsWith(item.href)))?.label ?? contextLabel}</p>
          <button type="button" onClick={signOut} className="-mr-2 inline-flex h-11 items-center justify-end text-xs font-semibold text-white/70">Sign out</button>
        </div>
      </header>

      <header className="sticky top-0 z-40 hidden border-b border-line bg-white/95 backdrop-blur-xl md:block">
        <div className={cx(wide ? 'mx-auto w-full max-w-[96rem] px-5 md:px-8' : 'shell', 'flex h-16 items-center justify-between gap-4')}>
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/" aria-label="Enhakkore — home" className="shrink-0">
              <Logo size="sm" />
            </Link>
            <span className="hidden h-5 w-px bg-line sm:block" />
            <span className="hidden truncate text-[0.8125rem] font-semibold text-ink-muted sm:block">
              {contextLabel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/account"
              className="inline-flex items-center gap-2.5 rounded-[var(--radius-field)] px-2 py-1.5 transition-colors hover:bg-sand"
            >
              <Avatar name={user.name} src={user.avatarUrl} size="sm" />
              <span className="hidden text-[0.8125rem] font-semibold sm:block">{user.name}</span>
            </Link>
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>

        {/* Section nav scrolls horizontally rather than wrapping or collapsing. */}
        <nav
          className={cx(
            wide ? 'mx-auto w-full max-w-[96rem] px-5 md:px-8' : 'shell',
            'flex gap-1 overflow-x-auto no-scrollbar',
          )}
          aria-label="Section"
        >
          {nav.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'shrink-0 border-b-2 px-3.5 py-3 text-[0.875rem] font-semibold transition-colors',
                  active
                    ? 'border-ink text-ink'
                    : 'border-transparent text-ink-muted hover:text-ink',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main id="main" className={cx(wide ? 'mx-auto w-full max-w-[96rem] px-5 md:px-8' : 'shell', 'py-5 md:py-10')}>
        {(title || action) && (
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            {title && <h1 className="text-h1 min-w-0 [overflow-wrap:anywhere]">{title}</h1>}
            {action}
          </div>
        )}
        {children}
      </main>

      <MobileTabBarSpacer />
      <MobileTabBar />
    </div>
  );
}

export const TRAVELLER_NAV: NavItem[] = [
  { href: '/account', label: 'Account Centre', exact: true },
  { href: '/account/applications', label: 'My trips & payments' },
  { href: '/account/enquiries', label: 'My reservations' },
  { href: '/account/passes', label: 'Passes' },
  { href: '/account/experiences', label: 'My experiences' },
  { href: '/account/study-groups', label: 'Study groups' },
  { href: '/account/gaming', label: 'Gaming Hub' },
  { href: '/account/messages', label: 'Messages' },
  { href: '/account/chats', label: 'Group chats' },
  { href: '/account/groups', label: 'Trip groups' },
  { href: '/account/notifications', label: 'Notifications' },
  { href: '/account/hosting', label: 'Hosting' },
  { href: '/account/saved', label: 'Wishlist' },
  { href: '/account/profile', label: 'Profile & privacy' },
  { href: '/account/settings', label: 'Settings' },
];

/** Every account type that has a personal area. */
export const MEMBER_ROLES: Role[] = ['TRAVELER', 'ORGANIZER', 'ADMIN', 'STAFF'];
