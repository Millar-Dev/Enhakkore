import { API_URL, ApiError, api } from './api';

/**
 * Uploading a file, in three steps.
 *
 * 1. Ask the API for permission. It replies with where to send the file and
 *    under what name — the browser chooses neither.
 * 2. Send the file straight to that address. With Cloudinary configured the
 *    file goes there directly and never passes through our own server, which
 *    on the free hosting tier would be slow and memory-hungry.
 * 3. Report back. The API checks the provider's signature and returns the
 *    address to use. Nothing a page writes down came from the browser's word.
 */

export type UploadKind = 'TRIP_IMAGE' | 'AVATAR' | 'VERIFICATION_DOCUMENT';

export interface UploadedFile {
  assetId: string;
  version: string;
  signature: string;
  format: string;
  bytes: number;
  /** Public address, or null for a private file such as a document. */
  url: string | null;
  fileName: string;
}

interface Ticket {
  provider: 'cloudinary' | 'local';
  uploadUrl: string;
  fields: Record<string, string>;
  assetId: string;
  maxBytes: number;
  accept: string[];
}

/** Human-readable size, for messages like "that file is 12.4MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** Sends the file, reporting progress from 0 to 1. */
function send(ticket: Ticket, file: File, onProgress?: (fraction: number) => void) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const form = new FormData();
    for (const [name, value] of Object.entries(ticket.fields)) form.append(name, value);
    form.append('file', file);

    // XMLHttpRequest rather than fetch: it is still the only way to show
    // progress, which matters when someone is sending a photo over mobile data.
    const request = new XMLHttpRequest();
    request.open('POST', ticket.uploadUrl);
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    });
    request.addEventListener('load', () => {
      try {
        const body = JSON.parse(request.responseText) as Record<string, unknown>;
        if (request.status >= 200 && request.status < 300) resolve(body);
        else {
          const error = body.error as { message?: string } | undefined;
          reject(new ApiError(request.status, error?.message ?? 'That upload was refused.', 'upload_failed'));
        }
      } catch {
        reject(new ApiError(request.status || 0, 'That upload did not complete.', 'upload_failed'));
      }
    });
    request.addEventListener('error', () =>
      reject(new ApiError(0, 'The upload could not reach the server. Check your connection.', 'network')),
    );
    request.addEventListener('abort', () => reject(new ApiError(0, 'Upload cancelled.', 'cancelled')));
    request.send(form);
  });
}

export async function uploadFile(
  kind: UploadKind,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<UploadedFile> {
  const ticket = await api.post<Ticket>('/uploads/ticket', {
    kind,
    contentType: file.type,
    bytes: file.size,
  });

  const result = await send(ticket, file, onProgress);
  const claim = {
    kind,
    assetId: String(result.public_id ?? ticket.assetId),
    version: String(result.version ?? ''),
    signature: String(result.signature ?? ''),
    format: typeof result.format === 'string' ? result.format : undefined,
    bytes: typeof result.bytes === 'number' ? result.bytes : file.size,
  };

  const stored = await api.post<{ assetId: string; url: string | null; format: string; bytes: number }>(
    '/uploads/confirm',
    claim,
  );

  return {
    assetId: stored.assetId,
    version: claim.version,
    signature: claim.signature,
    format: stored.format,
    bytes: stored.bytes,
    url: stored.url,
    fileName: file.name,
  };
}

/** Where the API lives, for the rare case a caller needs to show it. */
export const UPLOAD_API_URL = API_URL;
