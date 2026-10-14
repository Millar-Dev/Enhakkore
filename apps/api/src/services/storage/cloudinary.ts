import crypto from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../env';
import { ApiError } from '../../lib/http';
import { UPLOAD_RULES, type FileStorage, type UploadClaim, type UploadKind, type UploadTicket } from './index';

/**
 * Cloudinary, used through signed direct uploads.
 *
 * The browser sends the file to Cloudinary itself. Our server only signs what
 * is allowed — which id, which folder, public or private — and afterwards
 * checks Cloudinary's own signature on the result. A browser cannot invent an
 * upload, change where it lands, or claim a file it did not send.
 */

const API_BASE = 'https://api.cloudinary.com/v1_1';

function config() {
  const settings = env.storage.cloudinary;
  if (!settings) throw new Error('Cloudinary is not configured.');
  return settings;
}

/**
 * Cloudinary's signature: every signed parameter, sorted by name, joined as a
 * query string, with the API secret appended, then hashed.
 */
function sign(params: Record<string, string | number>, apiSecret: string): string {
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return crypto.createHash('sha1').update(`${canonical}${apiSecret}`).digest('hex');
}

/**
 * Images and PDFs are different resource types to Cloudinary. `auto` lets it
 * decide, which is what the documents folder needs since it takes both.
 */
function resourceType(kind: UploadKind): 'image' | 'auto' {
  return UPLOAD_RULES[kind].visibility === 'private' ? 'auto' : 'image';
}

export function cloudinaryStorage(): FileStorage {
  const { cloudName, apiKey, apiSecret } = config();
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });

  return {
    name: 'cloudinary',
    isDurable: true,

    ticket(kind: UploadKind, assetId: string, _baseUrl: string): UploadTicket {
      const rule = UPLOAD_RULES[kind];
      const timestamp = Math.floor(Date.now() / 1000);

      // Signed parameters. `type: authenticated` means the stored file has no
      // working public address — only a signed link reaches it.
      const signed: Record<string, string | number> = { public_id: assetId, timestamp };
      if (rule.visibility === 'private') signed.type = 'authenticated';

      return {
        provider: 'cloudinary',
        kind,
        uploadUrl: `${API_BASE}/${cloudName}/${resourceType(kind)}/upload`,
        fields: {
          api_key: apiKey,
          timestamp: String(timestamp),
          public_id: assetId,
          signature: sign(signed, apiSecret),
          ...(rule.visibility === 'private' ? { type: 'authenticated' } : {}),
        },
        assetId,
        maxBytes: rule.maxBytes,
        accept: rule.accept,
      };
    },

    async verify(kind: UploadKind, claim: UploadClaim, _baseUrl?: string) {
      // Cloudinary signs the id and version of what it stored. Recomputing that
      // signature proves the file exists and is the one we asked for — without
      // spending an API call.
      const expected = sign({ public_id: claim.assetId, version: claim.version }, apiSecret);
      const given = Buffer.from(claim.signature ?? '', 'utf8');
      const ours = Buffer.from(expected, 'utf8');
      if (given.length !== ours.length || !crypto.timingSafeEqual(given, ours)) {
        throw ApiError.unprocessable('That upload could not be verified.', 'upload_unverified');
      }

      const rule = UPLOAD_RULES[kind];
      const format = (claim.format ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
      return {
        assetId: claim.assetId,
        url:
          rule.visibility === 'public'
            ? cloudinary.url(claim.assetId, {
                resource_type: 'image',
                version: claim.version,
                secure: true,
                // Delivered no wider than needed and in whatever modern format
                // the viewer's browser accepts, so a phone photo does not
                // arrive as six megabytes.
                transformation: [{ width: 1600, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
              })
            : null,
        format,
        bytes: Math.max(0, Math.round(claim.bytes ?? 0)),
      };
    },

    async privateUrl(assetId: string, format: string, _baseUrl?: string) {
      // A link that stops working after ten minutes. Long enough to open a
      // document, short enough that a copied link is not a lasting key.
      return cloudinary.utils.private_download_url(assetId, format, {
        resource_type: 'image',
        type: 'authenticated',
        expires_at: Math.floor(Date.now() / 1000) + 600,
      });
    },

    async remove(kind: UploadKind, assetId: string) {
      await cloudinary.uploader.destroy(assetId, {
        resource_type: 'image',
        type: UPLOAD_RULES[kind].visibility === 'private' ? 'authenticated' : 'upload',
        invalidate: true,
      });
    },
  };
}
