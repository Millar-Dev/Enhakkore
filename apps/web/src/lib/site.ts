import { cache } from 'react';
import {
  DEFAULT_SETTINGS,
  fillMessage,
  whatsappLink,
  type SiteSettings,
  type WhatsAppContext,
} from '@enhakkore/shared';
import { apiGet } from './api';

export interface PublicPaymentMethod {
  id: string;
  name: string;
  kind: string;
  provider: string | null;
  accountName: string | null;
  accountNumber: string | null;
  extraDetails: string | null;
  instructions: string | null;
  referenceFormat: string | null;
  currencies: string[];
  scopes: string[];
  isDefault: boolean;
}

export interface Banner {
  id: string;
  message: string;
  linkLabel: string | null;
  linkUrl: string | null;
  placement: string;
  tone: string;
  imageUrl: string | null;
}

export interface Site {
  settings: SiteSettings;
  banners: Banner[];
  paymentMethods: PublicPaymentMethod[];
  /** False when the API could not be reached and defaults are being shown. */
  live: boolean;
}

/**
 * The website's settings, banners and payment methods — everything the owner
 * edits in the control centre. Read once per request (React cache) and kept
 * for a minute. If the API is unreachable the site still renders with the
 * official defaults, rather than failing.
 */
export const getSite = cache(async (): Promise<Site> => {
  const data = await apiGet<Omit<Site, 'live'>>('/public/site', 60);
  if (!data) return { settings: DEFAULT_SETTINGS, banners: [], paymentMethods: [], live: false };
  return { ...data, live: true };
});

/** A WhatsApp link to a given number (defaults to the primary one) with the right prefilled message. */
export function waHref(settings: SiteSettings, context: WhatsAppContext, title?: string | null, numberIndex = 0): string {
  const numbers = settings.contact.numbers.filter((number) => number.whatsapp);
  const number = numbers[numberIndex] ?? numbers[0];
  if (!number) return '/contact';
  return whatsappLink(number.digits, fillMessage(settings.whatsapp[context] ?? settings.whatsapp.general, title));
}

export function waNumbers(settings: SiteSettings) {
  return settings.contact.numbers.filter((number) => number.whatsapp);
}
