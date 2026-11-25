'use client';

import { useEffect, useState } from 'react';
import { HOMEPAGE_SECTION_LABELS, SETTINGS_PERMISSION, type SettingsGroup } from '@enhakkore/shared';
import { AdminShell, Panel, btn } from '@/components/admin/AdminShell';
import { MediaPicker } from '@/components/admin/MediaPicker';
import { SmartImage } from '@/components/public/SmartImage';
import { ApiError, api } from '@/lib/api';
import { can } from '@/lib/admin';
import { useSession } from '@/lib/session';
import { useApi, useQueryParam } from '@/lib/useApi';

/* eslint-disable @typescript-eslint/no-explicit-any */

const GROUPS: { key: SettingsGroup; label: string; help: string }[] = [
  { key: 'homepage', label: 'Homepage', help: 'Hero text and image, and which sections appear in which order.' },
  { key: 'contact', label: 'Contacts', help: 'WhatsApp and phone numbers, emails, address and hours — used everywhere on the site.' },
  { key: 'social', label: 'Social media', help: 'Instagram, TikTok and other links in the footer and contact page.' },
  { key: 'whatsapp', label: 'WhatsApp messages', help: 'The message already typed when someone taps a WhatsApp button. {title} becomes the page’s subject.' },
  { key: 'brand', label: 'Brand & logos', help: 'Name, slogan, logos, favicon and optional colours. The original logos are the defaults.' },
  { key: 'seo', label: 'Search engines', help: 'Title, description and keywords for Google and link previews.' },
  { key: 'navigation', label: 'Menu', help: 'The main menu links.' },
  { key: 'legal', label: 'Legal & policies', help: 'Terms, privacy, cancellation and safety pages. Empty pages say they are not yet published.' },
  { key: 'impact', label: 'Impact & donations', help: 'Donation wording, and confirming the donation account is authorised.' },
  { key: 'catering', label: 'Catering', help: 'The catering page introduction.' },
  { key: 'launch', label: 'Launch city', help: 'The city Weekend Radar and the homepage focus on.' },
];

const IMAGE_KEYS = /url$|image/i;
const LONG_KEYS = /description|intro|subtitle|terms|privacy|cancellation|safety|use|general|trip|event|place|experience|activity|catering|chef|donation|listing|hours|address/i;

