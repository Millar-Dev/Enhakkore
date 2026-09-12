'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { TRAVEL_STYLES, TRAVEL_STYLE_LABELS, TRIP_TYPES, TRIP_TYPE_LABELS } from '@enhakkore/shared';
import { Button, Divider, Icon, cx } from '@/components/ui';

/**
 * Marketplace filters.
 *
 * State lives in the URL, not in component state, so a filtered view can be
 * shared, bookmarked and returned to with the back button. On phones the same
 * controls open in a full-height sheet with one apply action, because applying
 * a filter per tap on a slow connection is miserable.
 */

const DURATIONS = [
  { label: '1–3 days', min: 1, max: 3 },
  { label: '4–6 days', min: 4, max: 6 },
  { label: '7–10 days', min: 7, max: 10 },
  { label: '11+ days', min: 11, max: undefined },
];

const PRICES = [
  { label: 'Under 500K', min: undefined, max: 500_000 },
  { label: '500K – 1M', min: 500_000, max: 1_000_000 },
  { label: '1M – 3M', min: 1_000_000, max: 3_000_000 },
  { label: '3M+', min: 3_000_000, max: undefined },
];

const GROUP_SIZES = [
  { label: 'Up to 8', min: undefined, max: 8 },
  { label: '9–16', min: 9, max: 16 },
  { label: '17+', min: 17, max: undefined },
];

const SORTS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Best rated' },
  { value: 'newest', label: 'Newest' },
];

