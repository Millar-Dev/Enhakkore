import type { NotificationType } from '@enhakkore/shared';
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
export async function notify(input: NotifyInput) {
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
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
    })),
  });
}
