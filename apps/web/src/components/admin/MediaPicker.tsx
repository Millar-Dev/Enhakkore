'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SmartImage } from '@/components/public/SmartImage';
import { ApiError, api } from '@/lib/api';
import { formatBytes, uploadFile } from '@/lib/upload';
import { btn } from './AdminShell';

export interface MediaAsset {
  id: string;
  url: string;
  kind: 'IMAGE' | 'VIDEO';
  title: string | null;
  alt: string | null;
  caption: string | null;
  credit: string | null;
  folder: string;
  isSystem: boolean;
  bytes: number | null;
  createdAt: string;
}

/** Uploads one file to the library and returns its record. Works from a phone's camera roll. */
export async function uploadToLibrary(file: File, folder: string, onProgress?: (fraction: number) => void): Promise<MediaAsset> {
  const isVideo = file.type.startsWith('video/');
  const uploaded = await uploadFile(isVideo ? 'MEDIA_VIDEO' : 'MEDIA_IMAGE', file, onProgress);
  if (!uploaded.url) throw new ApiError(0, 'The upload finished without an address.');
  return api.post<MediaAsset>('/cc/media', {
    url: uploaded.url,
    kind: isVideo ? 'VIDEO' : 'IMAGE',
    title: file.name.replace(/\.[^.]+$/, ''),
    folder,
    assetId: uploaded.assetId,
    bytes: uploaded.bytes,
    format: uploaded.format,
  });
}

/**
 * Choose from the media library, upload new files, or paste a link.
 * Existing photographs (the Mkuranga outreach, the Arusha route, the logos)
 * are already in the library, so they can be reused anywhere.
 */
export function MediaPicker({
  kind = 'IMAGE',
  multiple = false,
  onPick,
  onClose,
}: {
  kind?: 'IMAGE' | 'VIDEO';
  multiple?: boolean;
  onPick: (urls: string[]) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [folders, setFolders] = useState<{ name: string; count: number }[]>([]);
  const [folder, setFolder] = useState('');
  const [q, setQ] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    const search = new URLSearchParams({ kind, pageSize: '120', ...(folder ? { folder } : {}), ...(q ? { q } : {}) });
    api.get<{ items: MediaAsset[]; folders: { name: string; count: number }[] }>(`/cc/media?${search}`).then((result) => {
      setItems(result.items);
      setFolders(result.folders);
    }).catch((caught) => setError(caught instanceof ApiError ? caught.message : 'Could not load the library.'));
  }, [kind, folder, q]);
  useEffect(() => load(), [load]);

  const toggle = (url: string) => {
    if (!multiple) return onPick([url]);
    setChosen((list) => (list.includes(url) ? list.filter((item) => item !== url) : [...list, url]));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal>
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-line p-4">
          <p className="font-bold text-acacia-700">{kind === 'VIDEO' ? 'Choose a video' : multiple ? 'Choose photos' : 'Choose a photo'}</p>
          <button onClick={onClose} className="text-sm font-semibold text-ink-muted">Close</button>
        </div>
        <div className="grid gap-2 border-b border-line p-4 sm:grid-cols-[1fr_auto_auto]">
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search the library" className="field" />
          <select value={folder} onChange={(event) => setFolder(event.target.value)} className="field">
            <option value="">All folders</option>
            {folders.map((item) => <option key={item.name} value={item.name}>{item.name} ({item.count})</option>)}
          </select>
          <button type="button" className={btn.gold} onClick={() => input.current?.click()}>Upload {kind === 'VIDEO' ? 'video' : 'photos'}</button>
          <input
            ref={input}
            type="file"
            hidden
            multiple={kind === 'IMAGE'}
            accept={kind === 'VIDEO' ? 'video/mp4,video/webm,video/quicktime' : 'image/jpeg,image/png,image/webp,image/avif,image/gif'}
            onChange={async (event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = '';
              setError(null);
              for (const [index, file] of files.entries()) {
                try {
                  setProgress(`Uploading ${index + 1} of ${files.length} (${formatBytes(file.size)})…`);
                  const asset = await uploadToLibrary(file, folder || 'General', (fraction) => setProgress(`Uploading ${index + 1} of ${files.length}: ${Math.round(fraction * 100)}%`));
                  setItems((list) => [asset, ...list]);
                  if (multiple) setChosen((list) => [...list, asset.url]);
                } catch (caught) {
                  setError(caught instanceof ApiError ? caught.message : `Could not upload ${file.name}.`);
                }
              }
              setProgress(null);
            }}
          />
        </div>
        {progress && <p className="bg-acacia-50 px-4 py-2 text-sm text-acacia-700">{progress}</p>}
        {error && <p className="bg-danger-soft px-4 py-2 text-sm text-danger">{error}</p>}
        <div className="grid flex-1 grid-cols-3 gap-2 overflow-y-auto p-4 sm:grid-cols-4 md:grid-cols-6">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.url)}
              className={`relative aspect-square overflow-hidden rounded-lg border-2 ${chosen.includes(item.url) ? 'border-clay-400' : 'border-transparent'}`}
              title={item.title ?? item.url}
            >
              {item.kind === 'VIDEO' ? (
                <span className="flex h-full items-center justify-center bg-acacia-700 p-2 text-center text-xs text-white">▶ {item.title}</span>
              ) : (
                <SmartImage src={item.url} alt={item.alt ?? ''} fill sizes="120px" className="object-cover" />
              )}
              {chosen.includes(item.url) && <span className="absolute right-1 top-1 rounded-full bg-clay-400 px-1.5 text-xs font-bold text-acacia-700">{chosen.indexOf(item.url) + 1}</span>}
            </button>
          ))}
          {items.length === 0 && <p className="col-span-full py-10 text-center text-sm text-ink-muted">Nothing here yet — upload above.</p>}
        </div>
        <div className="flex flex-col gap-2 border-t border-line p-4 sm:flex-row sm:items-center">
          <input value={link} onChange={(event) => setLink(event.target.value)} placeholder="…or paste a link (https://…)" className="field" />
          <button type="button" className={btn.secondary} disabled={!/^https?:\/\//.test(link)} onClick={() => onPick([link])}>Use link</button>
          {multiple && <button type="button" className={btn.primary} disabled={!chosen.length} onClick={() => onPick(chosen)}>Add {chosen.length || ''} selected</button>}
        </div>
      </div>
    </div>
  );
}
