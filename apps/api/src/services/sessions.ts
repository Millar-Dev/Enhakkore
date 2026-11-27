import type { Request } from 'express';
import { hasPermission } from '@enhakkore/shared';
import { parseList } from '../lib/json';
import { prisma } from '../lib/prisma';
import { toOrganizerSummary, toPublicUser } from '../serializers';

/** Records a sign-in attempt for the security centre. Never stores the password tried. */
export async function recordLogin(
  req: Pick<Request, 'ip' | 'headers'>,
  email: string,
  userId: string | null,
  success: boolean,
  reason: string,
): Promise<void> {
  await prisma.loginEvent.create({
    data: {
      email: email.slice(0, 200),
      userId,
      success,
      reason,
      ip: req.ip ?? null,
      userAgent: String(req.headers?.['user-agent'] ?? '').slice(0, 300) || null,
    },
  });
  if (success && userId) {
    await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  }
}

/** Effective control-centre permissions for an account. */
export function permissionsFor(user: { role: string; adminRole?: { permissions: string } | null }): string[] {
  if (user.role === 'ADMIN') return ['*'];
  if (user.role === 'STAFF' && user.adminRole) return parseList(user.adminRole.permissions);
  return [];
}

/** What the website needs about the signed-in account, permissions included. */
export async function sessionPayload(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { organizer: true, adminRole: true },
  });
  const permissions = permissionsFor(user);
  const organiser = await prisma.organiserApplication.findFirst({ where: { userId, status: 'APPROVED' }, orderBy: { updatedAt: 'desc' }, select: { approvedCategories: true } });
  let organiserSections: string[] = [];
  try {
    organiserSections = organiser ? JSON.parse(organiser.approvedCategories) : [];
  } catch {
    organiserSections = [];
  }
  return {
    user: {
      ...toPublicUser(user),
      permissions,
      organiserSections,
      adminRoleName: user.role === 'ADMIN' ? 'Owner' : (user.adminRole?.name ?? null),
      adminScope: user.role === 'STAFF' && user.adminRole?.scope === 'OWN' ? 'OWN' : 'ALL',
    },
    organizer: user.organizer ? toOrganizerSummary(user.organizer) : null,
  };
}

export { hasPermission };
