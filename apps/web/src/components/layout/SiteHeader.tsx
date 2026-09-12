'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/brand/Logo';
import { Avatar, Button, ButtonLink, Icon, cx } from '@/components/ui';
import { homeFor, useSession } from '@/lib/session';

const PRIMARY_NAV = [
  { href: '/trips', label: 'Explore Trips' },
  { href: '/safari', label: 'Safari' },
  { href: '/impact', label: 'Impact' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/community', label: 'Community' },
];

/**
 * The site header.
 *
 * Transparent over a page that opens with full-bleed photography, solid
 * everywhere else and as soon as the page scrolls. Navigation adapts to the
 * signed-in account type rather than showing everyone every area.
 */
export function SiteHeader({ transparent = false }: { transparent?: boolean }) {
  const pathname = usePathname();
  const { user, status, signOut } = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!transparent) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [transparent]);

  // Close the mobile sheet whenever the route changes.
  useEffect(() => setMenuOpen(false), [pathname]);

  // Prevent the page behind the open sheet from scrolling.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const floating = transparent && !scrolled && !menuOpen;

  return (
    <>
      <header
        className={cx(
          'fixed inset-x-0 top-0 z-50 transition-all duration-300',
          floating
            ? 'border-b border-white/10 bg-transparent'
            : 'border-b border-line bg-white/92 backdrop-blur-xl',
        )}
      >
        <div className="shell flex h-16 items-center justify-between gap-6 md:h-[4.5rem]">
          <Link href="/" aria-label="Enhakkore — home" className="shrink-0">
            <Logo size="md" inverted={floating} />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {PRIMARY_NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    'rounded-[--radius-field] px-3.5 py-2 text-[0.875rem] font-medium transition-colors',
                    floating
                      ? active
                        ? 'text-white'
                        : 'text-white/75 hover:text-white'
                      : active
                        ? 'text-ink'
                        : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {status === 'authenticated' && user ? (
              <div className="hidden items-center gap-2 md:flex">
                <ButtonLink
                  href={homeFor(user.role)}
                  variant={floating ? 'inverted' : 'secondary'}
                  size="sm"
                  className="gap-2.5"
                >
                  <Avatar name={user.name} src={user.avatarUrl} size="xs" />
                  {user.name.split(' ')[0]}
                </ButtonLink>
                <Button variant="ghost" size="sm" onClick={signOut} className={floating ? 'text-white/80 hover:bg-white/10 hover:text-white' : ''}>
                  Sign out
                </Button>
              </div>
            ) : (
              <div className="hidden items-center gap-2 md:flex">
                <ButtonLink
                  href="/signin"
                  variant="ghost"
                  size="sm"
                  className={floating ? 'text-white/85 hover:bg-white/10 hover:text-white' : ''}
                >
                  Sign in
                </ButtonLink>
                <ButtonLink href="/join" variant={floating ? 'inverted' : 'primary'} size="sm">
                  Get Started
                </ButtonLink>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              className={cx(
                'inline-flex h-11 w-11 items-center justify-center rounded-[--radius-field] transition-colors lg:hidden',
                floating ? 'text-white hover:bg-white/10' : 'text-ink hover:bg-sand',
              )}
            >
              {menuOpen ? (
                <Icon.close size={20} />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile sheet */}
      {menuOpen && (
        <div className="fixed inset-0 top-16 z-40 animate-fade overflow-y-auto bg-white lg:hidden">
          <div className="shell flex min-h-full flex-col py-8">
            <nav className="flex flex-col" aria-label="Primary mobile">
              {PRIMARY_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between border-b border-line py-4 text-[1.25rem] font-semibold tracking-tight text-ink"
                >
                  {item.label}
                  <Icon.arrow className="text-ink-faint" />
                </Link>
              ))}
            </nav>

            <div className="mt-8 flex flex-col gap-3">
              {status === 'authenticated' && user ? (
                <>
                  <ButtonLink href={homeFor(user.role)} size="lg" full>
                    Go to my dashboard
                  </ButtonLink>
                  <Button variant="secondary" size="lg" full onClick={signOut}>
                    Sign out
                  </Button>
                </>
              ) : (
                <>
                  <ButtonLink href="/join" size="lg" full>
                    Get Started
                  </ButtonLink>
                  <ButtonLink href="/signin" variant="secondary" size="lg" full>
                    Sign in
                  </ButtonLink>
                </>
              )}
            </div>

            <div className="mt-auto pt-10">
              <Link href="/operators" className="text-[0.875rem] font-semibold text-acacia-700">
                Are you a tour operator? List your trips →
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
