'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ApiError } from '@/lib/api';
import { uploadFile, type UploadKind } from '@/lib/upload';

/**
 * Choose a photo, position and zoom it inside the frame, then upload only the
 * cropped result. Used for the profile picture (square) and the profile cover
 * (wide). The crop happens in the browser; the original never leaves the
 * device.
 */
export function CropUpload({
  kind = 'AVATAR',
  aspect,
  value,
  onChange,
  label,
  outputWidth,
  round = false,
}: {
  kind?: UploadKind;
  /** width / height of the frame, e.g. 1 for a profile picture, 3 for a cover. */
  aspect: number;
  value: string | null;
  onChange: (url: string | null) => void;
  label: string;
  outputWidth: number;
  round?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const FRAME_W = 300;
  const FRAME_H = Math.round(FRAME_W / aspect);

  function choose(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Choose a photo (JPEG, PNG or WebP).');
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setSource(image);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    image.onerror = () => setError('That photo could not be opened.');
    image.src = url;
  }

  // Scale that makes the image just cover the frame at zoom 1.
  const base = source ? Math.max(FRAME_W / source.naturalWidth, FRAME_H / source.naturalHeight) : 1;
  const scale = base * zoom;
  const drawnW = source ? source.naturalWidth * scale : 0;
  const drawnH = source ? source.naturalHeight * scale : 0;
  const limit = { x: Math.max(0, (drawnW - FRAME_W) / 2), y: Math.max(0, (drawnH - FRAME_H) / 2) };
  const clamp = (next: { x: number; y: number }) => ({ x: Math.max(-limit.x, Math.min(limit.x, next.x)), y: Math.max(-limit.y, Math.min(limit.y, next.y)) });

  useEffect(() => {
    setOffset((current) => clamp(current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  async function save() {
    if (!source) return;
    setBusy(true);
    setError(null);
    try {
      const outW = outputWidth;
      const outH = Math.round(outputWidth / aspect);
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d')!;
      const ratio = outW / FRAME_W;
      const left = (FRAME_W - drawnW) / 2 + offset.x;
      const top = (FRAME_H - drawnH) / 2 + offset.y;
      ctx.drawImage(source, left * ratio, top * ratio, drawnW * ratio, drawnH * ratio);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
      if (!blob) throw new Error('crop');
      const uploaded = await uploadFile(kind, new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
      onChange(uploaded.url);
      setSource(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The photo could not be uploaded. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-ink-soft">{label}</p>
      <div className="flex flex-wrap items-center gap-3">
        <div
          className={`overflow-hidden border border-line bg-sand ${round ? 'rounded-full' : 'rounded-xl'}`}
          style={{ width: round ? 88 : '100%', maxWidth: round ? 88 : 420, aspectRatio: String(aspect) }}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xs text-ink-faint">No photo</span>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => input.current?.click()} className="h-11 rounded-full border border-line bg-white px-4 text-sm font-semibold">{value ? 'Change' : 'Choose photo'}</button>
          {value && <button type="button" onClick={() => onChange(null)} className="h-11 rounded-full px-3 text-sm font-semibold text-ink-muted">Remove</button>}
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { choose(event.target.files?.[0]); event.target.value = ''; }} />
      </div>
      {error && <p className="mt-2 text-sm text-[color:var(--color-danger,#b42318)]">{error}</p>}

      {source &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Crop ${label.toLowerCase()}`}>
            <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl">
              <p className="text-lg font-bold text-ink">Position your photo</p>
              <p className="text-sm text-ink-muted">Drag to move. Use the slider to zoom.</p>
              <div
                className={`relative mx-auto mt-4 touch-none overflow-hidden bg-black ${round ? 'rounded-full' : 'rounded-lg'}`}
                style={{ width: FRAME_W, height: FRAME_H, maxWidth: '100%', cursor: 'grab' }}
                onPointerDown={(event) => {
                  (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
                  drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
                }}
                onPointerMove={(event) => {
                  if (!drag.current) return;
                  setOffset(clamp({ x: drag.current.ox + event.clientX - drag.current.x, y: drag.current.oy + event.clientY - drag.current.y }));
                }}
                onPointerUp={() => (drag.current = null)}
                onPointerCancel={() => (drag.current = null)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={source.src}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute max-w-none select-none"
                  style={{ width: drawnW, height: drawnH, left: (FRAME_W - drawnW) / 2 + offset.x, top: (FRAME_H - drawnH) / 2 + offset.y }}
                />
              </div>
              <label className="mt-4 flex items-center gap-3 text-sm text-ink-soft">
                Zoom
                <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="flex-1" />
              </label>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setSource(null)} className="h-11 rounded-full px-5 text-sm font-semibold text-ink-muted">Cancel</button>
                <button type="button" disabled={busy} onClick={save} className="h-11 rounded-full bg-acacia-600 px-6 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Uploading…' : 'Use photo'}</button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
