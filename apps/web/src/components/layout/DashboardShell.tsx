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
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur-xl">
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
              className="inline-flex items-center gap-2.5 rounded-[--radius-field] px-2 py-1.5 transition-colors hover:bg-sand"
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

      <main id="main" className={cx(wide ? 'mx-auto w-full max-w-[96rem] px-5 md:px-8' : 'shell', 'py-8 md:py-10')}>
        {(title || action) && (
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            {title && <h1 className="text-h1">{title}</h1>}
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
  { href: '/account/trips', label: 'My trips' },
  { href: '/account/groups', label: 'Groups' },
  { href: '/account/impact', label: 'Impact' },
  { href: '/account/saved', label: 'Saved' },
  { href: '/account', label: 'Profile', exact: true },
];

export const ORGANIZER_NAV: NavItem[] = [
  { href: '/organizer', label: 'Dashboard', exact: true },
  { href: '/organizer/trips', label: 'My trips' },
  { href: '/organizer/bookings', label: 'Bookings' },
  { href: '/organizer/messages', label: 'Messages' },
  { href: '/organizer/verification', label: 'Verification' },
];

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/organizers', label: 'Organizers' },
  { href: '/admin/trips', label: 'Trips' },
  { href: '/admin/bookings', label: 'Bookings' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/impact', label: 'Impact' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/requests', label: 'Requests' },
];
