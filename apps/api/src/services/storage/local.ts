import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../../env';
import { ApiError } from '../../lib/http';
import { UPLOAD_RULES, type FileStorage, type UploadClaim, type UploadKind, type UploadTicket } from './index';

/**
 * Files on the local disk, for development and tests.
 *
 * The browser posts the file to this API instead of to Cloudinary, but every
 * other step is identical, so the website's upload code has a single path and
 * the real adapter is not left untested by proxy.
 *
 * This is deliberately not production storage: hosting replaces the disk on
 * every deploy, so anything written here disappears with the next release.
 */

const PUBLIC_MOUNT = '/uploads';

/** Signs short-lived permissions: an upload slot, or a link to a private file. */
function token(payload: Record<string, string | number>, ttlSeconds: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlSeconds * 1000 })).toString(
    'base64url',
  );
  const signature = crypto.createHmac('sha256', env.jwtSecret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function openToken(value: string): Record<string, string | number> {
  const [body, signature] = value.split('.');
  if (!body || !signature) throw ApiError.unprocessable('That upload link is not valid.', 'upload_token');

  const expected = crypto.createHmac('sha256', env.jwtSecret).update(body).digest('base64url');
  const given = Buffer.from(signature);
  const ours = Buffer.from(expected);
  if (given.length !== ours.length || !crypto.timingSafeEqual(given, ours)) {
    throw ApiError.unprocessable('That upload link is not valid.', 'upload_token');
  }

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<string, string | number>;
  if (typeof payload.exp !== 'number' || payload.exp < Date.now()) {
    throw ApiError.unprocessable('That upload link has expired. Try again.', 'upload_expired');
  }
  return payload;
}

/**
 * Where a file sits on disk. Public and private files are kept apart so the
 * directory served to the world cannot contain a verification document, and
 * the id is scrubbed so it can never climb out of its folder.
 */
function diskPath(kind: UploadKind, assetId: string, format: string): string {
  const safe = assetId
    .split('/')
    .map((segment) => segment.replace(/[^a-zA-Z0-9_-]/g, ''))
    .filter(Boolean)
    .join('/');
  const safeFormat = format.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin';
  return path.join(env.storage.localDir, UPLOAD_RULES[kind].visibility, `${safe}.${safeFormat}`);
}

function signContents(assetId: string, version: string): string {
  return crypto.createHmac('sha256', env.jwtSecret).update(`${assetId}:${version}`).digest('hex');
}

/** Accepts a file that a signed ticket allows. Called by the upload route. */
export function acceptLocalUpload(
  ticketToken: string,
  file: { bytes: Buffer; contentType: string },
): { assetId: string; version: string; signature: string; format: string; bytes: number } {
  const payload = openToken(ticketToken);
  const kind = payload.kind as UploadKind;
  const assetId = String(payload.assetId);
  if (!UPLOAD_RULES[kind]) throw ApiError.unprocessable('That upload link is not valid.', 'upload_token');

  const format = file.contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
  const target = diskPath(kind, assetId, format);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, file.bytes);

  const version = String(Math.floor(Date.now() / 1000));
  return { assetId, version, signature: signContents(assetId, version), format, bytes: file.bytes.length };
}

/** Resolves a private-file link back to a path on disk, or throws. */
export function openLocalPrivateToken(value: string): { file: string; format: string } {
  const payload = openToken(value);
  const format = String(payload.format);
  return { file: diskPath(payload.kind as UploadKind, String(payload.assetId), format), format };
}

export function localStorage(): FileStorage {
  return {
    name: 'local',
    isDurable: false,

    ticket(kind: UploadKind, assetId: string, baseUrl: string): UploadTicket {
      const rule = UPLOAD_RULES[kind];
      return {
        provider: 'local',
        kind,
        uploadUrl: `${baseUrl}/api/uploads/local`,
        fields: { ticket: token({ kind, assetId }, 15 * 60) },
        assetId,
        maxBytes: rule.maxBytes,
        accept: rule.accept,
      };
    },

    async verify(kind: UploadKind, claim: UploadClaim, baseUrl: string) {
      const expected = signContents(claim.assetId, claim.version);
      const given = Buffer.from(claim.signature ?? '');
      const ours = Buffer.from(expected);
      if (given.length !== ours.length || !crypto.timingSafeEqual(given, ours)) {
        throw ApiError.unprocessable('That upload could not be verified.', 'upload_unverified');
      }

      const format = (claim.format ?? 'bin').replace(/[^a-z0-9]/gi, '').toLowerCase();
      const file = diskPath(kind, claim.assetId, format);
      if (!fs.existsSync(file)) {
        throw ApiError.unprocessable('That upload could not be found.', 'upload_missing');
      }

      const rule = UPLOAD_RULES[kind];
      return {
        assetId: claim.assetId,
        url: rule.visibility === 'public' ? `${baseUrl}${PUBLIC_MOUNT}/${claim.assetId}.${format}` : null,
        format,
        bytes: fs.statSync(file).size,
      };
    },

    async privateUrl(assetId: string, format: string, baseUrl: string) {
      const value = token({ kind: 'VERIFICATION_DOCUMENT', assetId, format }, 600);
      return `${baseUrl}/api/uploads/file/${value}`;
    },

    async remove(kind: UploadKind, assetId: string) {
      for (const format of ['jpg', 'png', 'webp', 'avif', 'pdf', 'bin']) {
        fs.rmSync(diskPath(kind, assetId, format), { force: true });
      }
    },
  };
}

export const LOCAL_PUBLIC_MOUNT = PUBLIC_MOUNT;
