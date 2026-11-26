'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export interface SearchOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * A searchable picker: type to narrow a long list (all countries, thousands of
 * cities) instead of scrolling through hundreds of options. `remote` adds
 * results fetched as you type — e.g. the worldwide city list.
 */
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = 'Search…',
  remote,
  emptyLabel,
  ariaLabel,
}: {
  options: SearchOption[];
  value: string;
  onChange: (value: string, option?: SearchOption) => void;
  placeholder?: string;
  remote?: (query: string) => Promise<SearchOption[]>;
  emptyLabel?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [found, setFound] = useState<SearchOption[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? found.find((option) => option.value === value);

  const local = useMemo(() => {
    const q = text.trim().toLowerCase();
    const list = q ? options.filter((option) => option.label.toLowerCase().includes(q)) : options;
    return list.slice(0, 50);
  }, [options, text]);

  useEffect(() => {
    if (!remote || text.trim().length < 2) return setFound([]);
    const timer = setTimeout(() => {
      remote(text.trim()).then(setFound).catch(() => setFound([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [remote, text]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pick = (option: SearchOption) => {
    onChange(option.value, option);
    setText('');
    setOpen(false);
  };
  const localValues = new Set(local.map((option) => option.label.toLowerCase()));
  const extra = found.filter((option) => !localValues.has(option.label.toLowerCase()));

  return (
    <div ref={box} className="relative">
      <input
        className="field"
        value={open ? text : selected?.label ?? ''}
        placeholder={selected?.label ?? placeholder}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
        }}
        aria-label={ariaLabel ?? placeholder}
        role="combobox"
        aria-expanded={open}
        autoComplete="off"
      />
      {open && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-line bg-white py-1 shadow-xl" role="listbox">
          {emptyLabel && (
            <li>
              <button type="button" className="w-full px-3 py-2 text-left text-sm text-ink-muted hover:bg-sand" onClick={() => pick({ value: '', label: '' })}>{emptyLabel}</button>
            </li>
          )}
          {local.map((option) => (
            <li key={`l-${option.value}`}>
              <button type="button" className="flex w-full justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-sand" onClick={() => pick(option)}>
                <span>{option.label}</span>
                {option.hint && <span className="text-xs text-ink-muted">{option.hint}</span>}
              </button>
            </li>
          ))}
          {extra.map((option) => (
            <li key={`r-${option.value}`}>
              <button type="button" className="flex w-full justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-sand" onClick={() => pick(option)}>
                <span>🌍 {option.label}</span>
                {option.hint && <span className="text-xs text-ink-muted">{option.hint}</span>}
              </button>
            </li>
          ))}
          {local.length === 0 && extra.length === 0 && <li className="px-3 py-2 text-sm text-ink-muted">{text.trim().length < 2 && remote ? 'Type to search' : 'No match'}</li>}
        </ul>
      )}
      {remote && <p className="mt-1 text-[0.6875rem] text-ink-faint">City data © GeoNames (CC BY 4.0)</p>}
    </div>
  );
}

/** Worldwide city search for a country (ISO code), for SearchSelect's `remote`. */
export async function searchWorldCities(apiGet: (path: string) => Promise<{ items: { geonameId: number; name: string; population: number }[] }>, countryCode: string, q: string): Promise<SearchOption[]> {
  const data = await apiGet(`/public/geo/cities?country=${countryCode}&q=${encodeURIComponent(q)}`);
  return data.items.map((item) => ({ value: `geo:${item.geonameId}`, label: item.name, hint: item.population >= 1000 ? `${Math.round(item.population / 1000).toLocaleString()}k people` : undefined }));
}