export default function SettingsPage() {
  const { user } = useSession();
  const requested = useQueryParam('group') as SettingsGroup | null;
  const [group, setGroup] = useState<SettingsGroup>('homepage');
  useEffect(() => { if (requested && GROUPS.some((item) => item.key === requested)) setGroup(requested); }, [requested]);
  const settings = useApi<{ settings: Record<string, any>; defaults: Record<string, any>; sensitive: string[] }>('/cc/settings');
  const history = useApi<any[]>(`/cc/settings/${group}/history`);
  const [draft, setDraft] = useState<any>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (settings.data) setDraft(JSON.parse(JSON.stringify(settings.data.settings[group] ?? settings.data.defaults[group])));
    setMessage(null);
  }, [settings.data, group]);

  const editable = can(user, SETTINGS_PERMISSION[group]);
  const sensitive = settings.data?.sensitive.includes(group);
  const info = GROUPS.find((item) => item.key === group)!;

  const save = async (value = draft) => {
    if (sensitive && !window.confirm(`Change ${info.label.toLowerCase()}? This is shown across the website and is recorded in the audit log.`)) return;
    try {
      await api.put(`/cc/settings/${group}`, { value, confirm: true });
      await Promise.all([settings.reload(), history.reload()]);
      setMessage({ tone: 'ok', text: 'Saved. The website shows the change within a minute.' });
    } catch (caught) {
      setMessage({ tone: 'error', text: caught instanceof ApiError ? Object.values(caught.fields)[0] ?? caught.message : 'Could not save.' });
    }
  };

  return (
    <AdminShell title="Website settings" permission="settings.view">
      <div className="grid gap-5 lg:grid-cols-[14rem_1fr]">
        <nav className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 lg:mx-0 lg:grid lg:content-start lg:gap-1 lg:px-0">
          {GROUPS.filter((item) => settings.data?.settings[item.key] !== undefined).map((item) => (
            <button key={item.key} onClick={() => setGroup(item.key)} className={`chip lg:justify-start lg:rounded-lg ${group === item.key ? 'chip-active' : ''}`}>{item.label}</button>
          ))}
        </nav>
        <div className="grid gap-5 pb-24">
          <Panel title={info.label}>
            <p className="mb-4 text-sm text-ink-muted">{info.help}</p>
            {!draft ? <p className="text-sm text-ink-muted">Loading…</p> : group === 'homepage' ? (
              <HomepageEditor value={draft} onChange={setDraft} />
            ) : (
              <ValueEditor value={draft} onChange={setDraft} defaults={settings.data?.defaults[group]} />
            )}
          </Panel>
          {group === 'impact' && <p className="rounded-xl bg-[#fdf8ec] p-3 text-xs text-warning">Only tick “donation account confirmed” once you have confirmed that the account is authorised to receive donations for the stated project. Until then the Donate page asks donors to confirm the details with you first.</p>}
          <Panel title="Change history">
            {(history.data ?? []).length === 0 ? <p className="text-sm text-ink-muted">No changes yet — the defaults are in use.</p> : (
              <ul className="divide-y divide-line text-sm">
                {history.data!.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div><p className="font-semibold">{entry.summary}</p><p className="text-xs text-ink-muted">{entry.actorName} · {new Date(entry.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p></div>
                    {editable && entry.before && (
                      <button className={btn.secondary} onClick={async () => {
                        if (!window.confirm('Put back the value from before this change?')) return;
                        await api.post(`/cc/settings/${group}/restore/${entry.id}`, { confirm: true });
                        await Promise.all([settings.reload(), history.reload()]);
                        setMessage({ tone: 'ok', text: 'Restored.' });
                      }}>Restore previous value</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
      {editable && draft && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-3 py-3 backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
            <span className={`text-sm font-semibold ${message?.tone === 'error' ? 'text-danger' : 'text-safari-700'}`}>{message?.text}</span>
            <div className="flex gap-2">
              <button className={btn.secondary} onClick={() => { if (window.confirm('Reset this section to the original defaults? You can restore from the history afterwards.')) void save(settings.data!.defaults[group]); }}>Reset to defaults</button>
              <button className={btn.primary} onClick={() => save()}>Save {info.label.toLowerCase()}</button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function humanise(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).replace('Url', 'URL');
}

/** Edits any settings value: text, yes/no, lists of rows. Shaped by the defaults. */
function ValueEditor({ value, onChange, defaults }: { value: any; onChange: (value: any) => void; defaults: any }) {
  if (Array.isArray(value)) {
    const template = (defaults && defaults[0]) || value[0] || {};
    if (typeof template !== 'object') {
      return <textarea className="field min-h-24" value={value.join('\n')} onChange={(event) => onChange(event.target.value.split('\n').filter(Boolean))} placeholder="One per line" />;
    }
    return (
      <div className="grid gap-3">
        {value.map((row: any, index: number) => (
          <div key={index} className="rounded-xl border border-line bg-[#faf8f3] p-3">
            <div className="mb-2 flex justify-between text-xs font-semibold text-ink-muted">
              <span>#{index + 1}</span>
              <span className="flex gap-3">
                <button disabled={index === 0} onClick={() => { const next = [...value]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange(next); }}>↑</button>
                <button className="text-danger" onClick={() => onChange(value.filter((_: any, i: number) => i !== index))}>Remove</button>
              </span>
            </div>
            <ValueEditor value={row} defaults={template} onChange={(next) => onChange(value.map((item: any, i: number) => (i === index ? next : item)))} />
          </div>
        ))}
        <button className="w-fit rounded-full border border-dashed border-acacia-600/40 px-4 py-2 text-sm font-semibold text-acacia-600" onClick={() => onChange([...value, Object.fromEntries(Object.entries(template).map(([key, item]) => [key, typeof item === 'boolean' ? true : typeof item === 'object' ? [] : '']))])}>+ Add</button>
      </div>
    );
  }
  if (value && typeof value === 'object') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Object.keys({ ...(defaults ?? {}), ...value }).map((key) => (
          <SettingField key={key} name={key} value={value[key]} defaults={defaults?.[key]} onChange={(next) => onChange({ ...value, [key]: next })} />
        ))}
      </div>
    );
  }
  return <input className="field" value={value ?? ''} onChange={(event) => onChange(event.target.value)} />;
}

function SettingField({ name, value, defaults, onChange }: { name: string; value: any; defaults: any; onChange: (value: any) => void }) {
  const [picker, setPicker] = useState(false);
  const current = value ?? defaults;
  if (typeof current === 'boolean') {
    return <label className="flex items-center gap-2 rounded-xl border border-line p-3 text-sm font-semibold sm:col-span-2"><input type="checkbox" className="h-5 w-5" checked={!!value} onChange={(event) => onChange(event.target.checked)} /> {humanise(name)}</label>;
  }
  if (Array.isArray(current) || (current && typeof current === 'object')) {
    return <div className="sm:col-span-2"><p className="mb-2 text-[0.8125rem] font-semibold text-ink-soft">{humanise(name)}</p><ValueEditor value={value ?? defaults} defaults={defaults} onChange={onChange} /></div>;
  }
  if (IMAGE_KEYS.test(name) && /logo|image|favicon|mark/i.test(name)) {
    return (
      <div>
        <p className="mb-1.5 text-[0.8125rem] font-semibold text-ink-soft">{humanise(name)}</p>
        <div className="flex items-center gap-3">
          {value && <div className="relative h-16 w-20 overflow-hidden rounded-lg border border-line bg-white"><SmartImage src={value} alt="" fill sizes="80px" className="object-contain" /></div>}
          <button className="chip" onClick={() => setPicker(true)}>Change</button>
          {defaults && value !== defaults && <button className="text-xs underline" onClick={() => onChange(defaults)}>Use original</button>}
        </div>
        {picker && <MediaPicker onClose={() => setPicker(false)} onPick={(urls) => { onChange(urls[0]); setPicker(false); }} />}
      </div>
    );
  }
  const long = LONG_KEYS.test(name) && (String(current ?? '').length > 60 || /terms|privacy|cancellation|safety/.test(name));
  return (
    <label className={`grid gap-1.5 text-[0.8125rem] font-semibold text-ink-soft ${long ? 'sm:col-span-2' : ''}`}>
      {humanise(name)}
      {long ? <textarea className="field min-h-28" value={value ?? ''} onChange={(event) => onChange(event.target.value)} /> : <input className="field" value={value ?? ''} onChange={(event) => onChange(event.target.value)} />}
    </label>
  );
}

function HomepageEditor({ value, onChange }: { value: any; onChange: (value: any) => void }) {
  const [picker, setPicker] = useState(false);
  const hero = value.hero;
  const sections: any[] = value.sections;
  const setHero = (key: string, next: any) => onChange({ ...value, hero: { ...hero, [key]: next } });
  const move = (index: number, delta: number) => {
    const next = [...sections];
    const [row] = next.splice(index, 1);
    next.splice(index + delta, 0, row);
    onChange({ ...value, sections: next });
  };
  return (
    <div className="grid gap-6">
      <div>
        <p className="mb-3 text-sm font-bold text-acacia-700">Hero (top of the homepage)</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {['eyebrow', 'title', 'subtitle', 'primaryLabel', 'primaryHref', 'secondaryLabel', 'secondaryHref'].map((key) => (
            <label key={key} className={`grid gap-1 text-xs font-semibold text-ink-soft ${key === 'subtitle' || key === 'title' ? 'sm:col-span-2' : ''}`}>
              {humanise(key).replace('Href', 'link')}
              {key === 'subtitle' ? <textarea className="field" value={hero[key]} onChange={(event) => setHero(key, event.target.value)} /> : <input className="field" value={hero[key]} onChange={(event) => setHero(key, event.target.value)} />}
            </label>
          ))}
          <div className="sm:col-span-2">
            <p className="mb-1 text-xs font-semibold text-ink-soft">Hero image</p>
            <div className="flex items-center gap-3">
              <div className="relative h-20 w-32 overflow-hidden rounded-lg bg-sand"><SmartImage src={hero.imageUrl} alt="" fill sizes="128px" className="object-cover" /></div>
              <button className="chip" onClick={() => setPicker(true)}>Change image</button>
            </div>
            {picker && <MediaPicker onClose={() => setPicker(false)} onPick={(urls) => { setHero('imageUrl', urls[0]); setPicker(false); }} />}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hero.videoEnabled} onChange={(event) => setHero('videoEnabled', event.target.checked)} /> Play the background video (skipped on slow connections)</label>
        </div>
      </div>
      <div>
        <p className="mb-3 text-sm font-bold text-acacia-700">Sections — order, visibility and headings</p>
        <ul className="grid gap-2">
          {sections.map((section, index) => (
            <li key={section.key} className={`rounded-xl border p-3 ${section.enabled ? 'border-line bg-white' : 'border-dashed border-line bg-[#faf8f3] opacity-70'}`}>
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={section.enabled} onChange={(event) => onChange({ ...value, sections: sections.map((row, i) => (i === index ? { ...row, enabled: event.target.checked } : row)) })} /> {HOMEPAGE_SECTION_LABELS[section.key as keyof typeof HOMEPAGE_SECTION_LABELS] ?? section.key}</label>
                <span className="flex gap-1">
                  <button className="chip !h-8" disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
                  <button className="chip !h-8" disabled={index === sections.length - 1} onClick={() => move(index, 1)}>↓</button>
                </span>
              </div>
              {section.enabled && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input className="field" value={section.title} placeholder="Heading" onChange={(event) => onChange({ ...value, sections: sections.map((row, i) => (i === index ? { ...row, title: event.target.value } : row)) })} />
                  <input className="field" value={section.subtitle} placeholder="Subheading" onChange={(event) => onChange({ ...value, sections: sections.map((row, i) => (i === index ? { ...row, subtitle: event.target.value } : row)) })} />
                </div>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-muted">Sections with nothing published in them hide themselves automatically.</p>
      </div>
    </div>
  );
}
