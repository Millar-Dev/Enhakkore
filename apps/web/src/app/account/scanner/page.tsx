'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SCAN_RESULT_LABELS } from '@enhakkore/shared';
import { DashboardShell, MEMBER_ROLES, TRAVELLER_NAV } from '@/components/layout/DashboardShell';
import { ApiError, api } from '@/lib/api';
import { passDate } from '@/components/public/PassCard';

interface Listing { type: string; id: string; title: string; startsAt: string | null; verification: string }
interface ScannedPass { id: string; reference: string; holderName: string; username: string | null; title: string; startsAt: string | null; status: string; checkedInAt: string | null }
interface Result { result: string; pass: ScannedPass | null; provisional?: boolean; at: string }
interface Bundle { listingType: string; listingId: string; salt: string; issuedAt: string; expiresAt: string; entries: { h: string; ref: string; name: string; status: string }[]; signature: string }
interface Queued { code: string; scannedAt: string }

const TONE: Record<string, string> = {
  VALID: 'bg-[#14653a] text-white',
  ALREADY_CHECKED_IN: 'bg-[#b7791f] text-white',
  REVIEW: 'bg-[#b7791f] text-white',
  CANCELLED: 'bg-[#9b1c1c] text-white',
  EXPIRED: 'bg-[#9b1c1c] text-white',
  NOT_FOUND: 'bg-[#9b1c1c] text-white',
};
const key = (listing: { type: string; id: string }) => `enh.scan.${listing.type}.${listing.id}`;
const store = {
  get<T>(name: string): T | null {
    try {
      const raw = window.localStorage.getItem(name);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set(name: string, value: unknown) {
    try {
      if (value === null) window.localStorage.removeItem(name);
      else window.localStorage.setItem(name, JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
  },
};

async function hash(token: string, salt: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${token}`));
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };

/**
 * Check-in at the entrance, for staff and for approved organisers of their own
 * listings. Scanning needs a browser with built-in QR detection (most Android
 * phones with Chrome); everywhere else, type the pass reference. Offline mode
 * keeps a signed, time-limited list on this device and marks results as
 * provisional until they are synced.
 */
export default function ScannerPage() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [code, setCode] = useState('');
  const [last, setLast] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [camera, setCamera] = useState<'off' | 'on' | 'unsupported' | 'denied'>('off');
  const [offline, setOffline] = useState(false);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [queue, setQueue] = useState<Queued[]>([]);
  const [search, setSearch] = useState('');
  const [found, setFound] = useState<ScannedPass[]>([]);
  const [counts, setCounts] = useState<{ total: number; checkedIn: number } | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const busy = useRef(false);
  const lastCode = useRef<{ code: string; at: number } | null>(null);

  useEffect(() => {
    api.get<{ items: Listing[] }>('/passes/scannable').then((data) => setListings(data.items)).catch(() => setListings([]));
  }, []);

  useEffect(() => {
    if (!listing) return;
    setBundle(store.get<Bundle>(`${key(listing)}.bundle`));
    setQueue(store.get<Queued[]>(`${key(listing)}.queue`) ?? []);
    void refreshCounts(listing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing]);

  async function refreshCounts(target: Listing) {
    try {
      const data = await api.get<{ counts: { total: number; checkedIn: number } }>(`/passes/listing/${target.type}/${target.id}`);
      setCounts(data.counts);
    } catch {
      /* offline */
    }
  }

  const check = useCallback(
    async (raw: string) => {
      if (!listing || !raw.trim() || busy.current) return;
      busy.current = true;
      setError(null);
      const value = raw.trim();
      try {
        if (offline) {
          if (!bundle || new Date(bundle.expiresAt).getTime() < Date.now()) throw new Error('Download a fresh offline list first (lists expire after 12 hours).');
          let entry: Bundle['entries'][number] | undefined;
          if (value.startsWith('ENH1.')) {
            const h = await hash(value.slice(5), bundle.salt);
            entry = bundle.entries.find((item) => item.h === h);
          } else entry = bundle.entries.find((item) => item.ref === value.toUpperCase());
          const queued = queue.some((item) => item.code === value);
          const result = !entry ? 'NOT_FOUND' : entry.status === 'CANCELLED' ? 'CANCELLED' : entry.status === 'EXPIRED' ? 'EXPIRED' : entry.status === 'CHECKED_IN' || queued ? 'ALREADY_CHECKED_IN' : value.startsWith('ENH1.') ? 'VALID' : 'REVIEW';
          if (result === 'VALID') {
            const next = [...queue, { code: value, scannedAt: new Date().toISOString() }];
            setQueue(next);
            store.set(`${key(listing)}.queue`, next);
          }
          setLast({ result, provisional: true, at: new Date().toISOString(), pass: entry ? { id: '', reference: entry.ref, holderName: entry.name, username: null, title: listing.title, startsAt: listing.startsAt, status: entry.status, checkedInAt: null } : null });
        } else {
          const data = await api.post<{ result: string; pass: ScannedPass | null }>('/passes/verify', { listingType: listing.type, listingId: listing.id, code: value });
          setLast({ ...data, at: new Date().toISOString() });
          void refreshCounts(listing);
        }
        if ('vibrate' in navigator) navigator.vibrate?.(80);
      } catch (caught) {
        setError(caught instanceof ApiError || caught instanceof Error ? caught.message : 'Could not check this pass.');
      } finally {
        busy.current = false;
        setCode('');
      }
    },
    [listing, offline, bundle, queue],
  );

  // Camera scanning with the browser's own QR detector, where it exists.
  async function startCamera() {
    const Ctor = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) return setCamera('unsupported');
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (video.current) {
        video.current.srcObject = stream.current;
        await video.current.play();
      }
      setCamera('on');
      const detector = new Ctor({ formats: ['qr_code'] });
      const tick = async () => {
        if (!stream.current || !video.current) return;
        try {
          const codes = await detector.detect(video.current);
          const value = codes[0]?.rawValue;
          const now = Date.now();
          if (value && !(lastCode.current && lastCode.current.code === value && now - lastCode.current.at < 4000)) {
            lastCode.current = { code: value, at: now };
            await check(value);
          }
        } catch {
          /* frame not ready */
        }
        if (stream.current) window.setTimeout(tick, 350);
      };
      void tick();
    } catch {
      setCamera('denied');
    }
  }
  function stopCamera() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setCamera('off');
  }
  useEffect(() => stopCamera, []);

  async function download() {
    if (!listing) return;
    try {
      const data = await api.get<Bundle>(`/passes/listing/${listing.type}/${listing.id}/offline`);
      setBundle(data);
      store.set(`${key(listing)}.bundle`, data);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not download the list.');
    }
  }

  async function sync() {
    if (!listing || queue.length === 0) return;
    try {
      const data = await api.post<{ results: { result: string }[] }>('/passes/offline-sync', { listingType: listing.type, listingId: listing.id, scans: queue });
      const conflicts = data.results.filter((item) => item.result !== 'VALID').length;
      setQueue([]);
      store.set(`${key(listing)}.queue`, []);
      setError(conflicts ? `${data.results.length} offline check-ins synced. ${conflicts} did not hold (already checked in elsewhere, or changed) — see the history.` : `${data.results.length} offline check-ins synced and confirmed.`);
      void refreshCounts(listing);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Still offline — try syncing again when connected.');
    }
  }

  async function lookup() {
    if (!listing || search.trim().length < 2) return setFound([]);
    try {
      const data = await api.get<{ items: ScannedPass[] }>(`/passes/listing/${listing.type}/${listing.id}?q=${encodeURIComponent(search.trim())}`);
      setFound(data.items.slice(0, 20));
    } catch {
      setFound([]);
    }
  }

  async function manual(pass: ScannedPass) {
    try {
      const data = await api.post<{ result: string; pass: ScannedPass }>(`/passes/${pass.id}/check-in`);
      setLast({ ...data, at: new Date().toISOString() });
      void lookup();
      if (listing) void refreshCounts(listing);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not check in.');
    }
  }

  return (
    <DashboardShell nav={TRAVELLER_NAV} allow={MEMBER_ROLES} title="Check-in scanner">
      {!listing ? (
        <section className="max-w-2xl">
          <p className="text-sm text-ink-muted">Choose what you are checking people in for. Only listings you manage, with check-in switched on, appear here.</p>
          {listings === null && <p className="mt-4 text-sm text-ink-muted">Loading…</p>}
          {listings?.length === 0 && <p className="mt-4 rounded-2xl border border-dashed border-line bg-white p-5 text-sm text-ink-soft">Nothing to scan for. When you organise an activity or event with QR or manual check-in — or you are on the team for one — it appears here.</p>}
          <ul className="mt-4 grid gap-2">
            {listings?.map((item) => (
              <li key={`${item.type}-${item.id}`}>
                <button type="button" onClick={() => setListing(item)} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 text-left">
                  <span><span className="block font-semibold text-ink">{item.title}</span><span className="text-xs text-ink-muted">{item.type.toLowerCase()} · {passDate(item.startsAt)}</span></span>
                  <span aria-hidden>›</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="grid max-w-3xl gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <button type="button" onClick={() => { stopCamera(); setListing(null); setLast(null); }} className="text-sm font-semibold text-acacia-700">‹ Change</button>
              <h2 className="text-xl font-bold text-ink">{listing.title}</h2>
              {counts && <p className="text-sm text-ink-muted">{counts.checkedIn} of {counts.total} checked in{queue.length ? ` · ${queue.length} waiting to sync` : ''}</p>}
            </div>
            <label className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold">
              <input type="checkbox" checked={offline} onChange={(event) => setOffline(event.target.checked)} /> Offline mode
            </label>
          </div>

          {offline && (
            <div className="rounded-2xl border border-[#e2c47a] bg-[#fff8e6] p-4 text-sm text-ink-soft">
              <p><strong>Offline results are provisional.</strong> They are confirmed when you sync. The list on this device holds pass references and short names only (no QR codes) and expires after 12 hours.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={download} className="h-11 rounded-full bg-acacia-700 px-4 font-semibold text-white">{bundle ? 'Refresh offline list' : 'Download offline list'}</button>
                <button type="button" onClick={sync} disabled={!queue.length} className="h-11 rounded-full border border-line bg-white px-4 font-semibold disabled:opacity-50">Sync {queue.length || ''}</button>
              </div>
              {bundle && <p className="mt-2 text-xs text-ink-muted">List of {bundle.entries.length} · downloaded {passDate(bundle.issuedAt)} · expires {passDate(bundle.expiresAt)}</p>}
            </div>
          )}

          <div className="overflow-hidden rounded-2xl bg-black">
            <video ref={video} playsInline muted className={`aspect-[4/3] w-full object-cover ${camera === 'on' ? '' : 'hidden'}`} />
            <div className="flex flex-wrap items-center justify-center gap-3 p-4 text-sm text-white/85">
              {camera === 'on' ? (
                <button type="button" onClick={stopCamera} className="h-11 rounded-full bg-white/15 px-5 font-semibold">Stop camera</button>
              ) : (
                <button type="button" onClick={startCamera} className="h-11 rounded-full bg-clay-400 px-5 font-bold text-acacia-700">Scan with camera</button>
              )}
              {camera === 'unsupported' && <p className="w-full text-center">This browser cannot read QR codes from the camera. Type the reference below instead — Chrome on Android supports camera scanning.</p>}
              {camera === 'denied' && <p className="w-full text-center">Camera permission was refused. Allow it in the browser settings, or type the reference below.</p>}
            </div>
          </div>

          <form onSubmit={(event) => { event.preventDefault(); void check(code); }} className="flex flex-col gap-2 sm:flex-row">
            <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Pass reference, e.g. PASS-AB12CD34" className="field w-full sm:flex-1" aria-label="Pass reference" autoCapitalize="characters" />
            <button className="h-12 rounded-full bg-acacia-600 px-6 font-bold text-white">Check</button>
          </form>

          {error && <p role="alert" className="rounded-xl bg-sand p-3 text-sm text-ink-soft">{error}</p>}

          {last && (
            <div className={`rounded-2xl p-5 ${TONE[last.result] ?? 'bg-sand'}`} role="status" aria-live="assertive">
              <p className="text-2xl font-bold">{SCAN_RESULT_LABELS[last.result] ?? last.result}{last.provisional ? ' (provisional)' : ''}</p>
              {last.pass && <p className="mt-1 text-lg">{last.pass.holderName}{last.pass.username ? ` · @${last.pass.username}` : ''} · {last.pass.reference}</p>}
              {last.result === 'ALREADY_CHECKED_IN' && last.pass?.checkedInAt && <p className="mt-1 text-sm opacity-90">First checked in {passDate(last.pass.checkedInAt)}</p>}
              {last.result === 'REVIEW' && !offline && last.pass && (
                <div className="mt-3">
                  <p className="text-sm opacity-90">A typed reference for a QR pass: confirm the person’s identity, then check them in.</p>
                  <button type="button" onClick={() => last.pass && manual(last.pass)} className="mt-2 h-11 rounded-full bg-white px-5 font-bold text-ink">Identity confirmed — check in</button>
                </div>
              )}
            </div>
          )}

          {!offline && (
            <div className="rounded-2xl border border-line bg-white p-4">
              <p className="text-sm font-semibold text-ink">Find someone on the list</p>
              <div className="mt-2 flex gap-2">
                <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void lookup(); } }} placeholder="Name, @username or reference" className="field w-full" aria-label="Search attendees" />
                <button type="button" onClick={lookup} className="h-12 rounded-full border border-line px-4 font-semibold">Search</button>
              </div>
              <ul className="mt-3 divide-y divide-line">
                {found.map((pass) => (
                  <li key={pass.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span><strong>{pass.holderName}</strong>{pass.username ? ` · @${pass.username}` : ''}<span className="block text-xs text-ink-muted">{pass.reference} · {pass.status.replace('_', ' ').toLowerCase()}</span></span>
                    {pass.status === 'VALID' && <button type="button" onClick={() => manual(pass)} className="h-10 rounded-full bg-acacia-700 px-4 text-xs font-bold text-white">Check in</button>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </DashboardShell>
  );
}
