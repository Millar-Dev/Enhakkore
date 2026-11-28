/**
 * SQLite has no JSON column type in Prisma, so structured lists (gallery,
 * includes, allocation…) are stored as JSON strings. These helpers are the only
 * place that knows about the encoding — swap the datasource to PostgreSQL and
 * these become pass-throughs.
 */

export function parseList(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function parseObjects<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function parseRecord<T extends object>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

export function stringify(value: unknown): string {
  return JSON.stringify(value ?? []);
}

/** A small JSON setting kept in the platform settings table, with defaults filled in. */
export async function readJsonSetting<T extends object>(key: string, defaults: T): Promise<T> {
  const { prisma } = await import('./prisma');
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  if (!row) return defaults;
  try {
    return { ...defaults, ...JSON.parse(row.value) };
  } catch {
    return defaults;
  }
}

export async function writeJsonSetting(key: string, value: object) {
  const { prisma } = await import('./prisma');
  await prisma.platformSetting.upsert({ where: { key }, create: { key, value: JSON.stringify(value) }, update: { value: JSON.stringify(value) } });
}
