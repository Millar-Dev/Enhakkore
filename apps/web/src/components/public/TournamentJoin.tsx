'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';

interface Viewer {
  reference: string | null;
  status?: string;
  isCaptain?: boolean;
  teamName?: string | null;
  inviteCode?: string | null;
  members?: { playerName: string }[];
}

/** Register solo, create a team (captain), join a team with its code, or withdraw. Free. */
export function TournamentJoin({ slug, format, teamSize, open, minAge }: { slug: string; format: string; teamSize: number; open: boolean; minAge: number | null }) {
  const { status } = useSession();
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [mode, setMode] = useState<'register' | 'join'>('register');
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const team = format !== 'SOLO' && teamSize > 1;

  const load = useCallback(() => {
    api.get<{ viewer: Viewer | null }>(`/public/tournaments/${slug}`).then((data) => setViewer(data.viewer)).catch(() => undefined);
  }, [slug]);
  useEffect(() => {
    if (status === 'authenticated') load();
  }, [status, load]);

  if (status !== 'authenticated') {
    return (
      <div className="rounded-[1.1rem] border border-line bg-[color:var(--color-cream)] p-5 text-center">
        <p className="font-semibold text-acacia-700">Sign in to register — it’s free</p>
        <div className="mt-3 flex justify-center gap-2">
          <Link href={`/join?next=/experiences/gaming/${slug}`} className="inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Join Enhakkore</Link>
          <Link href={`/signin?next=/experiences/gaming/${slug}`} className="inline-flex h-11 items-center rounded-full border border-line-strong bg-white px-5 text-sm font-semibold">Sign in</Link>
        </div>
      </div>
    );
  }

  if (viewer?.reference) {
    return (
      <div className="rounded-[1.1rem] border border-safari-100 bg-safari-50 p-5">
        <p className="font-display text-xl text-acacia-700">You are registered</p>
        <p className="mt-1 text-sm text-ink-soft">Reference <strong>{viewer.reference}</strong> · {viewer.status?.toLowerCase()}</p>
        {viewer.teamName && <p className="mt-1 text-sm text-ink-soft">Team <strong>{viewer.teamName}</strong>{viewer.members?.length ? ` · ${viewer.members.map((member) => member.playerName).join(', ')}` : ''}</p>}
        {viewer.inviteCode && (
          <p className="mt-3 rounded-lg bg-white p-3 text-sm">
            Team code: <strong className="font-mono text-lg tracking-widest">{viewer.inviteCode}</strong>
            <span className="block text-xs text-ink-muted">Send this to your squad. They open this page, choose “Join a team” and enter it.</span>
          </p>
        )}
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm('Withdraw from this tournament?')) return;
            await api.post(`/community/tournaments/${slug}/withdraw`, {});
            load();
          }}
          className="mt-3 text-xs font-semibold text-ink-muted underline"
        >
          Withdraw
        </button>
      </div>
    );
  }

  if (!open) return <p className="rounded-[1.1rem] bg-sand p-5 text-sm text-ink-muted">Registration is closed.</p>;

  const submit = async (form: FormData) => {
    setBusy(true);
    setError(null);
    setFields({});
    const get = (name: string) => String(form.get(name) ?? '').trim();
    try {
      if (mode === 'join') {
        await api.post(`/community/tournaments/${slug}/join-team`, { inviteCode: get('inviteCode'), playerName: get('playerName'), gameUid: get('gameUid'), agreedRules: form.get('agreedRules') === 'on' });
      } else {
        await api.post(`/community/tournaments/${slug}/register`, { playerName: get('playerName'), gameUid: get('gameUid'), server: get('server'), teamName: get('teamName'), agreedRules: form.get('agreedRules') === 'on' });
      }
      load();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFields(caught.fields);
      } else setError('Could not register. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(new FormData(event.currentTarget));
      }}
    >
      <p className="font-display text-xl text-acacia-700">Register — free</p>
      {team && (
        <div className="flex gap-2">
          <button type="button" onClick={() => setMode('register')} className={`chip ${mode === 'register' ? 'chip-active' : ''}`}>Register a team (captain)</button>
          <button type="button" onClick={() => setMode('join')} className={`chip ${mode === 'join' ? 'chip-active' : ''}`}>Join a team</button>
        </div>
      )}
      {mode === 'join' && <Field name="inviteCode" label="Team code from your captain" error={fields.inviteCode} />}
      {mode === 'register' && team && <Field name="teamName" label="Team name" error={fields.teamName} />}
      <Field name="playerName" label="In-game name" error={fields.playerName} />
      <Field name="gameUid" label="Game UID / player ID" error={fields.gameUid} />
      {mode === 'register' && <Field name="server" label="Server (optional)" required={false} />}
      <label className="flex items-start gap-2 text-sm text-ink-soft">
        <input type="checkbox" name="agreedRules" className="mt-1" required />
        <span>
          I agree to the tournament rules and the <Link href="/legal/gaming" className="underline">gaming rules and disputes</Link> policy{minAge ? `, and I am at least ${minAge}` : ''}.
        </span>
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button disabled={busy} className="h-12 rounded-full bg-acacia-600 font-bold text-white disabled:opacity-50">{busy ? 'Sending…' : mode === 'join' ? 'Join the team' : 'Register'}</button>
      <p className="text-xs text-ink-muted">Entry is free. Your game ID is shared only with the organisers, never on the public line-up.</p>
    </form>
  );
}

function Field({ name, label, error, required = true }: { name: string; label: string; error?: string; required?: boolean }) {
  return (
    <label className="grid gap-1 text-[0.8125rem] font-semibold text-ink-soft">
      {label}
      <input name={name} className="field" required={required} maxLength={60} />
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}
