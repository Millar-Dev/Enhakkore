'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Avatar, cx } from '@/components/ui';
import { MENU, can, visibleMenu } from '@/lib/admin';
import { useSession } from '@/lib/session';

/**
 * The control centre's frame: a sidebar on a computer, a drawer on a phone,
 * and a search box that finds any section or setting by name.
 *
 * It checks the account is the owner or a staff member before showing
 * anything. That is for the screen only — every request the pages make is
 * checked again by the API.
 */
export function AdminShell({ title, actions, children, permission }: { title?: string; actions?: ReactNode; children: ReactNode; permission?: string }) {
  const { user, status, signOut } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (status === 'anonymous') router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);
  useEffect(() => setOpen(false), [pathname]);

  const menu = useMemo(() => visibleMenu(user), [user]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return menu.flatMap((group) => group.items).filter((item) => `${item.label} ${item.keywords ?? ''}`.toLowerCase().includes(q)).slice(0, 8);
  }, [menu, query]);

  if (status !== 'authenticated' || !user) {
    return <div className="flex min-h-screen items-center justify-center bg-[color:var(--color-cream)] text-ink-muted">Loading the control centre…</div>;
  }
  if (user.role !== 'ADMIN' && user.role !== 'STAFF') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[color:var(--color-cream)] p-6 text-center">
        <p className="font-display text-3xl text-acacia-700">This area is for the Enhakkore team</p>
        <Link href="/" className="font-semibold text-acacia-600 underline">Back to the website</Link>
      </div>
    );
  }
  const allowed = !permission || can(user, permission);
  const isActive = (href: string) => {
    const path = href.split('?')[0]!;
    return path === '/admin' ? pathname === '/admin' : pathname === path || pathname.startsWith(`${path}/`);
  };

  const nav = (
    <nav className="space-y-6" aria-label="Control centre">
      {menu.map((group) => (
        <div key={group.title}>
          <p className="px-3 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-clay-400/80">{group.title}</p>
          <ul className="mt-2 space-y-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cx(
                    'relative flex min-h-10 items-center rounded-lg px-3 py-1.5 text-[0.875rem] font-medium transition-colors',
                    isActive(item.href) ? 'bg-clay-400/15 text-clay-400 before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-clay-400' : 'text-white/75 hover:bg-white/5 hover:text-white',
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#f8f4ec]">
      <aside className="no-scrollbar fixed inset-y-0 left-0 hidden w-64 overflow-y-auto border-r border-clay-400/20 bg-[#06172b] px-3 py-5 lg:block">
        <Link href="/admin" className="mb-6 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/refined/enhakkore-emblem-on-dark-96.png" alt="Enhakkore" width={50} height={35} className="h-9 w-auto" />
          <span className="text-[0.8125rem] font-bold leading-tight text-white">Control centre<span className="block text-[0.6875rem] font-medium text-clay-400">Enhakkore Travel &amp; Impact</span></span>
        </Link>
        {nav}
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="enh-drawer absolute inset-y-0 left-0 w-[82%] max-w-xs overflow-y-auto bg-[#06172b] px-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))]">
            <div className="mb-5 flex items-center justify-between px-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/refined/enhakkore-emblem-on-dark-96.png" alt="Enhakkore" width={50} height={35} className="h-9 w-auto" />
              <button onClick={() => setOpen(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-white/10" aria-label="Close menu">✕</button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-40 border-b border-clay-400/25 bg-[#06172b]/95 pt-[env(safe-area-inset-top)] text-white backdrop-blur">
          <div className="flex h-14 items-center gap-2 px-3 md:h-16 md:px-6">
            <button onClick={() => setOpen(true)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10 lg:hidden" aria-label="Open menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
            <div className="relative flex-1">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a section or setting — e.g. “WhatsApp”, “prices”, “expenses”"
                className="h-10 w-full max-w-xl rounded-full border border-white/15 bg-white/10 px-4 text-sm text-white placeholder:text-white/50"
                aria-label="Search the control centre"
              />
              {matches.length > 0 && (
                <ul className="absolute left-0 top-12 w-full max-w-xl overflow-hidden rounded-xl border border-line bg-white text-ink shadow-[var(--shadow-raised)]">
                  {matches.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} onClick={() => setQuery('')} className="block px-4 py-2.5 text-sm hover:bg-sand">{item.label}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Link href="/admin/notifications" aria-label="Notifications" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
            </Link>
            <Link href="/" target="_blank" className="hidden min-h-10 items-center text-sm font-semibold text-clay-400 sm:inline-flex">View site ↗</Link>
            <div className="flex items-center gap-2">
              <Avatar name={user.name} src={user.avatarUrl} size="sm" />
              <div className="hidden text-xs leading-tight md:block">
                <p className="font-semibold text-white">{user.name}</p>
                <p className="text-white/60">{user.adminRoleName ?? 'Owner'}</p>
              </div>
              <button onClick={() => { signOut(); router.replace('/signin'); }} className="ml-1 inline-flex min-h-10 items-center px-1 text-xs font-semibold text-white/65 hover:text-clay-400">Sign out</button>
            </div>
          </div>
        </header>

        <main className="px-3 py-5 md:px-8 md:py-8">
          {(title || actions) && (
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:mb-7">
              {title && <h1 className="font-display text-[1.9rem] leading-tight text-[#06172b] md:text-[2.3rem]"><span className="mb-2 block h-[3px] w-10 rounded-full bg-clay-400" aria-hidden />{title}</h1>}
              {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
            </div>
          )}
          {allowed ? children : <p className="rounded-xl bg-white p-6 text-ink-muted">Your role does not include this section. Ask the owner if you need it.</p>}
        </main>
      </div>
    </div>
  );
}

/* Small shared pieces for admin screens. */

export function Panel({ title, children, className, actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cx('rounded-2xl border border-line bg-white p-4 shadow-[0_10px_30px_-24px_rgba(6,23,43,0.6)] md:p-6', className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="flex items-center gap-2 text-[1rem] font-bold text-[#06172b]"><span className="h-4 w-[3px] rounded-full bg-clay-400" aria-hidden />{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    ['PUBLISHED', 'CONFIRMED', 'ACTIVE', 'VERIFIED', 'SUCCEEDED', 'ENABLED', 'APPROVED', 'OPEN', 'COMPLETED', 'RESOLVED', 'CONVERTED'].includes(status)
      ? 'bg-safari-50 text-safari-700'
      : ['PENDING_REVIEW', 'APPLIED', 'PENDING_PAYMENT', 'PENDING', 'PLEDGED', 'NEW', 'REQUESTED', 'WAITLIST', 'REVIEWING', 'IN_PROGRESS', 'CONTACTED'].includes(status)
        ? 'bg-[#fdf4e3] text-warning'
        : ['REJECTED', 'CANCELLED', 'DECLINED', 'FAILED', 'SUSPENDED', 'DISABLED', 'SPAM', 'REFUNDED'].includes(status)
          ? 'bg-danger-soft text-danger'
          : 'bg-sand text-ink-muted';
  return <span className={cx('inline-flex rounded-full px-2.5 py-1 text-[0.6875rem] font-bold uppercase tracking-wide', tone)}>{status.replace(/_/g, ' ').toLowerCase()}</span>;
}

export const btn = {
  primary: 'inline-flex h-10 items-center justify-center gap-2 rounded-full bg-acacia-600 px-4 text-sm font-bold text-white hover:bg-acacia-500 disabled:opacity-50',
  gold: 'inline-flex h-10 items-center justify-center gap-2 rounded-full bg-clay-400 px-4 text-sm font-bold text-acacia-700 hover:bg-clay-500 hover:text-white disabled:opacity-50',
  secondary: 'inline-flex h-10 items-center justify-center gap-2 rounded-full border border-line-strong bg-white px-4 text-sm font-semibold text-ink hover:border-acacia-600 disabled:opacity-50',
  danger: 'inline-flex h-10 items-center justify-center gap-2 rounded-full border border-danger/30 bg-white px-4 text-sm font-semibold text-danger hover:bg-danger-soft disabled:opacity-50',
  green: 'inline-flex h-10 items-center justify-center gap-2 rounded-full bg-safari-500 px-4 text-sm font-bold text-white hover:bg-safari-600 disabled:opacity-50',
};

export { MENU };
