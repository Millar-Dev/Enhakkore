'use client';

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';
import { cx } from './index';

/* ==========================================================================
   Form controls
   --------------------------------------------------------------------------
   Every field is labelled, every error is tied to its input with aria, and
   controls are 48px tall so they are comfortable on a phone.
   ========================================================================== */

const CONTROL =
  'w-full h-12 rounded-[--radius-field] border border-line-strong bg-white px-3.5 text-[0.9375rem] text-ink ' +
  'placeholder:text-ink-faint transition-colors duration-150 ' +
  'hover:border-ink-faint focus:border-acacia-600 focus:outline-none focus:ring-4 focus:ring-acacia-600/10 ' +
  'disabled:bg-sand disabled:text-ink-muted';

const CONTROL_ERROR = 'border-danger/50 focus:border-danger focus:ring-danger/10';

interface FieldShellProps {
  label?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  className?: string;
}

export function Field({ label, hint, error, required, children, className }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-[0.8125rem] font-semibold text-ink">
          {label}
          {required && <span className="ml-0.5 text-clay-500">*</span>}
        </label>
      )}
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} className="text-[0.8125rem] font-medium text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-[0.8125rem] leading-snug text-ink-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function Input({
  label,
  hint,
  error,
  className,
  containerClassName,
  ...props
}: {
  label?: string;
  hint?: ReactNode;
  error?: string;
  containerClassName?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} hint={hint} error={error} required={props.required} className={containerClassName}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cx(CONTROL, invalid && CONTROL_ERROR, className)}
          {...props}
        />
      )}
    </Field>
  );
}

export function Textarea({
  label,
  hint,
  error,
  className,
  containerClassName,
  ...props
}: {
  label?: string;
  hint?: ReactNode;
  error?: string;
  containerClassName?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} hint={hint} error={error} required={props.required} className={containerClassName}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cx(CONTROL, 'h-auto min-h-28 py-3 leading-relaxed', invalid && CONTROL_ERROR, className)}
          {...props}
        />
      )}
    </Field>
  );
}

export function Select({
  label,
  hint,
  error,
  className,
  containerClassName,
  children,
  ...props
}: {
  label?: string;
  hint?: ReactNode;
  error?: string;
  containerClassName?: string;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} hint={hint} error={error} required={props.required} className={containerClassName}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <select
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={cx(CONTROL, 'appearance-none pr-10', invalid && CONTROL_ERROR, className)}
            {...props}
          >
            {children}
          </select>
          <svg
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      )}
    </Field>
  );
}

/**
 * A pill-shaped choice group. Used for filters and for the contribution tiers —
 * anywhere the options are few enough to show all at once.
 */
export function ChoiceGroup<T extends string | number>({
  options,
  value,
  onChange,
  label,
  className,
  tone = 'ink',
}: {
  options: { value: T; label: ReactNode; sublabel?: string }[];
  value: T | null;
  onChange: (value: T) => void;
  label?: string;
  className?: string;
  tone?: 'ink' | 'impact';
}) {
  const active =
    tone === 'impact'
      ? 'border-clay-500 bg-clay-500 text-white'
      : 'border-ink bg-ink text-white';

  return (
    <div className={className}>
      {label && <p className="mb-2 text-[0.8125rem] font-semibold text-ink">{label}</p>}
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
              className={cx(
                'min-h-11 rounded-[--radius-field] border px-4 text-[0.875rem] font-semibold transition-all duration-150',
                selected ? active : 'border-line-strong bg-white text-ink-soft hover:border-ink hover:text-ink',
              )}
            >
              <span className="block leading-tight">{option.label}</span>
              {option.sublabel && (
                <span className={cx('block text-[0.6875rem] font-medium', selected ? 'text-white/70' : 'text-ink-faint')}>
                  {option.sublabel}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Checkbox({
  label,
  description,
  className,
  ...props
}: { label: ReactNode; description?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={cx('flex gap-3', className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded-[5px] border-line-strong accent-acacia-700"
        {...props}
      />
      <label htmlFor={id} className="cursor-pointer text-[0.875rem] leading-relaxed text-ink-soft">
        <span className="font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[0.8125rem] text-ink-muted">{description}</span>}
      </label>
    </div>
  );
}
