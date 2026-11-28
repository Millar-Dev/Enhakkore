import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../env';

/**
 * Encryption at rest for private messages (AES-256-GCM).
 *
 * The key comes from MESSAGE_ENCRYPTION_KEY (32 bytes, base64) when set, and
 * otherwise is derived from the server's JWT secret, so the database alone
 * never reveals message text. This is server-side encryption, not end-to-end:
 * the API can decrypt for the two members, and for audited moderation of a
 * reported message.
 */
let cached: Buffer | null = null;
function key(): Buffer {
  if (cached) return cached;
  const configured = process.env.MESSAGE_ENCRYPTION_KEY?.trim();
  if (configured) {
    const raw = Buffer.from(configured, 'base64');
    if (raw.length === 32) return (cached = raw);
  }
  return (cached = createHash('sha256').update(`${env.jwtSecret}:private-messages:v1`).digest());
}

export function encryptText(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join(':');
}

export function decryptText(stored: string): string {
  if (!stored.startsWith('v1:')) return stored;
  try {
    const [, iv, tag, body] = stored.split(':');
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv!, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag!, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(body!, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return '[This message could not be decrypted]';
  }
}

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
export const randomToken = (bytes = 24) => randomBytes(bytes).toString('base64url');
