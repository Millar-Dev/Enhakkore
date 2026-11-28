import { OPTIONAL_NOTIFICATIONS, hasPermission, notificationCategory, type NotificationType } from '@enhakkore/shared';
import { sendPush } from './push';
import { parseList } from '../lib/json';
import { prisma } from '../lib/prisma';

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  /** The same key for the same person never creates a second notification. */
  dedupeKey?: string | null;
}

interface Prefs {
  off?: string[];
  quietStart?: string | null;
  quietEnd?: string | null;
  channels?: { push?: boolean; email?: boolean; whatsapp?: boolean };
}

/**
 * Writes an in-app notification, then fans out to the channels the member
 * chose (browser push today; email when an email provider is connected).
 * Every caller routes through here.
 */
/** Which optional preference key (if any) controls a notification type. Essential types return null. */
function optionalKey(type: string) {
  return OPTIONAL_NOTIFICATIONS.find((item) => item.types.includes(type))?.key ?? null;
}

function parsePrefs(raw: string | null | undefined): Prefs {
  try {
    const value = JSON.parse(raw || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

/** Quiet hours are kept in East Africa Time (UTC+3), the platform's home time zone. */
export function inQuietHours(prefs: Prefs, at = new Date()) {
  if (!prefs.quietStart || !prefs.quietEnd) return false;
  const minutes = (at.getUTCHours() * 60 + at.getUTCMinutes() + 180) % 1440;
  const toMin = (text: string) => Number(text.slice(0, 2)) * 60 + Number(text.slice(3, 5));
  const start = toMin(prefs.quietStart);
  const end = toMin(prefs.quietEnd);
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

async function recipientsFor(userIds: string[], type: string) {
  const key = optionalKey(type);
  const rows = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, notificationPrefs: true } });
  return rows
    .map((row) => ({ id: row.id, prefs: parsePrefs(row.notificationPrefs) }))
    .filter((row) => !key || !(Array.isArray(row.prefs.off) && row.prefs.off.includes(key)));
}

async function fanOut(recipient: { id: string; prefs: Prefs }, input: Omit<NotifyInput, 'userId'>, notificationId: string) {
  // Push is on unless the member turned it off; it is held back during quiet hours
  // except for essential notices (which have no optional key).
  const pushOn = recipient.prefs.channels?.push !== false;
  const essential = !optionalKey(input.type);
  if (pushOn && (essential || !inQuietHours(recipient.prefs))) {
    await sendPush(recipient.id, { title: input.title, body: input.body, link: input.link, tag: notificationId }).catch(() => undefined);
  }
}

export async function notify(input: NotifyInput) {
  const [recipient] = await recipientsFor([input.userId], input.type);
  if (!recipient) return null;
  try {
    const created = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        category: notificationCategory(input.type),
        title: input.title,
        body: input.body,
        link: input.link ?? null,
        dedupeKey: input.dedupeKey ?? null,
      },
    });
    void fanOut(recipient, input, created.id);
    return created;
  } catch (error) {
    // Unique (userId, dedupeKey): this event was already notified.
    if ((error as { code?: string }).code === 'P2002') return null;
    throw error;
  }
}

export async function notifyMany(userIds: string[], input: Omit<NotifyInput, 'userId'>) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;
  const recipients = await recipientsFor(unique, input.type);
  if (recipients.length === 0) return;
  if (input.dedupeKey) {
    for (const recipient of recipients) await notify({ ...input, userId: recipient.id });
    return;
  }
  await prisma.notification.createMany({
    data: recipients.map((recipient) => ({
      userId: recipient.id,
      type: input.type,
      category: notificationCategory(input.type),
      title: input.title,
      body: input.body,
      link: input.link ?? null,
    })),
  });
  for (const recipient of recipients) void fanOut(recipient, input, `${input.type}-${Date.now()}`);
}

/**
 * Notifies every team member whose role has this permission — the people
 * responsible for that kind of request — in their control-centre bell.
 */
export async function notifyStaff(permission: string, input: Omit<NotifyInput, 'userId'>) {
  const team = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'STAFF'] }, status: 'ACTIVE' },
    include: { adminRole: true, extraRoles: { include: { role: true } } },
  });
  const granted = (user: (typeof team)[number]) =>
    [user.adminRole, ...user.extraRoles.map((item) => item.role)].flatMap((item) => (item ? parseList(item.permissions) : []));
  const ids = team
    .filter((user) => (user.role === 'ADMIN' ? true : hasPermission(granted(user), permission)))
    .map((user) => user.id);
  await notifyMany(ids, input);
  return ids.length;
}
