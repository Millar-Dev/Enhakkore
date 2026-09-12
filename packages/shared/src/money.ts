/**
 * Money primitives.
 *
 * Every monetary value on the platform is stored as an INTEGER in the currency's
 * minor unit (TZS has 0 decimals, USD/EUR have 2). Never use floats for money.
 *
 * The currency registry is deliberately open-ended: Enhakkore starts in Tanzania
 * but the architecture must not hard-code TZS. Adding a market means adding a row
 * here plus an FX rate source — nothing else in the codebase changes.
 */

export interface CurrencyDefinition {
  /** ISO 4217 code. */
  code: string;
  /** Short symbol used in dense UI (cards, tables). */
  symbol: string;
  /** Number of decimal places in the minor unit. */
  decimals: number;
  /** Human label used in pickers. */
  label: string;
  /** BCP 47 locale used for Intl formatting. */
  locale: string;
}

export const CURRENCIES: Record<string, CurrencyDefinition> = {
  TZS: { code: 'TZS', symbol: 'TZS', decimals: 0, label: 'Tanzanian Shilling', locale: 'en-TZ' },
  KES: { code: 'KES', symbol: 'KSh', decimals: 2, label: 'Kenyan Shilling', locale: 'en-KE' },
  UGX: { code: 'UGX', symbol: 'USh', decimals: 0, label: 'Ugandan Shilling', locale: 'en-UG' },
  RWF: { code: 'RWF', symbol: 'FRw', decimals: 0, label: 'Rwandan Franc', locale: 'en-RW' },
  ZAR: { code: 'ZAR', symbol: 'R', decimals: 2, label: 'South African Rand', locale: 'en-ZA' },
  USD: { code: 'USD', symbol: '$', decimals: 2, label: 'US Dollar', locale: 'en-US' },
  EUR: { code: 'EUR', symbol: '€', decimals: 2, label: 'Euro', locale: 'en-IE' },
  AED: { code: 'AED', symbol: 'AED', decimals: 2, label: 'UAE Dirham', locale: 'en-AE' },
};

export const DEFAULT_CURRENCY = 'TZS';

export interface Money {
  /** Integer amount in the currency's minor unit. */
  amount: number;
  currency: string;
}

export function money(amount: number, currency: string = DEFAULT_CURRENCY): Money {
  return { amount: Math.round(amount), currency };
}

export function currencyDef(code: string): CurrencyDefinition {
  return CURRENCIES[code] ?? CURRENCIES[DEFAULT_CURRENCY];
}

/** Convert a human-entered major-unit value ("450000", "12.50") to minor units. */
export function toMinor(value: number, currency: string = DEFAULT_CURRENCY): number {
  const { decimals } = currencyDef(currency);
  return Math.round(value * 10 ** decimals);
}

/** Convert stored minor units back to a major-unit number. */
export function toMajor(amount: number, currency: string = DEFAULT_CURRENCY): number {
  const { decimals } = currencyDef(currency);
  return amount / 10 ** decimals;
}

export interface FormatMoneyOptions {
  /** Render 10,800,000 as "10.8M". Used in stat tiles and dense cards. */
  compact?: boolean;
  /** Hide the currency code/symbol entirely. */
  bare?: boolean;
}

/**
 * Format money for display. Kept dependency-free and deterministic so the same
 * string is produced on the server and in the browser (no hydration mismatch).
 */
export function formatMoney(input: Money, options: FormatMoneyOptions = {}): string {
  const def = currencyDef(input.currency);
  const major = toMajor(input.amount, input.currency);

  let body: string;
  if (options.compact && Math.abs(major) >= 1_000_000) {
    body = `${trimZeros((major / 1_000_000).toFixed(1))}M`;
  } else if (options.compact && Math.abs(major) >= 10_000) {
    body = `${trimZeros((major / 1_000).toFixed(0))}K`;
  } else {
    body = groupDigits(major.toFixed(def.decimals));
  }

  if (options.bare) return body;
  // Symbol-before for Western currencies, code-before for African shillings —
  // matches how prices are actually written in each market.
  return def.decimals === 2 && def.symbol.length <= 2 ? `${def.symbol}${body}` : `${def.symbol} ${body}`;
}

function groupDigits(value: string): string {
  const [whole, fraction] = value.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction ? `${grouped}.${fraction}` : grouped;
}

function trimZeros(value: string): string {
  return value.replace(/\.0+$/, '');
}

/** Percentage of a goal reached, clamped to 0–100 and rounded to a whole number. */
export function progressPercent(raised: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((raised / goal) * 100)));
}
