import {
  DEFAULT_SETTINGS,
  SETTINGS_GROUPS,
  mergeSettings,
  type SettingsGroup,
  type SiteSettings,
} from '@enhakkore/shared';
import { prisma } from '../lib/prisma';

const KEY_PREFIX = 'site.';

let cache: { value: SiteSettings; at: number } | null = null;
const TTL_MS = 15_000;

/** The website's settings, stored values over the defaults. Cached briefly. */
export async function getSettings(): Promise<SiteSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const rows = await prisma.platformSetting.findMany({
    where: { key: { startsWith: KEY_PREFIX } },
  });
  const stored: Partial<Record<SettingsGroup, unknown>> = {};
  for (const row of rows) {
    const group = row.key.slice(KEY_PREFIX.length) as SettingsGroup;
    if (!SETTINGS_GROUPS.includes(group)) continue;
    try {
      stored[group] = JSON.parse(row.value);
    } catch {
      /* a corrupt value falls back to the default */
    }
  }
  const value = mergeSettings(stored);
  cache = { value, at: Date.now() };
  return value;
}

export function clearSettingsCache(): void {
  cache = null;
}

/** Writes one group. Returns the previous and new values for the audit trail. */
export async function saveSettingsGroup<G extends SettingsGroup>(
  group: G,
  value: SiteSettings[G],
): Promise<{ before: SiteSettings[G]; after: SiteSettings[G] }> {
  const before = (await getSettings())[group];
  await prisma.platformSetting.upsert({
    where: { key: KEY_PREFIX + group },
    create: { key: KEY_PREFIX + group, value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  });
  clearSettingsCache();
  return { before, after: value };
}

export { DEFAULT_SETTINGS };
