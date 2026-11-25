import type { Request } from 'express';
import { prisma } from '../lib/prisma';

/** Field names whose values never go into the audit log, whatever the record. */
const SECRET_KEYS = /password|passwordhash|token|secret|apikey|api_key|signature|pin/i;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[…]';
  if (Array.isArray(value)) return value.map((item) => scrub(item, depth + 1));
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEYS.test(key) ? '[hidden]' : scrub(item, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 4000) return `${value.slice(0, 4000)}…`;
  return value;
}

/** Only the fields that changed, before and after. Keeps the log readable. */
export function changedFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const key of keys) {
    if (key === 'updatedAt' || key === 'createdAt') continue;
    const x = before?.[key];
    const y = after?.[key];
    const xs = x instanceof Date ? x.toISOString() : JSON.stringify(x ?? null);
    const ys = y instanceof Date ? y.toISOString() : JSON.stringify(y ?? null);
    if (xs !== ys) {
      b[key] = x ?? null;
      a[key] = y ?? null;
    }
  }
  return { before: b, after: a };
}

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  before?: unknown;
  after?: unknown;
  sensitive?: boolean;
}

/**
 * Writes one line to the audit trail. Failures are logged, never thrown: a
 * change that succeeded must not be reported as failed because its log line
 * could not be written — but they are loud, because a silent gap is worse.
 */
export async function audit(req: Request | null, entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: req?.auth?.id ?? null,
        actorName: req?.auth ? `${req.auth.name} (${req.auth.email})` : 'System',
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        summary: entry.summary.slice(0, 500),
        before: entry.before === undefined ? null : JSON.stringify(scrub(entry.before)),
        after: entry.after === undefined ? null : JSON.stringify(scrub(entry.after)),
        sensitive: entry.sensitive ?? false,
        ip: req?.ip ?? null,
      },
    });
  } catch (error) {
    console.error('[audit] FAILED to write audit entry:', entry.summary, error instanceof Error ? error.message : error);
  }
}
