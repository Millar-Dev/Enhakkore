'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar, Icon, cx } from '@/components/ui';
import { api } from '@/lib/api';
import { useScrollHide } from '@/lib/useScrollHide';
import { SearchOverlay } from './SearchOverlay';
import { homeFor, useSession } from '@/lib/session';
import { OriginalLogo } from './BrandLogo';
import { SocialIcon } from './SocialIcon';

export interface HeaderProps {
  logoUrl: string;
  /** Official light version of the logo for the dark phone header, if supplied. */
  logoOnDarkUrl?: string;
  brandName: string;
  nav: { label: string; href: string }[];
  whatsapp: { label: string; display: string; href: string }[];
  hostHref?: string;
}

/** What sits inside each of the four main categories, shown in the menu sheet. */
const SUBNAV: Record<string, { label: string; href: string }[]> = {
  '/explore': [
    { label: 'Stays & accommodation', href: '/explore?section=STAYS' },
    { label: 'Food & dining', href: '/explore?section=FOOD' },
    { label: 'Venues & event spaces', href: '/explore?section=VENUES' },
    { label: 'Places & attractions', href: '/explore?section=ATTRACTIONS' },
    { label: 'Destinations', href: '/destinations' },
  ],
  '/experiences': [
    { label: 'Events & activities', href: '/experiences#upcoming' },
    { label: 'Gaming & esports', href: '/experiences/gaming' },
    { label: 'Communities', href: '/experiences/communities' },
    { label: 'Plan an event', href: '/experiences/plan' },
    { label: 'Publish an activity', href: '/experiences/publish' },
  ],
  '/travel': [
    { label: 'Upcoming trips', href: '/travel' },
    { label: 'Plan a private trip', href: '/private-trips' },
    { label: 'Catering & lunchboxes', href: '/catering' },
  ],
  '/impact': [
    { label: 'WSC — We Save Children', href: '/impact' },
    { label: 'Donate', href: '/donate' },
    { label: 'Partner with us', href: '/partner' },
  ],
};

/**
 * The site header.
 *
 * Phones and tablets: a compact dark navy bar — menu on the left, logo in the
 * middle, search and notifications on the right. The original logo is navy
 * artwork and is never inverted or recoloured, so on the dark bar it sits on a
 * small cream badge unless an official light version has been uploaded
 * (Settings → Brand → Logo on dark URL).
 *
 * Computers: a light bar with the full menu.
 */
