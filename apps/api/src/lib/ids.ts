import crypto from 'node:crypto';

// Crockford-style alphabet: no I, L, O, U — booking codes get read aloud over
// the phone and dictated at pickup points.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function shortCode(length = 6): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export function bookingReference(): string {
  return `ENH-${shortCode(6)}`;
}

export function paymentReference(prefix = 'PAY'): string {
  return `${prefix}-${shortCode(8)}`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

/** Appends a short suffix so slugs stay unique without a database round-trip loop. */
export function uniqueSlug(value: string): string {
  return `${slugify(value)}-${shortCode(4).toLowerCase()}`;
}
