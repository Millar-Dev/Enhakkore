import { OPTIONAL_NOTIFICATIONS, hasPermission, type NotificationType } from '@enhakkore/shared';
import { parseList } from '../lib/json';
import { prisma } from '../lib/prisma';

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
}

/**
 * Writes an in-app notification.
 *
 * Email, SMS and push are not connected in this build. When they are, this is
 * the single place that fans out — every caller already routes through here.
 */
/** Which optional preference key (if any) controls a notification type. Essential types return null. */
function optionalKey(type: string) {
  return OPTIONAL_NOTIFICATIONS.find((item) => item.types.includes(type))?.key ?? null;
}

/** Members who switched this optional type off. Essential notices are never filtered. */
async function mutedUsers(userIds: string[], type: string) {
  const key = optionalKey(type);
  if (!key || userIds.length === 0) return new Set<string>();
  const rows = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, notificationPrefs: true } });
  const muted = new Set<string>();
  for (const row of rows) {
    try {
      const prefs = JSON.parse(row.notificationPrefs || '{}');
      if (Array.isArray(prefs.off) && prefs.off.includes(key)) muted.add(row.id);
    } catch {
      /* malformed preferences: send */
    }
  }
  return muted;
}

export async function notify(input: NotifyInput) {
  if ((await mutedUsers([input.userId], input.type)).has(input.userId)) return null;
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
    },
  });
}

export async function notifyMany(userIds: string[], input: Omit<NotifyInput, 'userId'>) {
  if (userIds.length === 0) return;
  const muted = await mutedUsers(userIds, input.type);
  const recipients = userIds.filter((id) => !muted.has(id));
  if (recipients.length === 0) return;
  await prisma.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
    })),
  });
}

/**
 * Notifies every team member whose role has this permission — the people
 * responsible for that kind of request — in their control-centre bell.
 */
export async function notifyStaff(permission: string, input: Omit<NotifyInput, 'userId'>) {
  const team = await prisma.user.findMany({ where: { role: { in: ['ADMIN', 'STAFF'] }, status: 'ACTIVE' }, include: { adminRole: true } });
  const ids = team
    .filter((user) => (user.role === 'ADMIN' ? true : hasPermission(user.adminRole ? parseList(user.adminRole.permissions) : [], permission)))
    .map((user) => user.id);
  await notifyMany(ids, input);
  return ids.length;
}
