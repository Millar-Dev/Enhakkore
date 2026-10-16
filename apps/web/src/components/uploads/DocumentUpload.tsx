'use client';

import { useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import { formatBytes, uploadFile, type UploadedFile } from '@/lib/upload';
import { cx } from '@/components/ui';

/* ==========================================================================
   Verification documents
   --------------------------------------------------------------------------
   One row per document the operator can provide. Attaching a file uploads it
   privately: it has no public address, and only this operator and an
   administrator reviewing the submission can ever open it again.
   ========================================================================== */

export interface AttachedDocument extends UploadedFile {
  label: string;
}

interface DocumentUploadProps {
  types: { label: string; required: boolean }[];
  value: AttachedDocument[];
  onChange: (documents: AttachedDocument[]) => void;
  disabled?: boolean;
}

export function DocumentUpload({ types, value, onChange, disabled }: DocumentUploadProps) {
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function attach(label: string, file: File) {
    setFailure(null);
    setBusyLabel(label);
    setProgress(0);
    try {
      const uploaded = await uploadFile('VERIFICATION_DOCUMENT', file, setProgress);
      onChange([...value.filter((item) => item.label !== label), { ...uploaded, label }]);
    } catch (problem) {
      setFailure(
        problem instanceof ApiError
          ? problem.message
          : `${file.name} (${formatBytes(file.size)}) could not be uploaded.`,
      );
    } finally {
      setBusyLabel(null);
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      {failure && (
        <p role="alert" className="text-[0.8125rem] font-medium text-danger">
          {failure}
        </p>
      )}

      <ul className="space-y-2.5">
        {types.map((type) => {
          const attached = value.find((item) => item.label === type.label);
          const busy = busyLabel === type.label;

          return (
            <li
              key={type.label}
              className={cx(
                'rounded-[var(--radius-field)] border px-4 py-3 transition-colors',
                attached ? 'border-acacia-600 bg-acacia-50' : 'border-line-strong',
              )}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="flex-1 text-[0.875rem] font-medium">{type.label}</span>

                {type.required && !attached && (
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-clay-600">
                    Required
                  </span>
                )}

                {attached ? (
                  <>
                    <span className="max-w-[12rem] truncate text-[0.8125rem] text-ink-muted">
                      {attached.fileName} · {formatBytes(attached.bytes)}
                    </span>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange(value.filter((item) => item.label !== type.label))}
                      className="text-[0.8125rem] font-semibold text-ink-muted underline-offset-4 hover:text-danger hover:underline"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={disabled || busy}
                    onClick={() => inputs.current[type.label]?.click()}
                    className="text-[0.8125rem] font-semibold text-acacia-700 underline-offset-4 hover:underline disabled:text-ink-faint"
                  >
                    {busy ? `Uploading ${Math.round(progress * 100)}%` : 'Attach file'}
                  </button>
                )}
              </div>

              {busy && (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-acacia-600 transition-[width] duration-200"
                    style={{ width: `${Math.max(6, Math.round(progress * 100))}%` }}
                  />
                </div>
              )}

              <input
                ref={(element) => {
                  inputs.current[type.label] = element;
                }}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void attach(type.label, file);
                  event.target.value = '';
                }}
              />
            </li>
          );
        })}
      </ul>

      <p className="text-[0.8125rem] leading-snug text-ink-muted">
        PDF, JPG or PNG, up to 10MB each. These files are private: they are not published anywhere on the
        site, and only you and the administrator reviewing your application can open them.
      </p>
    </div>
  );
}
