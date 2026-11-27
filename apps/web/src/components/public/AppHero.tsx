import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * The dark title band used at the top of the main listing pages (Explore,
 * Experiences, Travel): a centred title on phones, a search bar and a row of
 * filter pills. On larger screens the same band left-aligns and widens.
 */
export function AppHero({
  title,
  subtitle,
  search,
  pills = [],
  children,
}: {
  title: string;
  subtitle?: string;
  search?: { action: string; placeholder: string; value?: string; hidden?: Record<string, string | undefined> };
  pills?: { label: string; href: string; icon?: string; active?: boolean }[];
  children?: ReactNode;
}) {
  return (
    <section className="band band-dark-a text-white">
      <div className="shell py-5 text-center md:py-10 md:text-left">
        <h1 className="text-[clamp(1.35rem,5.2vw,2.6rem)] font-bold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[0.8125rem] text-white/70 md:text-base">{subtitle}</p>}
        {search && (
          <form action={search.action} role="search" className="mx-auto mt-4 flex h-11 max-w-2xl items-center gap-2 rounded-full bg-white pl-4 pr-1 text-ink md:mx-0 md:h-12">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-ink-muted" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            {Object.entries(search.hidden ?? {}).map(([name, value]) => (value ? <input key={name} type="hidden" name={name} value={value} /> : null))}
            <input name="q" defaultValue={search.value} placeholder={search.placeholder} aria-label={search.placeholder} className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" />
            <button className="h-9 shrink-0 rounded-full bg-acacia-700 px-4 text-xs font-bold text-white md:h-10 md:text-sm">Search</button>
          </form>
        )}
        {pills.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2 md:justify-start">
            {pills.map((pill) => (
              <Link
                key={pill.label}
                href={pill.href}
                className={`inline-flex h-10 max-w-full items-center gap-1.5 rounded-full border px-3.5 text-[0.8125rem] font-semibold ${pill.active ? 'border-clay-400 bg-clay-400 text-acacia-700' : 'border-white/35 text-white hover:border-clay-400'}`}
              >
                {pill.icon && <span aria-hidden>{pill.icon}</span>}
                <span className="truncate">{pill.label}</span>
                <span className="text-[0.625rem] opacity-70" aria-hidden>▾</span>
              </Link>
            ))}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
