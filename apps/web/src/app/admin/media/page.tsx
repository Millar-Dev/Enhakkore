'use client';

import { useRef, useState } from 'react';
import { AdminShell, Panel, btn } from '@/components/admin/AdminShell';
import { uploadToLibrary, type MediaAsset } from '@/components/admin/MediaPicker';
import { CopyButton } from '@/components/public/Actions';
import { SmartImage } from '@/components/public/SmartImage';
import { ApiError, api } from '@/lib/api';
import { can } from '@/lib/admin';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/useApi';

/** The media library: every photo and video, organised in folders and reusable anywhere. */
export default function MediaPage() {
  const { user } = useSession();
  const [folder, setFolder] = useState('');
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const { data, reload } = useApi<{ items: MediaAsset[]; folders: { name: string; count: number }[] }>(`/cc/media?pageSize=120${folder ? `&folder=${encodeURIComponent(folder)}` : ''}${kind ? `&kind=${kind}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  return (
    <AdminShell
      title="Media library"
      permission="media.view"
      actions={can(user, 'media.create') ? <button className={btn.gold} onClick={() => input.current?.click()}>Upload photos or videos</button> : undefined}
    >
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm,video/quicktime"
        onChange={async (event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          const target = window.prompt('Folder for these files?', folder || 'General') || 'General';
          for (const [index, file] of files.entries()) {
            try {
              await uploadToLibrary(file, target, (fraction) => setProgress(`Uploading ${index + 1} of ${files.length}: ${Math.round(fraction * 100)}%`));
            } catch (caught) {
              setProgress(caught instanceof ApiError ? caught.message : `Could not upload ${file.name}`);
            }
          }
          setProgress(null);
          await reload();
        }}
      />
      {progress && <p className="mb-3 rounded-lg bg-acacia-50 p-3 text-sm text-acacia-700">{progress}</p>}
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_14rem_10rem]">
        <input className="field" placeholder="Search titles and captions" value={q} onChange={(event) => setQ(event.target.value)} />
        <select className="field" value={folder} onChange={(event) => setFolder(event.target.value)}><option value="">All folders</option>{(data?.folders ?? []).map((item) => <option key={item.name} value={item.name}>{item.name} ({item.count})</option>)}</select>
        <select className="field" value={kind} onChange={(event) => setKind(event.target.value)}><option value="">Photos & videos</option><option value="IMAGE">Photos</option><option value="VIDEO">Videos</option></select>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {(data?.items ?? []).map((item) => (
            <button key={item.id} onClick={() => setSelected(item)} className={`relative aspect-square overflow-hidden rounded-lg border-2 ${selected?.id === item.id ? 'border-clay-400' : 'border-transparent'} bg-sand`}>
              {item.kind === 'VIDEO' ? <span className="flex h-full items-center justify-center bg-acacia-700 p-2 text-xs text-white">▶ {item.title}</span> : <SmartImage src={item.url} alt={item.alt ?? ''} fill sizes="140px" className="object-cover" />}
              {item.isSystem && <span className="absolute left-1 top-1 rounded bg-white/90 px-1 text-[0.5625rem] font-bold text-acacia-700">ORIGINAL</span>}
            </button>
          ))}
        </div>
        {selected && (
          <Panel title="Details">
            <form
              key={selected.id}
              className="grid gap-3 text-sm"
              onSubmit={async (event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const updated = await api.patch<MediaAsset>(`/cc/media/${selected.id}`, { title: form.get('title'), alt: form.get('alt'), caption: form.get('caption'), credit: form.get('credit'), folder: form.get('folder') });
                setSelected(updated);
                await reload();
              }}
            >
              {selected.kind === 'IMAGE' ? <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-sand"><SmartImage src={selected.url} alt="" fill sizes="320px" className="object-contain" /></div> : <video src={selected.url} controls className="w-full rounded-lg" />}
              <div className="flex items-center gap-2 text-xs"><span className="truncate text-ink-muted">{selected.url}</span><CopyButton value={selected.url} label="Copy link" /></div>
              <label className="grid gap-1 text-xs font-semibold">Title<input name="title" defaultValue={selected.title ?? ''} className="field" /></label>
              <label className="grid gap-1 text-xs font-semibold">Description (for screen readers)<input name="alt" defaultValue={selected.alt ?? ''} className="field" /></label>
              <label className="grid gap-1 text-xs font-semibold">Caption<input name="caption" defaultValue={selected.caption ?? ''} className="field" /></label>
              <label className="grid gap-1 text-xs font-semibold">Credit<input name="credit" defaultValue={selected.credit ?? ''} className="field" /></label>
              <label className="grid gap-1 text-xs font-semibold">Folder<input name="folder" defaultValue={selected.folder} className="field" /></label>
              {can(user, 'media.edit') && <button className={btn.primary}>Save details</button>}
              {can(user, 'media.delete') && !selected.isSystem && (
                <button type="button" className={btn.danger} onClick={async () => { if (window.confirm('Remove this file from the library? Pages already using it keep working.')) { await api.delete(`/cc/media/${selected.id}?confirm=yes`); setSelected(null); await reload(); } }}>Remove from library</button>
              )}
              {selected.isSystem && <p className="text-xs text-ink-muted">This is one of the website’s original files (logo or authentic photograph). It is protected from deletion.</p>}
            </form>
          </Panel>
        )}
      </div>
    </AdminShell>
  );
}
