import { prisma } from '../lib/prisma';

/**
 * The member's Activity Centre: a plain history of what they did. It is not an
 * official record — bookings, payments and tournament entries keep their own.
 * Writing it never blocks or fails the action that triggered it.
 */
export function recordActivity(input: { userId: string; action: string; title: string; link?: string | null; subjectType?: string; subjectId?: string }) {
  return prisma.memberActivity
    .create({ data: { userId: input.userId, action: input.action, title: input.title.slice(0, 200), link: input.link ?? null, subjectType: input.subjectType ?? null, subjectId: input.subjectId ?? null } })
    .catch(() => undefined);
}
