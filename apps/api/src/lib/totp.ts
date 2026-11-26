import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../env';

/**
 * Time-based one-time passwords (RFC 6238) for two-factor sign-in with any
 * authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…).
 * SHA-1, 30-second steps, 6 digits — the settings every app supports.
 *
 * Secrets are stored encrypted (AES-256-GCM) with a key derived from the
 * server's signing secret, so a database copy alone cannot generate codes.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    value = (value << 5) | ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpCode(secret: string, at = Date.now()): string {
  const counter = Math.floor(at / 30000);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', base32Decode(secret)).update(buffer).digest();
  const offset = hmac[hmac.length - 1]! & 15;
  const code = ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString();
  return code.padStart(6, '0');
}

/** Accepts the current code and one step either side, for clock drift. */
export function verifyTotp(secret: string, code: string, at = Date.now()): boolean {
  const given = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(given)) return false;
  return [-1, 0, 1].some((step) => {
    const expected = Buffer.from(totpCode(secret, at + step * 30000));
    return timingSafeEqual(expected, Buffer.from(given));
  });
}

export function otpauthUrl(secret: string, account: string): string {
  const issuer = 'Enhakkore';
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

const key = () => createHash('sha256').update(`${env.jwtSecret}:totp`).digest();

export function encryptSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64')).join('.');
}

export function decryptSecret(stored: string): string | null {
  try {
    const [iv, tag, data] = stored.split('.').map((part) => Buffer.from(part, 'base64'));
    const decipher = createDecipheriv('aes-256-gcm', key(), iv!);
    decipher.setAuthTag(tag!);
    return Buffer.concat([decipher.update(data!), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
