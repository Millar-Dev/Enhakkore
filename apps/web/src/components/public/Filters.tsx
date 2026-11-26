import Link from 'next/link';
import type { Catalogue } from '@/lib/public';
import { cx } from '@/components/ui';

/**
 * Location and category filters as a plain GET form, so they work on any phone
 * without waiting for JavaScript, and every filtered view has its own link.
 */
export function Filters({
  action,
  catalogue,
  kind,
  values,
  extra,
  hidden,
}: {
  action: string;
  catalogue: Catalogue;
  kind?: 'ACTIVITY' | 'PLACE' | 'EXPERIENCE' | 'EVENT';
  values: Record<string, string | undefined>;
  extra?: { name: string; label: string; options: { value: string; label: string }[] }[];
  /** Kept when the form is submitted (e.g. the chosen section). */
  hidden?: Record<string, string | undefined>;
}) {
  const country = catalogue.countries.find((item) => item.code.toLowerCase() === values.country?.toLowerCase() || item.slug === values.country);
  const categories = kind ? catalogue.categories.filter((item) => item.kind === kind) : [];
  return (
    <form action={action} className="grid gap-3 rounded-[1.1rem] border border-line bg-white p-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
      {Object.entries(hidden ?? {}).map(([name, value]) => (value ? <input key={name} type="hidden" name={name} value={value} /> : null))}
      <label className="grid gap-1 text-[0.75rem] font-semibold text-ink-muted lg:w-48">
        Country
        <select name="country" defaultValue={country?.code ?? ''} className="field">
          <option value="">Everywhere</option>
          {catalogue.countries.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-[0.75rem] font-semibold text-ink-muted lg:w-48">
        City
        <select name="city" defaultValue={values.city ?? ''} className="field">
          <option value="">{country ? `All of ${country.name}` : 'Any city'}</option>
          {(country ? [country] : catalogue.countries).flatMap((item) =>
            item.cities.map((city) => (
              <option key={`${item.code}-${city.slug}`} value={city.slug}>
                {city.name}
                {country ? '' : `, ${item.name}`}
              </option>
            )),
          )}
        </select>
      </label>
      {categories.length > 0 && (
        <label className="grid gap-1 text-[0.75rem] font-semibold text-ink-muted lg:w-52">
          Category
          <select name="category" defaultValue={values.category ?? ''} className="field">
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.icon ? `${item.icon} ` : ''}
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {extra?.map((field) => (
        <label key={field.name} className="grid gap-1 text-[0.75rem] font-semibold text-ink-muted lg:w-44">
          {field.label}
          <select name={field.name} defaultValue={values[field.name] ?? ''} className="field">
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label className="grid gap-1 text-[0.75rem] font-semibold text-ink-muted sm:col-span-2 lg:min-w-48 lg:flex-1">
        Search
        <input name="q" defaultValue={values.q ?? ''} placeholder="Name or keyword" className="field" />
      </label>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
        <button type="submit" className="h-11 flex-1 rounded-[var(--radius-field)] bg-acacia-600 px-6 text-sm font-bold text-white hover:bg-acacia-500 lg:flex-none">
          Show results
        </button>
        <Link href={action} className="inline-flex h-11 items-center rounded-[var(--radius-field)] px-3 text-sm font-semibold text-ink-muted hover:text-ink">
          Clear
        </Link>
      </div>
    </form>
  );
}

/** Category chips as links — quick, visible choices, with featured ones first. */
export function CategoryChips({
  base,
  catalogue,
  kind,
  active,
  params = {},
}: {
  base: string;
  catalogue: Catalogue;
  kind: string;
  active?: string;
  params?: Record<string, string | undefined>;
}) {
  const categories = catalogue.categories.filter((item) => item.kind === kind && item.featured);
  if (categories.length === 0) return null;
  const href = (slug?: string) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value && key !== 'category' && key !== 'page') search.set(key, value);
    if (slug) search.set('category', slug);
    const text = search.toString();
    return text ? `${base}?${text}` : base;
  };
  return (
    <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
      <Link href={href()} className={cx('chip', !active && 'chip-active')}>
        All
      </Link>
      {categories.map((item) => (
        <Link key={item.slug} href={href(item.slug)} className={cx('chip', active === item.slug && 'chip-active')}>
          {item.icon && <span aria-hidden>{item.icon}</span>}
          {item.name}
        </Link>
      ))}
    </div>
  );
}

export function Pager({ base, page, totalPages, params }: { base: string; page: number; totalPages: number; params: Record<string, string | undefined> }) {
  if (totalPages <= 1) return null;
  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value && key !== 'page') search.set(key, value);
    search.set('page', String(target));
    return `${base}?${search.toString()}`;
  };
  return (
    <nav className="mt-10 flex items-center justify-center gap-3" aria-label="Pages">
      {page > 1 && <Link className="chip" href={href(page - 1)}>← Previous</Link>}
      <span className="text-sm text-ink-muted">
        Page {page} of {totalPages}
      </span>
      {page < totalPages && <Link className="chip" href={href(page + 1)}>Next →</Link>}
    </nav>
  );
}
