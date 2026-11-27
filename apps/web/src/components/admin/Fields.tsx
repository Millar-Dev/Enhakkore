'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { currencyDef, type FieldDef } from '@enhakkore/shared';
import { RESOURCES } from '@enhakkore/shared';
import { SmartImage } from '@/components/public/SmartImage';
import { cx } from '@/components/ui';
import { api } from '@/lib/api';
import { MediaPicker } from './MediaPicker';
import { SearchSelect, searchWorldCities } from '@/components/ui/SearchSelect';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Country { id: string; name: string; code: string; timezone: string; status: string; featured: boolean }
interface City { id: string; name: string; countryId: string; timezone: string | null }
interface Category { id: string; name: string; kind: string; group: string | null; icon: string | null; status: string }

interface Lookups {
  countries: Country[];
  categories: Category[];
  cities: (countryId: string) => City[] | undefined;
  loadCities: (countryId: string, force?: boolean) => Promise<void>;
}

const LookupContext = createContext<Lookups | null>(null);

/** Loads the pickers' options once per form. */
export function LookupProvider({ children }: { children: React.ReactNode }) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cityMap, setCityMap] = useState<Record<string, City[]>>({});
  useEffect(() => {
    api.get<Country[]>('/cc/lookup/countries').then(setCountries).catch(() => undefined);
    api.get<Category[]>('/cc/lookup/categories').then(setCategories).catch(() => undefined);
  }, []);
  const value = useMemo<Lookups>(
    () => ({
      countries,
      categories,
      cities: (countryId) => cityMap[countryId],
      loadCities: async (countryId, force) => {
        if (!countryId || (cityMap[countryId] && !force)) return;
        const rows = await api.get<City[]>(`/cc/lookup/cities?countryId=${countryId}`);
        setCityMap((map) => ({ ...map, [countryId]: rows }));
      },
    }),
    [countries, categories, cityMap],
  );
  return <LookupContext.Provider value={value}>{children}</LookupContext.Provider>;
}

const useLookups = () => useContext(LookupContext)!;

const COMMON_ZONES = [
  'Africa/Dar_es_Salaam', 'Africa/Nairobi', 'Africa/Kampala', 'Africa/Kigali', 'Africa/Lagos', 'Africa/Accra', 'Africa/Johannesburg', 'Africa/Cairo',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Kuala_Lumpur', 'Asia/Singapore', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney', 'UTC',
];

export interface FieldProps {
  field: FieldDef;
  value: any;
  onChange: (value: any) => void;
  /** The row this field belongs to (for currency, country, time zone). */
  siblings: Record<string, any>;
  parent?: Record<string, any>;
  errors: Record<string, string>;
  path: string;
}

const label = 'grid gap-1.5 text-[0.8125rem] font-semibold text-ink-soft';

export function Field(props: FieldProps) {
  const { field, errors, path } = props;
  const error = errors[path];
  const inline = field.type === 'boolean';
  return (
    <div className={cx(field.wide || ['repeater', 'gallery', 'textarea', 'list'].includes(field.type) ? 'sm:col-span-2' : '', 'min-w-0')}>
      {inline ? (
        <FieldInput {...props} />
      ) : (
        <label className={label}>
          <span>
            {field.label}
            {field.required && <span className="text-danger"> *</span>}
          </span>
          <FieldInput {...props} />
        </label>
      )}
      {field.help && <p className="mt-1 text-xs leading-relaxed text-ink-muted">{field.help}</p>}
      {error && <p className="mt-1 text-xs font-semibold text-danger">{error}</p>}
    </div>
  );
}

