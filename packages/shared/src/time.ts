/**
 * Time zones.
 *
 * Every dated thing on the platform — an activity, an event, a departure — is
 * stored as a UTC instant together with the IANA time zone it happens in. The
 * administrator types the local time ("Saturday 7am in Lagos"); these helpers
 * turn that into the instant, and turn the instant back into the same local
 * time for every visitor, wherever they are reading from.
 *
 * Dependency-free: built on Intl, which every supported browser and Node
 * version ships with the full time zone database.
 */

export const DEFAULT_TIMEZONE = 'Africa/Dar_es_Salaam';

export function isValidTimeZone(zone: string | null | undefined): zone is string {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

interface Parts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function partsIn(instant: Date, zone: string): Parts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const out: Record<string, number> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== 'literal') out[part.type] = Number(part.value);
  }
  return {
    year: out.year!,
    month: out.month!,
    day: out.day!,
    hour: out.hour === 24 ? 0 : out.hour!,
    minute: out.minute!,
    second: out.second!,
  };
}

/** Minutes the zone is ahead of UTC at that instant (negative when behind). */
export function zoneOffsetMinutes(instant: Date, zone: string): number {
  const p = partsIn(instant, zone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/**
 * "2026-12-18T07:30" as wall-clock time in `zone` → the UTC instant.
 *
 * Accepts a date alone (midnight is assumed). Returns null for anything that
 * is not a real date. Daylight-saving gaps resolve forward, as clocks do.
 */
export function localToUtc(local: string, zone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(local.trim());
  if (!match) return null;
  const [, y, mo, d, h = '0', mi = '0', s = '0'] = match;
  const guess = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  if (Number.isNaN(guess)) return null;
  const tz = isValidTimeZone(zone) ? zone : 'UTC';
  // Two passes settle the offset even across a daylight-saving boundary.
  let instant = guess - zoneOffsetMinutes(new Date(guess), tz) * 60000;
  instant = guess - zoneOffsetMinutes(new Date(instant), tz) * 60000;
  return new Date(instant);
}

/** The UTC instant as "YYYY-MM-DDTHH:mm" wall-clock time in `zone` — what a form field shows. */
export function utcToLocalInput(value: string | Date | null | undefined, zone: string): string {
  if (!value) return '';
  const instant = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(instant.getTime())) return '';
  const p = partsIn(instant, isValidTimeZone(zone) ? zone : 'UTC');
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** A short zone label for display: "EAT", "GMT+1", "WAT"… */
export function zoneLabel(instant: Date, zone: string): string {
  try {
    const part = new Intl.DateTimeFormat('en-GB', { timeZone: zone, timeZoneName: 'short' })
      .formatToParts(instant)
      .find((p) => p.type === 'timeZoneName');
    return part?.value ?? zone;
  } catch {
    return zone;
  }
}

/**
 * Formats an instant in the zone where the thing happens, so "7:00" means 7am
 * at the venue for every reader. Deterministic across server and browser.
 */
export function formatInZone(
  value: string | Date,
  zone: string,
  style: 'date' | 'datetime' | 'time' | 'weekday' | 'full' = 'datetime',
): string {
  const instant = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(instant.getTime())) return '';
  const timeZone = isValidTimeZone(zone) ? zone : 'UTC';
  const options: Intl.DateTimeFormatOptions =
    style === 'date'
      ? { day: 'numeric', month: 'short', year: 'numeric' }
      : style === 'time'
        ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
        : style === 'weekday'
          ? { weekday: 'short', day: 'numeric', month: 'short' }
          : style === 'full'
            ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
            : { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone }).format(instant);
}

/**
 * The coming weekend in `zone`: from Friday 17:00 to Sunday 23:59 local time.
 * During a weekend, it is the current one, starting now.
 */
export function weekendWindow(zone: string, now: Date = new Date()): { start: Date; end: Date } {
  const tz = isValidTimeZone(zone) ? zone : 'UTC';
  const p = partsIn(now, tz);
  // Day of week of the local date (0 = Sunday).
  const localDay = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  const daysToFriday = localDay === 0 ? -2 : localDay === 6 ? -1 : 5 - localDay;
  const friday = new Date(Date.UTC(p.year, p.month - 1, p.day + daysToFriday));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const sunday = new Date(friday.getTime() + 2 * 86400000);
  const start = localToUtc(`${iso(friday)}T17:00`, tz)!;
  const end = localToUtc(`${iso(sunday)}T23:59:59`, tz)!;
  return { start: start < now && now < end ? now : start, end };
}
