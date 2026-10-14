import crypto from 'node:crypto';
import { env } from '../../env';
import { ApiError } from '../../lib/http';
import { cloudinaryStorage } from './cloudinary';
import { localStorage } from './local';

/**
 * Uploaded files.
 *
 * One seam, two adapters — the same shape as payments and email:
 *
 * - `local` (no Cloudinary credentials): files are written to disk beside the
 *   API. Fine while developing; useless on hosting, where the disk is wiped on
 *   every deploy, which is why production sets credentials.
 * - `cloudinary`: the browser uploads straight to Cloudinary, so a 6MB photo
 *   never travels through our server, which on the free hosting tier has
 *   little memory and a request timeout.
 *
 * Nothing is ever trusted from the browser. The API issues a ticket naming the
 * exact id the file must be stored under, and afterwards verifies the
 * provider's own signature before the id is written to the database.
 */

export type UploadKind = 'TRIP_IMAGE' | 'AVATAR' | 'VERIFICATION_DOCUMENT';

export interface UploadRule {
  /** Largest file accepted, in bytes. */
  maxBytes: number;
  /** Media types accepted, as the browser reports them. */
  accept: string[];
  /** Path files of this kind are stored under. */
  folder: string;
  /**
   * `public` files are served straight from the CDN — trip photos, avatars.
   * `private` files are reachable only through an API route that checks who is
   * asking: verification documents are someone's business papers.
   */
  visibility: 'public' | 'private';
}

export const UPLOAD_RULES: Record<UploadKind, UploadRule> = {
  TRIP_IMAGE: {
    maxBytes: 8 * 1024 * 1024,
    accept: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    folder: 'enhakkore/trips',
    visibility: 'public',
  },
  AVATAR: {
    maxBytes: 4 * 1024 * 1024,
    accept: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    folder: 'enhakkore/avatars',
    visibility: 'public',
  },
  VERIFICATION_DOCUMENT: {
    maxBytes: 10 * 1024 * 1024,
    accept: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    folder: 'enhakkore/verification',
    visibility: 'private',
  },
};

/** What the browser needs in order to send the file itself. */
export interface UploadTicket {
  provider: 'cloudinary' | 'local';
  kind: UploadKind;
  /** Where to POST the file, as multipart/form-data under the name `file`. */
  uploadUrl: string;
  /** Sent alongside the file, exactly as given. */
  fields: Record<string, string>;
  assetId: string;
  maxBytes: number;
  accept: string[];
}

/** What the browser reports back once the provider has accepted the file. */
export interface UploadClaim {
  assetId: string;
  version: string;
  signature: string;
  format?: string;
  bytes?: number;
}

/** A file the provider has confirmed it holds. */
export interface StoredAsset {
  assetId: string;
  /** Public address, or null for a private file, which has no public address. */
  url: string | null;
  format: string;
  bytes: number;
}

export interface FileStorage {
  name: 'cloudinary' | 'local';
  /** False while files live on a disk that hosting throws away. */
  isDurable: boolean;
  ticket(kind: UploadKind, assetId: string, baseUrl: string): UploadTicket;
  /** Confirms the browser's claim; throws if the file is not really there. */
  verify(kind: UploadKind, claim: UploadClaim, baseUrl: string): Promise<StoredAsset>;
  /** A link to a private file that stops working shortly afterwards. */
  privateUrl(assetId: string, format: string, baseUrl: string): Promise<string>;
  remove(kind: UploadKind, assetId: string): Promise<void>;
}

/**
 * The id a file will be stored under.
 *
 * The owner's id is part of the path, so a verification document can never be
 * claimed by another account: the API only accepts an id whose path matches the
 * account asking, and the provider only accepts the id the ticket named.
 */
export function assetIdFor(kind: UploadKind, userId: string): string {
  const unique = crypto.randomBytes(12).toString('hex');
  return `${UPLOAD_RULES[kind].folder}/${userId}/${unique}`;
}

/** True when this asset belongs to this account, by its path alone. */
export function assetBelongsTo(assetId: string, userId: string, kind: UploadKind): boolean {
  return assetId.startsWith(`${UPLOAD_RULES[kind].folder}/${userId}/`);
}

/**
 * This API's own address, taken from the request being served rather than from
 * configuration, so links are right behind a proxy, on any port, and in tests.
 */
export function baseUrlOf(req: { protocol: string; get(name: string): string | undefined }): string {
  return `${req.protocol}://${req.get('host') ?? 'localhost'}`;
}

let instance: FileStorage | null = null;

export function fileStorage(): FileStorage {
  if (!instance) {
    instance = env.storage.provider === 'cloudinary' ? cloudinaryStorage() : localStorage();
  }
  return instance;
}

/** Only for tests, which switch adapters between cases. */
export function resetFileStorage(): void {
  instance = null;
}

/** Rejects a file the rules do not allow, before any of it is accepted. */
export function assertAllowed(kind: UploadKind, contentType: string, bytes: number): void {
  const rule = UPLOAD_RULES[kind];
  if (!rule.accept.includes(contentType)) {
    throw ApiError.unprocessable(
      `That file type is not accepted here. Allowed: ${rule.accept
        .map((type) => type.replace(/^.*\//, '').toUpperCase())
        .join(', ')}.`,
      'file_type',
    );
  }
  if (bytes > rule.maxBytes) {
    throw ApiError.unprocessable(
      `That file is too large. The limit is ${Math.round(rule.maxBytes / (1024 * 1024))}MB.`,
      'file_too_large',
    );
  }
}