export function Header({ logoUrl, logoOnDarkUrl, brandName, nav, whatsapp }: HeaderProps) {
  const pathname = usePathname();
  const { user, status, signOut } = useSession();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (status !== 'authenticated') return;
    api
      .get<{ items: { read: boolean }[]; unread?: number }>('/me/notifications')
      .then((data) => setUnread(data.unread ?? data.items.filter((item) => !item.read).length))
      .catch(() => undefined);
  }, [status, pathname]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const hidden = useScrollHide();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const staff = user && (user.role === 'ADMIN' || user.role === 'STAFF');

  return (
    <>
      <header
        className={cx(
          'sticky top-0 z-50 border-b bg-[#06152a]/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl transition-[transform,box-shadow] duration-300 lg:bg-[color:var(--color-cream)]/95',
          scrolled ? 'border-white/10 shadow-[0_6px_24px_-18px_rgba(8,43,69,0.45)] lg:border-line' : 'border-transparent',
          hidden && !open && !searching && '-translate-y-full',
        )}
      >
        {/* Phones and tablets */}
        <div className="shell grid h-14 grid-cols-[5.5rem_1fr_5.5rem] items-center text-white md:h-16 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
          >
            {open ? (
              <Icon.close size={22} />
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
          <Link href="/" aria-label={`${brandName} — home`} className="flex justify-self-center">
            {logoOnDarkUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoOnDarkUrl} alt="" className="h-10 w-auto md:h-11" />
            ) : (
              <span className="rounded-lg bg-[#f6f2ea] px-1.5 py-0.5 shadow-[0_0_0_1px_rgba(203,154,60,0.45)]">
                <OriginalLogo src={logoUrl} height={38} priority />
              </span>
            )}
          </Link>
          <div className="-mr-2 flex items-center justify-end">
            <button type="button" onClick={() => setSearching(true)} aria-label="Search" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10">
              <Icon.search size={21} />
            </button>
            <Link
              href={status === 'authenticated' ? '/account/notifications' : '/signin?next=/account/notifications'}
              aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              {unread > 0 && <span className="absolute right-1.5 top-1.5 min-w-[1.1rem] rounded-full bg-[#e5484d] px-1 text-center text-[0.625rem] font-bold leading-[1.1rem] text-white">{unread > 9 ? '9+' : unread}</span>}
            </Link>
          </div>
        </div>

        {/* Computers */}
        <div className="shell hidden h-[4.5rem] items-center justify-between gap-3 lg:flex">
          <Link href="/" aria-label={`${brandName} — home`} className="flex shrink-0 items-center">
            <OriginalLogo src={logoUrl} height={56} priority />
          </Link>

          <nav className="hidden items-center lg:flex" aria-label="Primary">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={cx(
                  'relative px-3 py-2 text-[0.875rem] font-semibold transition-colors',
                  'after:absolute after:inset-x-3 after:-bottom-0.5 after:h-[2px] after:origin-left after:rounded-full after:bg-clay-400 after:transition-transform',
                  isActive(item.href) ? 'text-acacia-600 after:scale-x-100' : 'text-ink-soft after:scale-x-0 hover:text-acacia-600',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setSearching(true)} aria-label="Search" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-sand-deep">
              <Icon.search size={19} />
            </button>
            {status === 'authenticated' && (
              <Link href="/account/notifications" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-sand-deep">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                {unread > 0 && <span className="absolute right-1.5 top-1.5 min-w-[1.1rem] rounded-full bg-clay-500 px-1 text-center text-[0.625rem] font-bold leading-[1.1rem] text-white">{unread > 9 ? '9+' : unread}</span>}
              </Link>
            )}
            <Link
              href="/donate"
              className="inline-flex h-10 items-center rounded-full bg-clay-400 px-4 text-[0.8125rem] font-bold text-acacia-700 shadow-sm transition hover:bg-clay-500 hover:text-white"
            >
              Donate
            </Link>
            {status === 'authenticated' && user ? (
              <Link
                href={staff ? '/admin' : homeFor(user.role)}
                className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-white py-1 pl-1 pr-3 text-[0.8125rem] font-semibold text-ink"
              >
                <Avatar name={user.name} src={user.avatarUrl} size="xs" />
                {staff ? 'Control centre' : user.name.split(' ')[0]}
              </Link>
            ) : (
              <Link href="/signin" className="inline-flex h-10 items-center rounded-full px-3 text-[0.8125rem] font-semibold text-ink hover:text-acacia-600">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      {searching && <SearchOverlay onClose={() => setSearching(false)} />}

      {open && (
        <div className="fixed inset-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-40 animate-fade overflow-y-auto bg-[color:var(--color-cream)] md:top-[calc(4rem+env(safe-area-inset-top))] lg:hidden">
          <div className="shell flex min-h-full flex-col py-6">
            <nav aria-label="Primary mobile" className="grid">
              <Link href="/" className="flex items-center justify-between border-b border-line py-3 font-display text-[1.5rem] text-acacia-700">
                Home
                <Icon.arrow className="text-clay-500" />
              </Link>
              {nav.map((item) => (
                <div key={item.href} className="border-b border-line py-3">
                  <Link href={item.href} className="flex items-center justify-between font-display text-[1.5rem] text-acacia-700">
                    {item.label}
                    <Icon.arrow className="text-clay-500" />
                  </Link>
                  {SUBNAV[item.href] && (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                      {SUBNAV[item.href]!.map((sub) => (
                        <Link key={sub.href} href={sub.href} className="inline-flex min-h-9 items-center text-[0.875rem] font-medium text-ink-soft">
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>

            <div className="mt-7 grid gap-2.5">
              <Link href="/donate" className="inline-flex h-12 items-center justify-center rounded-full bg-clay-400 font-bold text-acacia-700">
                Donate now
              </Link>
              {status === 'authenticated' && user ? (
                <>
                  <Link href={staff ? '/admin' : homeFor(user.role)} className="inline-flex h-12 items-center justify-center rounded-full border border-acacia-600/30 bg-white font-semibold text-acacia-600">
                    {staff ? 'Control centre' : 'My account'}
                  </Link>
                  <button type="button" onClick={signOut} className="h-11 text-sm font-semibold text-ink-muted">
                    Sign out
                  </button>
                </>
              ) : (
                <Link href="/signin" className="inline-flex h-12 items-center justify-center rounded-full border border-acacia-600/30 bg-white font-semibold text-acacia-600">
                  Sign in or join
                </Link>
              )}
            </div>

            <div className="mt-auto pt-8">
              <p className="text-eyebrow uppercase text-ink-muted">WhatsApp us</p>
              <div className="mt-3 grid gap-2">
                {whatsapp.map((number) => (
                  <a key={number.href} href={number.href} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-2.5 text-[0.9375rem] font-semibold text-acacia-700">
                    <span className="text-[#1f9d55]">
                      <SocialIcon platform="whatsapp" size={18} />
                    </span>
                    {number.display}
                    <span className="text-xs font-normal text-ink-muted">{number.label}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
