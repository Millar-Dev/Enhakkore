'use client';

import { useMemo } from 'react';
import { COUNTRIES } from '@enhakkore/shared';
import { Field } from '@/components/ui/form';
import { SearchSelect, searchWorldCities } from '@/components/ui/SearchSelect';
import { api } from '@/lib/api';

/**
 * Country first, then a city in that country — for sign-up and the profile.
 * Values are names ("Tanzania", "Dar es Salaam"), which is what an account
 * stores and what discovery pages use as the default location.
 */
export function CountryCity({
  country,
  city,
  onChange,
  errors = {},
  required = false,
}: {
  country: string;
  city: string;
  onChange: (next: { country: string; city: string }) => void;
  errors?: { country?: string; city?: string };
  required?: boolean;
}) {
  const options = useMemo(() => COUNTRIES.map((item) => ({ value: item.name, label: item.name })), []);
  const code = COUNTRIES.find((item) => item.name === country)?.code ?? '';
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Country" required={required} error={errors.country}>
        {() => <SearchSelect ariaLabel="Country" placeholder="Type a country…" value={country} options={options} onChange={(next) => onChange({ country: next, city: '' })} />}
      </Field>
      <Field label="City" required={required} error={errors.city} hint={code ? undefined : 'Choose the country first.'}>
        {() => code ? (
          <SearchSelect
            key={code}
            ariaLabel="City"
            placeholder="Type your city…"
            value={city ? `name:${city}` : ''}
            options={city ? [{ value: `name:${city}`, label: city }] : []}
            remote={(q) => searchWorldCities((path) => api.get(path), code, q)}
            onChange={(_value, option) => onChange({ country, city: option?.label ?? '' })}
          />
        ) : (
          <input disabled className="h-12 w-full rounded-xl border border-line bg-sand px-3 text-sm text-ink-faint" placeholder="Choose the country first" aria-label="City" />
        )}
      </Field>
    </div>
  );
}
