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

export type UploadKind = 'TRIP_IMAGE' | 'AVATAR' | 'VERIFICATION_DOCUMENT' | 'MEDIA_IMAGE' | 'MEDIA_VIDEO' | 'RECEIPT' | 'CHAT_FILE' | 'PAYMENT_RECEIPT' | 'CHAT_MEDIA' | 'ESPORTS_DOCUMENT';

export const UPLOAD_KINDS = ['TRIP_IMAGE', 'AVATAR', 'VERIFICATION_DOCUMENT', 'MEDIA_IMAGE', 'MEDIA_VIDEO', 'RECEIPT', 'CHAT_FILE', 'PAYMENT_RECEIPT', 'CHAT_MEDIA', 'ESPORTS_DOCUMENT'] as const;

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
  /** Photos for the media library — trips, places, events, the homepage. */
  MEDIA_IMAGE: {
    maxBytes: 15 * 1024 * 1024,
    accept: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'],
    folder: 'enhakkore/media',
    visibility: 'public',
  },
  /** Videos for the media library. Cloudinary's free plan accepts up to 100MB per video. */
  MEDIA_VIDEO: {
    maxBytes: 100 * 1024 * 1024,
    accept: ['video/mp4', 'video/webm', 'video/quicktime'],
    folder: 'enhakkore/video',
    visibility: 'public',
  },
  /** Photos and documents shared in a trip group, under an unguessable name. */
  CHAT_FILE: {
    maxBytes: 10 * 1024 * 1024,
    accept: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    folder: 'enhakkore/chat',
    visibility: 'public',
  },
  /** A member's own payment receipt for a trip. Private: only the member and the team who verify payments can open it. */
  PAYMENT_RECEIPT: {
    maxBytes: 8 * 1024 * 1024,
    accept: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    folder: 'enhakkore/member-receipts',
    visibility: 'private',
  },
  /** Voice notes, photos, short videos and study files shared in community and study-group chats. */
  CHAT_MEDIA: {
    maxBytes: 25 * 1024 * 1024,
    accept: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'application/pdf'],
    folder: 'enhakkore/chat-media',
    visibility: 'public',
  },
  /** Evidence for an esports organiser application. Private: only the gaming team can open it. */
  ESPORTS_DOCUMENT: {
    maxBytes: 10 * 1024 * 1024,
    accept: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    folder: 'enhakkore/esports-verification',
    visibility: 'private',
  },
  /** Receipts and payment confirmations. Private: only finance staff can open one. */
  RECEIPT: {
    maxBytes: 10 * 1024 * 1024,
    accept: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    folder: 'enhakkore/receipts',
    visibility: 'private',
  },
};

/** Cloudinary keeps images and videos apart; private files use `auto`. */
export function resourceTypeOf(kind: UploadKind): 'image' | 'video' | 'auto' {
  if (UPLOAD_RULES[kind].visibility === 'private') return 'auto';
  if (kind === 'CHAT_MEDIA') return 'auto';
  return kind === 'MEDIA_VIDEO' ? 'video' : 'image';
}

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
