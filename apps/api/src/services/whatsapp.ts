import { NOTIFY_ENQUIRY_TYPES, ENQUIRY_TYPE_LABELS } from '@enhakkore/shared';
import { env } from '../env';
import { prisma } from '../lib/prisma';
import { getSettings } from './settings';

/**
 * Automatic WhatsApp notices to the Enhakkore team, through Meta's WhatsApp
 * Business Platform (Cloud API).
 *
 * This only sends when the platform is configured:
 *   WHATSAPP_ACCESS_TOKEN     a permanent system-user token
 *   WHATSAPP_PHONE_NUMBER_ID  the sending business number's id
 *   WHATSAPP_TEMPLATE_NAME    an approved template with one body variable
 *                             (needed for messages outside a 24-hour window)
 *   WHATSAPP_TEMPLATE_LANG    the template's language code (default en)
 *
 * Without it nothing is pretended: the enquiry is saved, its notice is marked
 * NOT_CONFIGURED, and the control centre offers a one-tap manual WhatsApp link.
 * Every attempt is written to NotificationDelivery, sent or not.
 */

export type NotifyOutcome = 'NOT_REQUIRED' | 'NOT_CONFIGURED' | 'SENT' | 'FAILED';

export function whatsappConfigured(): boolean {
  return !!(process.env.WHATSAPP_ACCESS_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim());
}

/** The team numbers marked "WhatsApp" in Settings → Contacts. */
export async function teamWhatsappNumbers(): Promise<string[]> {
  const settings = await getSettings();
  return settings.contact.numbers.filter((number) => number.whatsapp && number.digits).map((number) => number.digits);
}

/** Test hook: messages "sent" while NODE_ENV=test. */
export const whatsappTestOutbox: { to: string; text: string }[] = [];

async function sendOne(to: string, text: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (env.nodeEnv === 'test') {
    whatsappTestOutbox.push({ to, text });
    return { ok: true, id: `test-${whatsappTestOutbox.length}` };
  }
  const token = process.env.WHATSAPP_ACCESS_TOKEN!.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!.trim();
  const template = process.env.WHATSAPP_TEMPLATE_NAME?.trim();
  const body = template
    ? {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG?.trim() || 'en' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: text.slice(0, 1000) }] }],
        },
      }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: text.slice(0, 4000) } };
  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(phoneId)}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const json = (await response.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
    if (!response.ok) return { ok: false, error: json.error?.message ?? `HTTP ${response.status}` };
    return { ok: true, id: json.messages?.[0]?.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

/** Sends one notice to every team WhatsApp number. Never throws. */
export async function notifyTeam(summary: string, text: string, subject?: { type: string; id: string }): Promise<NotifyOutcome> {
  const numbers = await teamWhatsappNumbers();
  const configured = whatsappConfigured();
  if (!configured || numbers.length === 0) {
    await prisma.notificationDelivery.create({
      data: {
        channel: 'WHATSAPP',
        recipient: numbers.join(', ') || '—',
        subjectType: subject?.type ?? null,
        subjectId: subject?.id ?? null,
        summary,
        status: 'NOT_CONFIGURED',
        error: numbers.length === 0 ? 'No team number is marked WhatsApp in Settings → Contacts.' : 'WhatsApp Business Platform credentials are not set on the API.',
      },
    });
    return 'NOT_CONFIGURED';
  }
  let anySent = false;
  for (const to of numbers) {
    const result = await sendOne(to, text);
    anySent ||= result.ok;
    await prisma.notificationDelivery.create({
      data: {
        channel: 'WHATSAPP',
        recipient: to,
        subjectType: subject?.type ?? null,
        subjectId: subject?.id ?? null,
        summary,
        status: result.ok ? 'SENT' : 'FAILED',
        providerId: result.id ?? null,
        error: result.error ?? null,
      },
    });
  }
  return anySent ? 'SENT' : 'FAILED';
}

interface EnquiryLike {
  id: string;
  reference: string;
  type: string;
  subjectTitle: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  startDate: Date | null;
  endDate: Date | null;
  people: number | null;
  message: string;
  details: string;
}

export function enquiryNoticeText(enquiry: EnquiryLike): string {
  const details = (() => {
    try {
      return Object.entries(JSON.parse(enquiry.details) as Record<string, string>).filter(([, value]) => value);
    } catch {
      return [];
    }
  })();
  const day = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : '');
  return [
    `New ${ENQUIRY_TYPE_LABELS[enquiry.type] ?? enquiry.type} — ${enquiry.reference}`,
    enquiry.subjectTitle ? `For: ${enquiry.subjectTitle}` : '',
    `From: ${enquiry.name}${enquiry.phone ? `, ${enquiry.phone}` : ''}${enquiry.email ? `, ${enquiry.email}` : ''}`,
    enquiry.startDate ? `Dates: ${day(enquiry.startDate)}${enquiry.endDate ? ` → ${day(enquiry.endDate)}` : ''}` : '',
    enquiry.people ? `People: ${enquiry.people}` : '',
    ...details.map(([key, value]) => `${key}: ${value}`),
    `Message: ${enquiry.message}`,
    'Open the Enhakkore control centre → Enquiries to follow up.',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Sends the team notice for an enquiry and records the outcome on it. */
export async function notifyEnquiry(enquiry: EnquiryLike): Promise<NotifyOutcome> {
  if (!NOTIFY_ENQUIRY_TYPES.includes(enquiry.type)) return 'NOT_REQUIRED';
  const outcome = await notifyTeam(`${enquiry.reference} ${ENQUIRY_TYPE_LABELS[enquiry.type] ?? enquiry.type}`, enquiryNoticeText(enquiry), {
    type: 'ENQUIRY',
    id: enquiry.id,
  });
  const failure =
    outcome === 'SENT'
      ? null
      : (await prisma.notificationDelivery.findFirst({ where: { subjectType: 'ENQUIRY', subjectId: enquiry.id }, orderBy: { createdAt: 'desc' } }))?.error ?? null;
  await prisma.enquiry.update({ where: { id: enquiry.id }, data: { notifyStatus: outcome, notifyError: failure } });
  return outcome;
}
