'use client';

import { useState } from 'react';
import { formatMoney } from '@enhakkore/shared';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { CopyButton } from './Actions';

interface Ticket {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  remaining: number | null;
}

interface Result {
  reference: string;
  status: string;
  amountDue: number;
  currency: string;
  paymentInstructions: string | null;
  paymentMethods: { name: string; provider: string | null; accountName: string | null; accountNumber: string | null; instructions: string | null }[];
}

/** Registration for an Enhakkore-hosted event. Places are held; payment is verified by the team. */
export function RegisterForm({ slug, tickets, whatsappHref }: { slug: string; tickets: Ticket[]; whatsappHref: string }) {
  const { user } = useSession();
  const available = tickets.filter((ticket) => ticket.remaining === null || ticket.remaining > 0);
  const [ticketId, setTicketId] = useState(available[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ticket = tickets.find((item) => item.id === ticketId);

  if (available.length === 0) return <p className="rounded-xl bg-sand p-4 text-sm font-semibold text-ink-muted">Sold out.</p>;

  if (result) {
    return (
      <div className="grid gap-3">
        <div className="rounded-xl bg-safari-50 p-4">
          <p className="font-display text-xl text-acacia-700">{result.status === 'CONFIRMED' ? 'You are registered' : 'Your places are held'}</p>
          <p className="mt-1 text-sm text-ink-soft">
            Reference <strong>{result.reference}</strong> — show it at the door.
            {result.status !== 'CONFIRMED' && ` Pay ${formatMoney({ amount: result.amountDue, currency: result.currency })} using the details below, then send your confirmation on WhatsApp. Your registration is confirmed once the payment is verified.`}
          </p>
        </div>
        {result.status !== 'CONFIRMED' && (
          <>
            {result.paymentInstructions && <p className="whitespace-pre-line text-sm text-ink-soft">{result.paymentInstructions}</p>}
            {result.paymentMethods.map((method) => (
              <div key={method.name} className="rounded-xl border border-line p-3 text-sm">
                <p className="font-bold text-acacia-700">{method.name}</p>
                {method.accountName && <p>Name: {method.accountName}</p>}
                {method.accountNumber && (
                  <p className="flex items-center gap-2">
                    Number: <span className="font-mono font-bold">{method.accountNumber}</span> <CopyButton value={method.accountNumber} />
                  </p>
                )}
                {method.instructions && <p className="mt-1 text-ink-muted">{method.instructions}</p>}
              </div>
            ))}
            {!result.paymentInstructions && result.paymentMethods.length === 0 && (
              <p className="text-sm text-ink-soft">Message us on WhatsApp for payment details.</p>
            )}
            <a href={`${whatsappHref}${encodeURIComponent(` My reference is ${result.reference}.`)}`} target="_blank" rel="noreferrer noopener" className="inline-flex h-11 items-center justify-center rounded-full bg-[#1f9d55] text-sm font-bold text-white">
              Send payment confirmation on WhatsApp
            </a>
          </>
        )}
      </div>
    );
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setBusy(true);
        setError(null);
        try {
          setResult(
            await api.post<Result>(`/community/events/${slug}/register`, {
              ticketId,
              quantity,
              name: String(form.get('name')),
              phone: String(form.get('phone')),
              email: String(form.get('email') ?? ''),
              website: String(form.get('website') ?? ''),
            }),
          );
        } catch (caught) {
          setError(caught instanceof ApiError ? Object.values(caught.fields)[0] ?? caught.message : 'Could not register. Try again, or message us on WhatsApp.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-2">
        {available.map((item) => (
          <label key={item.id} className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3 ${ticketId === item.id ? 'border-acacia-600 bg-acacia-50' : 'border-line'}`}>
            <span className="flex gap-3">
              <input type="radio" name="ticket" checked={ticketId === item.id} onChange={() => setTicketId(item.id)} className="mt-1" />
              <span>
                <span className="block font-semibold text-ink">{item.name}</span>
                {item.description && <span className="block text-xs text-ink-muted">{item.description}</span>}
                {item.remaining !== null && item.remaining <= 10 && <span className="block text-xs font-semibold text-clay-600">{item.remaining} left</span>}
              </span>
            </span>
            <span className="font-bold text-acacia-600">{item.price === 0 ? 'Free' : formatMoney({ amount: item.price, currency: item.currency })}</span>
          </label>
        ))}
      </div>
      <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">
        Tickets
        <input type="number" min={1} max={Math.min(20, ticket?.remaining ?? 20)} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} className="field" />
      </label>
      <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">Full name<input name="name" required defaultValue={user?.name} className="field" /></label>
      <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">Phone / WhatsApp<input name="phone" type="tel" required defaultValue={user?.phone ?? ''} className="field" /></label>
      <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">Email (optional)<input name="email" type="email" defaultValue={user?.email} className="field" /></label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {ticket && ticket.price > 0 && <p className="text-sm font-semibold text-acacia-700">Total: {formatMoney({ amount: ticket.price * quantity, currency: ticket.currency })}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      <button disabled={busy || !ticketId} className="h-12 rounded-full bg-clay-400 font-bold text-acacia-700 hover:bg-clay-500 hover:text-white disabled:opacity-50">{busy ? 'Holding your places…' : 'Register'}</button>
      <p className="text-xs text-ink-muted">No payment is taken on this site. Your places are held and confirmed once the team verifies your payment.</p>
    </form>
  );
}