function FieldInput({ field, value, onChange, siblings, parent, errors, path }: FieldProps) {
  const lookups = useLookups();
  const [picker, setPicker] = useState(false);
  const disabled = field.readOnly && !!siblings.id;

  switch (field.type) {
    case 'textarea':
      return <textarea className="field min-h-28" value={value ?? ''} maxLength={field.max} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />;
    case 'number':
    case 'integer':
      return <input className="field" type="number" inputMode={field.type === 'integer' ? 'numeric' : 'decimal'} step={field.type === 'integer' ? 1 : 'any'} min={field.min} max={field.max} value={value ?? ''} disabled={disabled} onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))} />;
    case 'money': {
      const key = field.currencyField ?? 'currency';
      const currency = (key.startsWith('../') ? parent?.[key.slice(3)] : siblings[key]) || 'TZS';
      const def = currencyDef(currency);
      return (
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-sand px-3 py-2.5 text-sm font-bold text-ink-muted">{currency}</span>
          <input className="field" type="number" inputMode="decimal" min={0} step={def.decimals ? 0.01 : 1} value={value ?? ''} placeholder={field.placeholder ?? '0'} onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))} />
        </div>
      );
    }
    case 'boolean':
      return (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-white p-3">
          <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[#082b45]" checked={!!value} onChange={(event) => onChange(event.target.checked)} />
          <span className="text-sm font-semibold text-ink">{field.label}</span>
        </label>
      );
    case 'select':
    case 'currency':
      return (
        <select className="field" value={value ?? ''} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
          {!field.required && <option value="">—</option>}
          {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      );
    case 'multiselect': {
      const list: string[] = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-2">
          {(field.options ?? []).map((option) => (
            <button type="button" key={option.value} onClick={() => onChange(list.includes(option.value) ? list.filter((item) => item !== option.value) : [...list, option.value])} className={cx('chip', list.includes(option.value) && 'chip-active')}>
              {option.label}
            </button>
          ))}
        </div>
      );
    }
    case 'tags':
      return <TagInput value={Array.isArray(value) ? value : []} onChange={onChange} placeholder={field.placeholder} />;
    case 'list':
      return (
        <textarea
          className="field min-h-28"
          value={(Array.isArray(value) ? value : []).join('\n')}
          placeholder="One per line"
          onChange={(event) => onChange(event.target.value.split('\n'))}
        />
      );
    case 'date':
      return <input className="field" type="date" value={value ? String(value).slice(0, 10) : ''} onChange={(event) => onChange(event.target.value)} />;
    case 'datetime': {
      const zone = (field.timezoneField && siblings[field.timezoneField]) || 'the city’s time zone';
      return (
        <div>
          <input className="field" type="datetime-local" value={value ? String(value).slice(0, 16) : ''} onChange={(event) => onChange(event.target.value)} />
          <p className="mt-1 text-[0.6875rem] font-normal text-ink-muted">Local time in {zone}</p>
        </div>
      );
    }
    case 'timezone':
      return (
        <>
          <input className="field" list="tz-list" value={value ?? ''} placeholder="From the city" onChange={(event) => onChange(event.target.value)} />
          <datalist id="tz-list">{COMMON_ZONES.map((zone) => <option key={zone} value={zone} />)}</datalist>
        </>
      );
    case 'country':
      return (
        <SearchSelect
          ariaLabel="Country"
          placeholder="Type a country…"
          value={value ?? ''}
          options={[...lookups.countries.filter((country) => country.featured), ...lookups.countries.filter((country) => !country.featured)].map((country) => ({ value: country.id, label: country.name, hint: country.featured ? '★' : country.code }))}
          onChange={(next) => {
            onChange(next);
            if (next) void lookups.loadCities(next);
          }}
        />
      );
    case 'city':
      return <CityInput value={value} onChange={onChange} countryId={siblings.countryId} />;
    case 'category': {
      const options = lookups.categories.filter((category) => !field.categoryKind || category.kind === field.categoryKind);
      const groups = Array.from(new Set(options.map((category) => category.group ?? 'Other')));
      return (
        <select className="field" value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
          <option value="">Choose a category</option>
          {groups.map((group) => (
            <optgroup key={group} label={group}>
              {options.filter((category) => (category.group ?? 'Other') === group).map((category) => <option key={category.id} value={category.id}>{category.icon ? `${category.icon} ` : ''}{category.name}{category.status !== 'PUBLISHED' ? ' (hidden)' : ''}</option>)}
            </optgroup>
          ))}
        </select>
      );
    }
    case 'image':
    case 'video':
      return (
        <div className="flex flex-wrap items-center gap-3">
          {value ? (
            field.type === 'image' ? (
              <div className="relative h-24 w-32 overflow-hidden rounded-lg border border-line bg-sand"><SmartImage src={value} alt="" fill sizes="128px" className="object-cover" /></div>
            ) : (
              <a href={value} target="_blank" rel="noreferrer" className="max-w-xs truncate text-sm text-acacia-600 underline">{value}</a>
            )
          ) : (
            <span className="text-sm text-ink-muted">None chosen</span>
          )}
          <button type="button" className="chip" onClick={() => setPicker(true)}>{value ? 'Change' : 'Choose or upload'}</button>
          {value && <button type="button" className="text-xs font-semibold text-ink-muted underline" onClick={() => onChange('')}>Remove</button>}
          {picker && <MediaPicker kind={field.type === 'video' ? 'VIDEO' : 'IMAGE'} onClose={() => setPicker(false)} onPick={(urls) => { onChange(urls[0] ?? ''); setPicker(false); }} />}
        </div>
      );
    case 'gallery': {
      const list: string[] = Array.isArray(value) ? value : [];
      const move = (index: number, delta: number) => {
        const next = [...list];
        const [item] = next.splice(index, 1);
        next.splice(Math.max(0, Math.min(next.length, index + delta)), 0, item!);
        onChange(next);
      };
      return (
        <div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {list.map((url, index) => (
              <div key={`${url}-${index}`} className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-sand">
                <SmartImage src={url} alt="" fill sizes="120px" className="object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/55 p-1 text-xs text-white">
                  <button type="button" onClick={() => move(index, -1)} aria-label="Move earlier">◀</button>
                  <button type="button" onClick={() => onChange(list.filter((_, i) => i !== index))} aria-label="Remove">✕</button>
                  <button type="button" onClick={() => move(index, 1)} aria-label="Move later">▶</button>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setPicker(true)} className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-line-strong text-sm font-semibold text-acacia-600">+ Add</button>
          </div>
          {picker && <MediaPicker multiple onClose={() => setPicker(false)} onPick={(urls) => { onChange([...list, ...urls]); setPicker(false); }} />}
        </div>
      );
    }
    case 'url':
      return <input className="field" type="url" inputMode="url" value={value ?? ''} placeholder={field.placeholder ?? 'https://'} onChange={(event) => onChange(event.target.value)} />;
    case 'phone':
      return <input className="field" type="tel" inputMode="tel" value={value ?? ''} placeholder={field.placeholder ?? '+255 …'} onChange={(event) => onChange(event.target.value)} />;
    case 'email':
      return <input className="field" type="email" inputMode="email" value={value ?? ''} onChange={(event) => onChange(event.target.value)} />;
    case 'user':
      return <UserPicker value={value} onChange={onChange} />;
    case 'place':
      return <PlacePicker value={value} onChange={onChange} />;
    case 'ref':
      return <RefPicker resource={field.ref ?? ''} value={value} onChange={onChange} />;
    case 'repeater':
      return <Repeater field={field} value={Array.isArray(value) ? value : []} onChange={onChange} parent={siblings} errors={errors} path={path} />;
    default:
      return <input className="field" value={value ?? ''} maxLength={field.max} placeholder={field.placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value)} />;
  }
}

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (value: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const tag = draft.trim();
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft('');
  };
  return (
    <div className="rounded-[var(--radius-field)] border border-line-strong bg-white p-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-acacia-50 px-2.5 py-1 text-xs font-semibold text-acacia-700">
            {tag}
            <button type="button" onClick={() => onChange(value.filter((item) => item !== tag))} aria-label={`Remove ${tag}`}>✕</button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder={placeholder ?? 'Type and press Enter'}
          className="min-h-10 min-w-32 flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none"
        />
      </div>
    </div>
  );
}

