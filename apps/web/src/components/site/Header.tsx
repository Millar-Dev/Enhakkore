'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar, Icon, cx } from '@/components/ui';
import { api } from '@/lib/api';
import { useScrollHide } from '@/lib/useScrollHide';
import { SearchOverlay } from './SearchOverlay';
import { homeFor, useSession } from '@/lib/session';
import { SocialIcon } from './SocialIcon';

export interface HeaderProps {
  logoUrl: string;
  /** The logo prepared for dark backgrounds (the original artwork with a light outline). */
  logoOnDarkUrl?: string;
  brandName: string;
  nav: { label: string; href: string }[];
  whatsapp: { label: string; display: string; href: string }[];
  hostHref?: string;
}

/** What sits inside each main category — the computer dropdowns and the phone menu. */
const SUBNAV: Record<string, { label: string; href: string }[]> = {
  '/explore': [
    { label: 'Stays & hotels', href: '/explore?section=STAYS' },
    { label: 'Food & dining', href: '/explore?section=FOOD' },
    { label: 'Venues & event spaces', href: '/explore?section=VENUES' },
    { label: 'Places & attractions', href: '/explore?section=ATTRACTIONS' },
    { label: 'Destinations', href: '/destinations' },
  ],
  '/experiences': [
    { label: 'Discover experiences', href: '/experiences/discover' },
    { label: 'Gaming & esports', href: '/experiences/gaming' },
    { label: 'Communities', href: '/experiences/communities' },
    { label: 'Host & Organise', href: '/experiences/host' },
    { label: 'Plan an event with us', href: '/experiences/plan' },
  ],
  '/travel': [
    { label: 'Upcoming trips', href: '/travel' },
    { label: 'Completed trips', href: '/travel?tab=completed' },
    { label: 'Plan a private trip', href: '/private-trips' },
    { label: 'Catering & lunchboxes', href: '/catering' },
  ],
  '/impact': [
    { label: 'WSC — We Save Children', href: '/impact' },
    { label: 'Our projects', href: '/impact#projects' },
    { label: 'Get involved', href: '/impact#volunteer' },
    { label: 'Donate', href: '/donate' },
  ],
};

const MENU_ICONS: Record<string, string> = {
  '/': 'M3 11.5 12 4l9 7.5 M5.5 10v9.5h13V10',
  '/explore': 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z M12 12.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  '/experiences': 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19 M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4 M15.5 3.6a3.5 3.5 0 0 1 0 6.8',
  '/experiences/gaming': 'M6 12h4 M8 10v4 M15 13h.01 M18 11h.01 M17.3 5H6.7a4 4 0 0 0-4 3.6C2.6 9.4 2 14.5 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.4-1.4A2 2 0 0 1 9.8 16h4.4a2 2 0 0 1 1.4.6L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.5-.6-6.6-.7-7.3a4 4 0 0 0-4-3.7Z',
  '/experiences/communities': 'M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M21 21v-2a4 4 0 0 0-3-3.9',
  '/travel': 'M2.5 19h19M4 15l6-1 7-9 2 .5-3.5 8.5 4.5-.5 1 2-14 3-3-3.5Z',
  '/impact': 'M12 20s-7.5-4.6-9.2-9.3C1.6 7.3 3.9 4 7.2 4c2 0 3.6 1.2 4.8 3 1.2-1.8 2.8-3 4.8-3 3.3 0 5.6 3.3 4.4 6.7C19.5 15.4 12 20 12 20Z',
  '/partner': 'M3 11l4-4 5 2 5-2 4 4-7 7-2-2 M8 13l3 3 M10.5 11.5l3 3',
  '/donate': 'M20 12v9H4v-9 M2 7h20v5H2z M12 21V7 M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7Z M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7Z',
};

