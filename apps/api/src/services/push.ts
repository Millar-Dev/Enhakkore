import webpush from 'web-push';
import { prisma } from '../lib/prisma';
import { env } from '../env';

/**
 * Web Push (browser notifications).
 *
 * Uses the standard VAPID scheme. If VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are
 * set on the API they are used; otherwise a key pair is generated once and kept
 * in the platform settings table, so push works without any third-party
 * account. A send counts as "accepted by the push service" — browsers do not
 * report whether a person actually saw it, and the site never claims they did.
 */

let keys: { publicKey: string; privateKey: string } | null = null;

export const pushTestOutbox: { userId: string; title: string; body: string; link?: string | null }[] = [];

async function vapidKeys() {
  if (keys) return keys;
  const fromEnv = process.env.VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim();
  if (fromEnv) {
    keys = { publicKey: process.env.VAPID_PUBLIC_KEY!.trim(), privateKey: process.env.VAPID_PRIVATE_KEY!.trim() };
    return keys;
  }
  const stored = await prisma.platformSetting.findUnique({ where: { key: 'push.vapid' } });
  if (stored) {
    keys = JSON.parse(stored.value);
    return keys!;
  }
  const generated = webpush.generateVAPIDKeys();
  // Two API instances racing here would both write; the first one wins and the other re-reads.
  try {
    await prisma.platformSetting.create({ data: { key: 'push.vapid', value: JSON.stringify(generated) } });
    keys = generated;
  } catch {
    const again = await prisma.platformSetting.findUnique({ where: { key: 'push.vapid' } });
    keys = again ? JSON.parse(again.value) : generated;
  }
  return keys!;
}

export async function publicVapidKey() {
  return (await vapidKeys()).publicKey;
}

export async function sendPush(userId: string, payload: { title: string; body: string; link?: string | null; tag?: string }) {
  if (env.nodeEnv === 'test') {
    pushTestOutbox.push({ userId, ...payload });
    return { accepted: 0 };
  }
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) return { accepted: 0 };
  const { publicKey, privateKey } = await vapidKeys();
  const subject = process.env.VAPID_SUBJECT?.trim() || `mailto:${process.env.EMAIL_FROM?.match(/<?([^<>\s]+@[^<>\s]+)>?/)?.[1] ?? 'support@enhakkore.app'}`;
  let accepted = 0;
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: payload.title, body: payload.body, url: payload.link ?? '/account/notifications', tag: payload.tag }),
          { TTL: 60 * 60, vapidDetails: { subject, publicKey, privateKey }, timeout: 8000 },
        );
        accepted += 1;
        await prisma.pushSubscription.update({ where: { id: sub.id }, data: { lastSuccessAt: new Date() } }).catch(() => undefined);
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // Gone or not found: the browser unsubscribed. Remove it so we stop trying.
        if (status === 404 || status === 410) await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
      }
    }),
  );
  return { accepted };
}
