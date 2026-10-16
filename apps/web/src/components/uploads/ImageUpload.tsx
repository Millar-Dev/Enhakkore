'use client';

import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import { formatBytes, uploadFile, type UploadKind } from '@/lib/upload';
import { cx } from '@/components/ui';
import { Field } from '@/components/ui/form';

/* ==========================================================================
   Photo upload
   --------------------------------------------------------------------------
   Choose or drag in photos, see them appear, remove one. The file goes
   straight to the image service; this component only ever holds the address
   that comes back, so a slow upload never blocks the rest of the form.
   ========================================================================== */

interface ImageUploadProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Addresses of the photos chosen so far. */
  value: string[];
  onChange: (urls: string[]) => void;
  /** How many photos may be held at once. */
  max?: number;
  kind?: UploadKind;
  className?: string;
}

interface Pending {
  name: string;
  progress: number;
}

export function ImageUpload({
  label,
  hint,
  error,
  required,
  value,
  onChange,
  max = 1,
  kind = 'TRIP_IMAGE',
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const room = Math.max(0, max - value.length - pending.length);

  const accept = async (files: FileList | File[]) => {
    setFailure(null);
    const chosen = Array.from(files).slice(0, room);
    if (!chosen.length) return;

    // Each upload tracks its own progress, so one slow photo does not hide the
    // others. Addresses are appended in the order the uploads finish.
    for (const file of chosen) {
      const entry: Pending = { name: file.name, progress: 0 };
      setPending((current) => [...current, entry]);
      try {
        const uploaded = await uploadFile(kind, file, (fraction) => {
          setPending((current) =>
            current.map((item) => (item === entry ? { ...item, progress: fraction } : item)),
          );
        });
        if (uploaded.url) onChange([...value, uploaded.url].slice(0, max));
      } catch (problem) {
        setFailure(
          problem instanceof ApiError
            ? problem.message
            : `${file.name} (${formatBytes(file.size)}) could not be uploaded.`,
        );
      } finally {
        setPending((current) => current.filter((item) => item !== entry));
      }
    }
  };

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      if (event.dataTransfer.files?.length) void accept(event.dataTransfer.files);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value, max, room],
  );

  return (
    <Field label={label} hint={hint} error={error ?? failure ?? undefined} required={required} className={className}>
      {({ id, describedBy }) => (
        <div className="flex flex-col gap-3">
          {(value.length > 0 || pending.length > 0) && (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {value.map((url, index) => (
                <li
                  key={url}
                  className="group relative aspect-[4/3] overflow-hidden rounded-[var(--radius-field)] border border-line bg-sand"
                >
                  <Image
                    src={url}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 33vw, 160px"
                    className="object-cover"
                    unoptimized
                  />
                  {index === 0 && max > 1 && (
                    <span className="absolute left-1 top-1 rounded-full bg-ink/75 px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-white">
                      Main
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((item) => item !== url))}
                    className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-ink/75 text-white opacity-0 transition-opacity duration-150 hover:bg-danger focus:opacity-100 focus:outline-none group-hover:opacity-100"
                    aria-label="Remove this photo"
                  >
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                    </svg>
                  </button>
                </li>
              ))}

              {pending.map((item, index) => (
                <li
                  key={`${item.name}-${index}`}
                  className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-[var(--radius-field)] border border-dashed border-line-strong bg-sand px-2"
                >
                  <div className="h-1 w-full overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-acacia-600 transition-[width] duration-200"
                      style={{ width: `${Math.max(6, Math.round(item.progress * 100))}%` }}
                    />
                  </div>
                  <span className="w-full truncate text-center text-[0.6875rem] text-ink-muted">{item.name}</span>
                </li>
              ))}
            </ul>
          )}

          {room > 0 && (
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cx(
                'rounded-[var(--radius-field)] border border-dashed px-4 py-6 text-center transition-colors duration-150',
                dragging ? 'border-acacia-600 bg-acacia-600/5' : 'border-line-strong bg-white',
              )}
            >
              <input
                ref={inputRef}
                id={id}
                aria-describedby={describedBy}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                multiple={max > 1}
                className="sr-only"
                onChange={(event) => {
                  if (event.target.files) void accept(event.target.files);
                  event.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="text-[0.9375rem] font-semibold text-acacia-700 underline-offset-4 hover:underline focus:outline-none focus:ring-4 focus:ring-acacia-600/10"
              >
                Choose {max > 1 ? 'photos' : 'a photo'}
              </button>
              <p className="mt-1 text-[0.8125rem] text-ink-muted">
                or drag {max > 1 ? 'them' : 'it'} here — JPG, PNG or WebP, up to 8MB each
                {max > 1 && `, ${room} more`}
              </p>
            </div>
          )}
        </div>
      )}
    </Field>
  );
}
