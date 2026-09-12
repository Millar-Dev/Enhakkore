import type { Money } from '@enhakkore/shared';
import { formatMoney } from '@enhakkore/shared';

export { formatMoney };

/** `TZS 450,000` */
export function price(value: Money | null | undefined, compact = false): string {
  if (!value) return '—';
  return formatMoney(value, { compact });
}

/**
 * Dates are formatted with an explicit UTC timezone so the server and the
 * browser produce the same string. Without this, a traveller west of UTC sees a
 * hydration mismatch on every departure date.
 */
const DATE_OPTS: Intl.DateTimeFormatOptions = { timeZone: 'UTC' };

export function formatDate(value: string | Date, style: 'short' | 'long' | 'day' = 'short'): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';

  if (style === 'long') {
    return date.toLocaleDateString('en-GB', { ...DATE_OPTS, day: 'numeric', month: 'long', year: 'numeric' });
  }
  if (style === 'day') {
    return date.toLocaleDateString('en-GB', { ...DATE_OPTS, weekday: 'short', day: 'numeric', month: 'short' });
  }
  return date.toLocaleDateString('en-GB', { ...DATE_OPTS, day: 'numeric', month: 'short' });
}

/** `12–14 Sep` or `28 Sep – 2 Oct` — collapses the month when it repeats. */
export function dateRange(start: string | Date, end: string | Date): string {
  const from = typeof start === 'string' ? new Date(start) : start;
  const to = typeof end === 'string' ? new Date(end) : end;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return '—';

  const sameMonth = from.getUTCMonth() === to.getUTCMonth() && from.getUTCFullYear() === to.getUTCFullYear();
  const month = to.toLocaleDateString('en-GB', { ...DATE_OPTS, month: 'short' });

  if (sameMonth) {
    return `${from.getUTCDate()}–${to.getUTCDate()} ${month}`;
  }
  return `${formatDate(from)} – ${formatDate(to)}`;
}

/** `3 days / 2 nights` */
export function duration(days: number, nights: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'} / ${nights} ${nights === 1 ? 'night' : 'nights'}`;
}

/** `2 hours ago`, `3 days ago` — used in chat and update timelines. */
export function timeAgo(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

/** Whole days until a date, or null when it is in the past. */
export function daysUntil(value: string | Date): number | null {
  const date = typeof value === 'string' ? new Date(value) : value;
  const diff = date.getTime() - Date.now();
  if (diff < 0) return null;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Turns SCREAMING_SNAKE into Sentence case for statuses without a label map. */
export function humanise(value: string): string {
  const lower = value.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function pluralise(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : plural ?? `${singular}s`}`;
}
