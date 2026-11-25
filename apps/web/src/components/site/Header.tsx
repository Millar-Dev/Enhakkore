'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar, Icon, cx } from '@/components/ui';
import { homeFor, useSession } from '@/lib/session';
import { OriginalLogo } from './BrandLogo';
import { SocialIcon } from './SocialIcon';

export interface HeaderProps {
  logoUrl: string;
  brandName: string;
  nav: { label: string; href: string }[];
  whatsapp: { label: string; display: string; href: string }[];
  hostHref: string;
}

/** Secondary links, shown in the menu sheet and the "More" list. */
const MORE = [
  { label: 'Catering & lunchboxes', href: '/catering' },
  { label: 'Destinations', href: '/destinations' },
  { label: 'This weekend', href: '/weekend' },
  { label: 'Community stories & polls', href: '/community' },
  { label: 'Local deals', href: '/deals' },
  { label: 'Donate', href: '/donate' },
  { label: 'Contact', href: '/contact' },
];

/**
 * The site header. Always a light ground, because the original logo is navy
 * artwork and must stay legible; it is never inverted or recoloured.
 */
export function Header({ logoUrl, brandName, nav, whatsapp, hostHref }: HeaderProps) {
  const pathname = usePathname();
  const { user, status, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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
          'sticky top-0 z-50 border-b bg-[color:var(--color-cream)]/95 backdrop-blur-xl transition-shadow',
          scrolled ? 'border-line shadow-[0_6px_24px_-18px_rgba(8,43,69,0.45)]' : 'border-transparent',
        )}
      >
        <div className="shell flex h-[4.25rem] items-center justify-between gap-4 md:h-20">
          <Link href="/" aria-label={`${brandName} — home`} className="flex shrink-0 items-center">
            <OriginalLogo src={logoUrl} height={64} priority className="hidden md:block" />
            <OriginalLogo src={logoUrl} height={46} priority className="md:hidden" />
          </Link>

          <nav className="hidden items-center xl:flex" aria-label="Primary">
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
            <Link href="/search" aria-label="Search" className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-sand-deep">
              <Icon.search size={19} />
            </Link>
            <Link
              href={hostHref}
              className="hidden h-10 items-center rounded-full bg-clay-400 px-4 text-[0.8125rem] font-bold text-acacia-700 shadow-sm transition hover:bg-clay-500 hover:text-white lg:inline-flex"
            >
              Host an activity
            </Link>
            {status === 'authenticated' && user ? (
              <Link
                href={staff ? '/admin' : homeFor(user.role)}
                className="hidden items-center gap-2 rounded-full border border-line-strong bg-white py-1 pl-1 pr-3 text-[0.8125rem] font-semibold text-ink md:inline-flex"
              >
                <Avatar name={user.name} src={user.avatarUrl} size="xs" />
                {staff ? 'Control centre' : user.name.split(' ')[0]}
              </Link>
            ) : (
              <Link href="/signin" className="hidden h-10 items-center rounded-full px-3 text-[0.8125rem] font-semibold text-ink hover:text-acacia-600 md:inline-flex">
                Sign in
              </Link>
            )}
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-sand-deep xl:hidden"
            >
              {open ? (
                <Icon.close size={20} />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M4 7h16M4 12h16M4 17h10" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 top-[4.25rem] z-40 animate-fade overflow-y-auto bg-[color:var(--color-cream)] md:top-20 xl:hidden">
          <div className="shell flex min-h-full flex-col py-6">
            <nav aria-label="Primary mobile" className="grid">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between border-b border-line py-3.5 font-display text-[1.6rem] text-acacia-700"
                >
                  {item.label}
                  <Icon.arrow className="text-clay-500" />
                </Link>
              ))}
            </nav>
            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2.5">
              {MORE.map((item) => (
                <Link key={item.href} href={item.href} className="text-[0.9375rem] font-medium text-ink-soft">
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="mt-7 grid gap-2.5">
              <Link href={hostHref} className="inline-flex h-12 items-center justify-center rounded-full bg-clay-400 font-bold text-acacia-700">
                Host an activity
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