function CityInput({ value, onChange, countryId }: { value: string; onChange: (value: string) => void; countryId?: string }) {
  const lookups = useLookups();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (countryId) void lookups.loadCities(countryId);
  }, [countryId, lookups]);
  if (!countryId) return <p className="rounded-lg bg-sand px-3 py-2.5 text-sm text-ink-muted">Choose the country first</p>;
  const cities = lookups.cities(countryId) ?? [];
  const code = lookups.countries.find((country) => country.id === countryId)?.code;
  return (
    <div className="grid gap-2">
      <SearchSelect
        ariaLabel="City"
        placeholder="Type a city — any city in the country"
        value={value ?? ''}
        emptyLabel="No particular city"
        options={cities.map((city) => ({ value: city.id, label: city.name }))}
        remote={code ? (q) => searchWorldCities((path) => api.get(path), code, q) : undefined}
        onChange={async (next) => {
          if (!next.startsWith('geo:')) return onChange(next);
          try {
            const city = await api.post<City>('/community/geo/city', { country: code, geonameId: Number(next.slice(4)) });
            await lookups.loadCities(countryId, true);
            onChange(city.id);
          } catch {
            setError('Could not add that city.');
          }
        }}
      />
      <button type="button" className="w-fit text-xs font-semibold text-acacia-600 underline" onClick={() => setAdding(true)}>City not in the list? Add it by name</button>
      {adding && (
        <div className="flex gap-2">
          <input className="field" value={name} onChange={(event) => setName(event.target.value)} placeholder="City name, e.g. Lagos" autoFocus />
          <button
            type="button"
            className={cx('h-11 shrink-0 rounded-[var(--radius-field)] bg-acacia-600 px-4 text-sm font-bold text-white')}
            onClick={async () => {
              setError(null);
              try {
                const city = await api.post<City>('/cc/lookup/cities', { countryId, name });
                await lookups.loadCities(countryId, true);
                onChange(city.id);
                setAdding(false);
                setName('');
              } catch {
                setError('Could not add the city. Your role may not allow adding cities.');
              }
            }}
          >
            Add
          </button>
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function UserPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ id: string; name: string; email: string }[]>([]);
  const [current, setCurrent] = useState<{ id: string; name: string; email: string } | null>(null);
  useEffect(() => {
    if (value && current?.id !== value) api.get<typeof results>(`/cc/lookup/users?ids=${value}`).then((rows) => setCurrent(rows[0] ?? null)).catch(() => undefined);
  }, [value, current?.id]);
  useEffect(() => {
    if (q.trim().length < 2) return setResults([]);
    const timer = setTimeout(() => api.get<typeof results>(`/cc/lookup/users?q=${encodeURIComponent(q)}`).then(setResults).catch(() => setResults([])), 250);
    return () => clearTimeout(timer);
  }, [q]);
  return (
    <div className="grid gap-2">
      {value && current ? (
        <div className="flex items-center justify-between rounded-lg bg-sand px-3 py-2 text-sm">
          <span><strong>{current.name}</strong> · {current.email}</span>
          <button type="button" className="text-xs font-semibold text-ink-muted underline" onClick={() => onChange('')}>Remove</button>
        </div>
      ) : null}
      <input className="field" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search by name or email" />
      {results.length > 0 && (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {results.map((user) => (
            <li key={user.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-sand" onClick={() => { onChange(user.id); setCurrent(user); setQ(''); setResults([]); }}>{user.name} · <span className="text-ink-muted">{user.email}</span></button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlacePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [places, setPlaces] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    api.get<typeof places>('/cc/lookup/places').then(setPlaces).catch(() => undefined);
  }, []);
  return (
    <select className="field" value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
      <option value="">Not linked to a place</option>
      {places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
    </select>
  );
}

/** Any other resource's rows, by title — e.g. the community an activity belongs to. */
function RefPicker({ resource, value, onChange }: { resource: string; value: string; onChange: (value: string) => void }) {
  const [rows, setRows] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    const def = RESOURCES.find((item) => item.key === resource);
    if (!def) return;
    api
      .get<{ items: Record<string, any>[] }>(`/cc/r/${resource}?pageSize=100`)
      .then((data) => setRows(data.items.map((row) => ({ id: String(row.id), label: String(row[def.titleField] ?? row.id) }))))
      .catch(() => undefined);
  }, [resource]);
  return (
    <select className="field" value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
      <option value="">None</option>
      {rows.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
    </select>
  );
}

/** Rows of sub-fields — departures, ticket types, itinerary days, menu items… */
function Repeater({ field, value, onChange, parent, errors, path }: { field: FieldDef; value: any[]; onChange: (value: any[]) => void; parent: Record<string, any>; errors: Record<string, string>; path: string }) {
  const fields = (field.fields ?? []).filter((sub) => sub.name !== 'id');
  const blank = () => Object.fromEntries((field.fields ?? []).filter((sub) => sub.default !== undefined).map((sub) => [sub.name, sub.default]));
  const update = (index: number, key: string, next: any) => onChange(value.map((row, i) => (i === index ? { ...row, [key]: next } : row)));
  const move = (index: number, delta: number) => {
    const next = [...value];
    const [row] = next.splice(index, 1);
    next.splice(Math.max(0, Math.min(next.length, index + delta)), 0, row);
    onChange(next);
  };
  return (
    <div className="grid gap-3">
      {value.map((row, index) => (
        <div key={row.id ?? index} className="rounded-xl border border-line bg-[#faf8f3] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-clay-600">{field.label.replace(/s$/, '')} {index + 1}</span>
            <span className="flex gap-3 text-xs font-semibold text-ink-muted">
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0}>↑</button>
              <button type="button" onClick={() => move(index, 1)} disabled={index === value.length - 1}>↓</button>
              <button type="button" className="text-danger" onClick={() => { if (window.confirm('Remove this row?')) onChange(value.filter((_, i) => i !== index)); }}>Remove</button>
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((sub) => (
              <Field key={sub.name} field={sub} value={row[sub.name]} onChange={(next) => update(index, sub.name, next)} siblings={row} parent={parent} errors={errors} path={`${path}.${index}.${sub.name}`} />
            ))}
          </div>
        </div>
      ))}
      <button type="button" className="w-fit rounded-full border border-dashed border-acacia-600/40 px-4 py-2 text-sm font-semibold text-acacia-600" onClick={() => onChange([...value, blank()])}>
        + Add {field.label.toLowerCase().replace(/s$/, '')}
      </button>
    </div>
  );
}