export function TripFilters({ total }: { total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = sheetOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sheetOpen]);

  const update = useCallback(
    (changes: Record<string, string | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined || value === '') next.delete(key);
        else next.set(key, value);
      }
      // Any filter change returns to page one — staying on page 4 of a result
      // set that no longer exists is the classic marketplace bug.
      next.delete('page');
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  /** Multi-select values live as a comma-separated list in one param. */
  const toggleInList = useCallback(
    (key: string, value: string) => {
      const current = (params.get(key) ?? '').split(',').filter(Boolean);
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      update({ [key]: next.join(',') || undefined });
    },
    [params, update],
  );

  const inList = (key: string, value: string) =>
    (params.get(key) ?? '').split(',').filter(Boolean).includes(value);

  const rangeActive = (minKey: string, maxKey: string, min?: number, max?: number) =>
    (params.get(minKey) ?? '') === (min ? String(min) : '') &&
    (params.get(maxKey) ?? '') === (max ? String(max) : '');

  const setRange = (minKey: string, maxKey: string, min?: number, max?: number) => {
    if (rangeActive(minKey, maxKey, min, max)) {
      update({ [minKey]: undefined, [maxKey]: undefined });
    } else {
      update({ [minKey]: min ? String(min) : undefined, [maxKey]: max ? String(max) : undefined });
    }
  };

  const activeCount = ['type', 'style', 'minPrice', 'maxPrice', 'minDuration', 'maxDuration', 'minGroup', 'maxGroup', 'from', 'to', 'availableOnly', 'country'].filter(
    (key) => params.get(key),
  ).length;

  const clearAll = () => {
    const next = new URLSearchParams();
    const search = params.get('q');
    if (search) next.set('q', search);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const panel = (
    <div className="space-y-7">
      <FilterGroup label="Trip type">
        <div className="flex flex-wrap gap-2">
          {TRIP_TYPES.map((type) => (
            <Chip key={type} active={inList('type', type)} onClick={() => toggleInList('type', type)}>
              {TRIP_TYPE_LABELS[type]}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      <Divider />

      <FilterGroup label="Dates">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.75rem] font-medium text-ink-muted">Departing after</span>
            <input
              type="date"
              value={params.get('from') ?? ''}
              onChange={(event) => update({ from: event.target.value })}
              className="h-11 rounded-[--radius-field] border border-line-strong px-3 text-[0.875rem] focus:border-acacia-600 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.75rem] font-medium text-ink-muted">Back before</span>
            <input
              type="date"
              value={params.get('to') ?? ''}
              onChange={(event) => update({ to: event.target.value })}
              className="h-11 rounded-[--radius-field] border border-line-strong px-3 text-[0.875rem] focus:border-acacia-600 focus:outline-none"
            />
          </label>
        </div>
      </FilterGroup>

      <Divider />

      <FilterGroup label="Duration">
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map((option) => (
            <Chip
              key={option.label}
              active={rangeActive('minDuration', 'maxDuration', option.min, option.max)}
              onClick={() => setRange('minDuration', 'maxDuration', option.min, option.max)}
            >
              {option.label}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      <Divider />

      <FilterGroup label="Price per person (TZS)">
        <div className="flex flex-wrap gap-2">
          {PRICES.map((option) => (
            <Chip
              key={option.label}
              active={rangeActive('minPrice', 'maxPrice', option.min, option.max)}
              onClick={() => setRange('minPrice', 'maxPrice', option.min, option.max)}
            >
              {option.label}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      <Divider />

      <FilterGroup label="Group size">
        <div className="flex flex-wrap gap-2">
          {GROUP_SIZES.map((option) => (
            <Chip
              key={option.label}
              active={rangeActive('minGroup', 'maxGroup', option.min, option.max)}
              onClick={() => setRange('minGroup', 'maxGroup', option.min, option.max)}
            >
              {option.label}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      <Divider />

      <FilterGroup label="Travel style">
        <div className="flex flex-wrap gap-2">
          {TRAVEL_STYLES.map((style) => (
            <Chip key={style} active={inList('style', style)} onClick={() => toggleInList('style', style)}>
              {TRAVEL_STYLE_LABELS[style]}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      <Divider />

      <FilterGroup label="Availability">
        <Chip
          active={params.get('availableOnly') === 'true'}
          onClick={() =>
            update({ availableOnly: params.get('availableOnly') === 'true' ? undefined : 'true' })
          }
        >
          Only trips with seats left
        </Chip>
      </FilterGroup>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block">
        <div className="sticky top-28">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-[0.9375rem] font-bold tracking-tight">Filters</h2>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-[0.8125rem] font-semibold text-acacia-700 hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="max-h-[calc(100vh-12rem)] overflow-y-auto pr-2">{panel}</div>
        </div>
      </aside>

      {/* Mobile trigger + sort, sticky under the header */}
      <div className="sticky top-16 z-30 -mx-5 mb-6 flex items-center gap-3 border-b border-line bg-white/95 px-5 py-3 backdrop-blur-xl md:top-[4.5rem] lg:hidden">
        <Button variant="secondary" size="sm" onClick={() => setSheetOpen(true)} className="shrink-0">
          <Icon.filter />
          Filters
          {activeCount > 0 && (
            <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1.5 text-[0.6875rem] font-bold text-white">
              {activeCount}
            </span>
          )}
        </Button>
        <SortSelect value={params.get('sort') ?? 'recommended'} onChange={(value) => update({ sort: value })} />
      </div>

      {/* Desktop sort sits with the result count */}
      <div className="hidden lg:block">
        <SortSelect
          value={params.get('sort') ?? 'recommended'}
          onChange={(value) => update({ sort: value })}
          className="w-56"
        />
      </div>

      {/* Mobile sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white lg:hidden">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-5">
            <h2 className="text-[1.0625rem] font-bold tracking-tight">Filters</h2>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              aria-label="Close filters"
              className="inline-flex h-11 w-11 items-center justify-center rounded-[--radius-field] hover:bg-sand"
            >
              <Icon.close />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-6">{panel}</div>
          <div className="flex shrink-0 gap-3 border-t border-line p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button variant="secondary" size="lg" onClick={clearAll} className="flex-1">
              Clear
            </Button>
            <Button size="lg" onClick={() => setSheetOpen(false)} className="flex-[2]">
              Show {total} {total === 1 ? 'trip' : 'trips'}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-[0.8125rem] font-bold tracking-tight text-ink">{label}</h3>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'min-h-10 rounded-[--radius-pill] border px-3.5 text-[0.8125rem] font-semibold transition-all duration-150',
        active
          ? 'border-ink bg-ink text-white'
          : 'border-line-strong bg-white text-ink-soft hover:border-ink hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

function SortSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cx('relative flex-1', className)}>
      <label htmlFor="trip-sort" className="sr-only">
        Sort trips
      </label>
      <select
        id="trip-sort"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full cursor-pointer appearance-none rounded-[--radius-field] border border-line-strong bg-white pl-3.5 pr-9 text-[0.8125rem] font-semibold text-ink focus:border-acacia-600 focus:outline-none"
      >
        {SORTS.map((sort) => (
          <option key={sort.value} value={sort.value}>
            {sort.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}
