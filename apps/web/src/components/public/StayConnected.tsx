'use client';

import { useState } from 'react';
import { ApiError, api } from '@/lib/api';

/**
 * "Stay connected" sign-up. Each address reaches the team as an enquiry marked
 * "Updates sign-up" in the control centre's inbox — there is no separate
 * mailing-list service, so nothing is promised beyond that.
 */
export function StayConnected() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setState(null);
        try {
          await api.post('/community/enquiries', {
            type: 'GENERAL',
            subjectTitle: 'Updates sign-up',
            name: 'Updates sign-up',
            email,
            message: 'Please send me trip updates, new events and impact stories.',
          });
          setState({ tone: 'ok', text: 'Thank you — you are on the list for updates.' });
          setEmail('');
        } catch (caught) {
          setState({ tone: 'error', text: caught instanceof ApiError ? Object.values(caught.fields)[0] ?? caught.message : 'That did not work — please try again.' });
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex h-12 items-center rounded-full bg-white p-1 pl-4">
        <label htmlFor="stay-email" className="sr-only">Email address</label>
        <input id="stay-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter your email" className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none" />
        <button disabled={busy} className="h-10 shrink-0 rounded-full bg-clay-400 px-4 text-sm font-bold text-acacia-700 disabled:opacity-60">{busy ? 'Sending…' : 'Subscribe'}</button>
      </div>
      {state && <p role="status" className={`mt-2 text-xs ${state.tone === 'ok' ? 'text-[#7ee2a8]' : 'text-[#ff9b9b]'}`}>{state.text}</p>}
    </form>
  );
}
