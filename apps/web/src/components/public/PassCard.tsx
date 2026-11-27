'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { PASS_STATUS_LABELS } from '@enhakkore/shared';

export interface PassView {
  id: string;
  reference: string;
  title: string;
  holderName: string;
  startsAt: string | null;
  location: string | null;
  listingType: string;
  status: string;
  checkedInAt: string | null;
  qrValue: string | null;
  verification: 'QR' | 'MANUAL';
}

const KIND: Record<string, string> = { EVENT: 'Event', ACTIVITY: 'Activity', TRIP: 'Trip', PLACE: 'Reservation' };
const TONE: Record<string, string> = {
  VALID: 'bg-[#e7f6ec] text-[#14653a]',
  CHECKED_IN: 'bg-[#e8eefc] text-[#1d3f8f]',
  CANCELLED: 'bg-[#fdecec] text-[#9b1c1c]',
  EXPIRED: 'bg-sand text-ink-muted',
};

export const passDate = (value: string | null) =>
  value ? new Date(value).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Date to be confirmed';

/**
 * An Enhakkore Pass. The QR code holds only a random token — no name, phone,
 * email or identity details — and it is shown only while the pass is valid.
 */
export function PassCard({ pass, large = false }: { pass: PassView; large?: boolean }) {
  const [qr, setQr] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!pass.qrValue) return setQr(null);
    QRCode.toDataURL(pass.qrValue, { errorCorrectionLevel: 'M', margin: 1, width: 480, color: { dark: '#06152a', light: '#ffffff' } }).then(setQr).catch(() => setQr(null));
  }, [pass.qrValue]);

  async function download() {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext('2d')!;
    el.width = 720;
    el.height = 1040;
    ctx.fillStyle = '#06152a';
    ctx.fillRect(0, 0, 720, 1040);
    ctx.fillStyle = '#d8a634';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText('Enhakkore Pass', 48, 80);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px system-ui, sans-serif';
    wrap(ctx, pass.title, 48, 150, 624, 48);
    ctx.font = '28px system-ui, sans-serif';
    ctx.fillText(pass.holderName, 48, 270);
    ctx.fillText(passDate(pass.startsAt), 48, 312);
    if (pass.location) ctx.fillText(pass.location.slice(0, 44), 48, 354);
    if (qr) {
      const image = new Image();
      image.src = qr;
      await new Promise((resolve) => (image.onload = resolve));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(160, 400, 400, 400);
      ctx.drawImage(image, 170, 410, 380, 380);
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px ui-monospace, monospace';
    ctx.fillText(pass.reference, 48, 880);
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillStyle = '#c9d3e3';
    ctx.fillText('Show this at the entrance. Valid only while it shows as valid in your account.', 48, 940);
    const link = document.createElement('a');
    link.download = `${pass.reference}.png`;
    link.href = el.toDataURL('image/png');
    link.click();
  }

  return (
    <article className={`overflow-hidden rounded-2xl border border-line bg-white ${large ? '' : 'h-full'}`}>
      <div className="bg-[#06152a] px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-clay-400">Enhakkore Pass · {KIND[pass.listingType] ?? pass.listingType}</span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${TONE[pass.status] ?? 'bg-sand text-ink'}`}>{PASS_STATUS_LABELS[pass.status as keyof typeof PASS_STATUS_LABELS] ?? pass.status}</span>
        </div>
        <h2 className="mt-2 text-lg font-bold leading-snug [overflow-wrap:anywhere]">{pass.title}</h2>
        <p className="mt-1 text-sm text-white/75">{passDate(pass.startsAt)}</p>
        {pass.location && <p className="text-sm text-white/75">{pass.location}</p>}
      </div>
      <div className="grid gap-3 p-5">
        <p className="text-sm text-ink-soft"><span className="text-ink-muted">Holder</span> · <strong>{pass.holderName}</strong></p>
        {large && pass.status === 'VALID' && pass.qrValue && (
          <div className="mx-auto w-full max-w-[280px] rounded-xl border border-line bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr ? <img src={qr} alt={`QR code for pass ${pass.reference}`} className="aspect-square w-full" /> : <div className="aspect-square w-full animate-pulse bg-sand" />}
          </div>
        )}
        {large && pass.status === 'VALID' && !pass.qrValue && <p className="rounded-xl bg-sand p-3 text-sm text-ink-soft">Entry is checked by name and reference. Give the organiser your reference below.</p>}
        <p className="text-center font-mono text-xl font-bold tracking-wider text-ink">{pass.reference}</p>
        {pass.status === 'CHECKED_IN' && pass.checkedInAt && <p className="text-center text-sm text-ink-muted">Checked in {passDate(pass.checkedInAt)}</p>}
        {pass.status === 'CANCELLED' && <p className="text-center text-sm text-ink-muted">This pass no longer works. If your booking changed, a new pass appears here once it is confirmed.</p>}
        {large && pass.status === 'VALID' && (
          <button type="button" onClick={download} className="mx-auto h-11 rounded-full border border-line px-5 text-sm font-semibold">Save pass image</button>
        )}
        <canvas ref={canvas} className="hidden" aria-hidden />
      </div>
    </article>
  );
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, line: number) {
  const words = text.split(' ');
  let row = '';
  let lines = 0;
  for (const word of words) {
    const test = row ? `${row} ${word}` : word;
    if (ctx.measureText(test).width > width && row) {
      ctx.fillText(row, x, y + lines * line);
      row = word;
      lines += 1;
      if (lines >= 2) break;
    } else row = test;
  }
  if (lines < 2) ctx.fillText(row, x, y + lines * line);
}