function Svg({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const BELL = (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

/**
 * The site header — one dark navy bar for every screen size, with the
 * original Enhakkore emblem (prepared for dark backgrounds, artwork unchanged).
 *
 * Computers: emblem, the main sections with dropdowns, Partner With Us, search,
 * notifications and the account. Phones and tablets: menu, emblem, search and
 * notifications; the menu opens a drawer. It slides away while scrolling down
 * and comes back on the way up.
 */
export function Header({ logoUrl, logoOnDarkUrl, brandName, nav, whatsapp }: HeaderProps) {
  const pathname = usePathname();
  const { user, status, signOut } = useSession();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [dropdown, setDropdown] = useState<string | null>(null);
  const hidden = useScrollHide();
  const emblem = logoOnDarkUrl || '/brand/refined/enhakkore-emblem-on-dark-96.png';

  useEffect(() => {
    if (status !== 'authenticated') return;
    api
      .get<{ items: { read: boolean }[]; unread?: number }>('/me/notifications')
      .then((data) => setUnread(data.unread ?? data.items.filter((item) => !item.read).length))
      .catch(() => undefined);
  }, [status, pathname]);
  useEffect(() => {
    setOpen(false);
    setDropdown(null);
  }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);
  useEffect(() => {
    if (!open && !dropdown) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setDropdown(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dropdown]);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));
  const staff = user && (user.role === 'ADMIN' || user.role === 'STAFF');
  const accountHref = status === 'authenticated' && user ? (staff ? '/admin' : homeFor(user.role)) : '/signin';
  const items = [{ label: 'Home', href: '/' }, ...nav];

  return (
    <>
      <header
        className={cx(
          'sticky top-0 z-50 border-b border-white/10 bg-[#06172b]/95 pt-[env(safe-area-inset-top)] text-white shadow-[0_8px_30px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-transform duration-300',
          hidden && !open && !searching && !dropdown && '-translate-y-full',
        )}
      >
        {/* Phones and tablets */}
        <div className="shell grid h-14 grid-cols-[1fr_auto_1fr] items-center md:h-16 lg:hidden">
          <div className="-ml-2 flex items-center">
            <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <button type="button" onClick={() => setSearching(true)} aria-label="Search" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10">
              <Icon.search size={21} />
            </button>
          </div>
          <Link href="/" aria-label={`${brandName} — home`} className="flex justify-self-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={emblem} alt="" width={64} height={45} className="h-11 w-auto max-w-full object-contain md:h-12" />
          </Link>
          <div className="-mr-2 flex items-center justify-end">
            <Link href={status === 'authenticated' ? '/account/notifications' : '/signin?next=/account/notifications'} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className="relative inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10">
              {BELL}
              {unread > 0 && <span className="absolute right-1.5 top-1.5 min-w-[1.1rem] rounded-full bg-[#e5484d] px-1 text-center text-[0.625rem] font-bold leading-[1.1rem]">{unread > 9 ? '9+' : unread}</span>}
            </Link>
            <Link href={status === 'authenticated' ? accountHref : '/signin?next=/account'} aria-label={status === 'authenticated' ? 'Account Centre' : 'Sign in'} className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10">
              {status === 'authenticated' && user ? (
                <span className="rounded-full ring-2 ring-clay-400"><Avatar name={user.name} src={user.avatarUrl} size="xs" /></span>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
              )}
            </Link>
          </div>
        </div>

        {/* Computers */}
        <div className="shell hidden h-[4.5rem] items-center gap-4 lg:flex">
          <Link href="/" aria-label={`${brandName} — home`} className="flex shrink-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={emblem} alt="" width={74} height={52} className="h-[3.25rem] w-auto" />
            <span className="sr-only">{brandName}</span>
          </Link>
          <nav className="ml-2 flex flex-1 items-center gap-0.5" aria-label="Primary">
            {items.map((item) => {
              const children = SUBNAV[item.href];
              const active = isActive(item.href);
              return (
                <div key={item.href} className="relative" onMouseEnter={() => children && setDropdown(item.href)} onMouseLeave={() => setDropdown(null)}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'relative inline-flex h-11 items-center gap-1 rounded-full px-3 text-[0.875rem] font-semibold transition-colors',
                      active ? 'text-clay-400' : 'text-white/85 hover:text-white',
                    )}
                  >
                    {item.label}
                    {children && <span className="text-[0.625rem] opacity-70" aria-hidden>▾</span>}
                  </Link>
                  {children && (
                    <button
                      type="button"
                      className="sr-only focus:not-sr-only focus:absolute focus:-right-2 focus:top-3 focus:rounded focus:bg-white focus:px-1 focus:text-xs focus:text-ink"
                      aria-expanded={dropdown === item.href}
                      aria-label={`Show ${item.label} menu`}
                      onClick={() => setDropdown(dropdown === item.href ? null : item.href)}
                    >
                      ▾
                    </button>
                  )}
                  {children && dropdown === item.href && (
                    <div className="absolute left-0 top-full z-50 pt-2">
                      <ul className="enh-fade-in w-60 overflow-hidden rounded-2xl border border-white/10 bg-[#0b2340] p-1.5 shadow-2xl">
                        {children.map((child) => (
                          <li key={child.href}>
                            <Link href={child.href} className="flex min-h-10 items-center rounded-xl px-3 text-sm text-white/85 hover:bg-white/10 hover:text-clay-400">{child.label}</Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
            <Link href="/partner" aria-current={isActive('/partner') ? 'page' : undefined} className={cx('inline-flex h-11 items-center rounded-full px-3 text-[0.875rem] font-semibold', isActive('/partner') ? 'text-clay-400' : 'text-white/85 hover:text-white')}>
              Partner With Us
            </Link>
          </nav>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setSearching(true)} aria-label="Search" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10">
              <Icon.search size={20} />
            </button>
            {status === 'authenticated' && (
              <Link href="/account/notifications" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className="relative inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10">
                {BELL}
                {unread > 0 && <span className="absolute right-1.5 top-1.5 min-w-[1.1rem] rounded-full bg-[#e5484d] px-1 text-center text-[0.625rem] font-bold leading-[1.1rem]">{unread > 9 ? '9+' : unread}</span>}
              </Link>
            )}
            {status === 'authenticated' && user ? (
              <Link href={accountHref} className="ml-1 inline-flex items-center gap-2 rounded-full border border-white/20 py-1 pl-1 pr-3 text-[0.8125rem] font-semibold hover:border-clay-400">
                <Avatar name={user.name} src={user.avatarUrl} size="xs" />
                {staff ? 'Control centre' : user.name.split(' ')[0]}
              </Link>
            ) : (
              <Link href="/join" className="ml-1 inline-flex h-10 items-center rounded-full bg-clay-400 px-4 text-[0.8125rem] font-bold text-acacia-700 hover:bg-clay-500 hover:text-white">
                Join / Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      {searching && <SearchOverlay onClose={() => setSearching(false)} />}

      {/* Phone and tablet menu: a drawer with short names and icons. */}
      {open && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-black/55" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="enh-drawer absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col overflow-y-auto bg-[#06172b] pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={emblem} alt={brandName} width={57} height={40} className="h-10 w-auto" />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10">
                <Icon.close size={22} />
              </button>
            </div>
            <nav aria-label="Menu" className="grid gap-0.5 p-2">
              {[
                { label: 'Home', href: '/' },
                { label: 'Explore', href: '/explore' },
                { label: 'Experiences', href: '/experiences' },
                { label: 'Gaming', href: '/experiences/gaming' },
                { label: 'Communities', href: '/experiences/communities' },
                { label: 'Travel', href: '/travel' },
                { label: 'Impact', href: '/impact' },
                { label: 'Partner With Us', href: '/partner' },
                { label: 'Donate', href: '/donate' },
              ].map((item) => (
                <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? 'page' : undefined} className={cx('flex min-h-12 items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-semibold', isActive(item.href) ? 'bg-clay-400 text-acacia-700' : 'text-white/90 hover:bg-white/10')}>
                  <Svg d={MENU_ICONS[item.href] ?? MENU_ICONS['/']!} />
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto grid gap-2 border-t border-white/10 p-4">
              {status === 'authenticated' && user ? (
                <>
                  <Link href={accountHref} className="inline-flex h-12 items-center justify-center rounded-full bg-clay-400 text-sm font-bold text-acacia-700">{staff ? 'Control centre' : 'My account'}</Link>
                  <button type="button" onClick={signOut} className="h-11 text-sm font-semibold text-white/70">Sign out</button>
                </>
              ) : (
                <Link href="/join" className="inline-flex h-12 items-center justify-center rounded-full bg-clay-400 text-sm font-bold text-acacia-700">Join / Sign in</Link>
              )}
              {whatsapp[0] && (
                <a href={whatsapp[0].href} target="_blank" rel="noreferrer noopener" className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/20 text-sm font-semibold">
                  <span className="text-[#25d366]"><SocialIcon platform="whatsapp" size={18} /></span> {whatsapp[0].display}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export { SUBNAV };
