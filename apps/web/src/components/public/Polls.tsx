'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

interface Poll {
  id: string;
  question: string;
  description: string | null;
  options: string[];
  tally: number[];
  totalVotes: number;
  myVote: number | null;
  closed: boolean;
}

/** Community polls. One vote per member, enforced by the database; results show after voting. */
export function Polls({ initial }: { initial: Poll[] }) {
  const { status } = useSession();
  const [polls, setPolls] = useState(initial);
  const refresh = () => api.get<Poll[]>('/public/polls').then(setPolls).catch(() => undefined);
  useEffect(() => {
    if (status === 'authenticated') void refresh();
  }, [status]);
  if (polls.length === 0) return <p className="text-sm text-ink-muted">No polls are open right now.</p>;
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {polls.map((poll) => {
        const showResults = poll.closed || poll.myVote !== null;
        return (
          <div key={poll.id} className="rounded-[1.1rem] border border-line bg-white p-5">
            <p className="font-display text-xl text-acacia-700">{poll.question}</p>
            {poll.description && <p className="mt-1 text-sm text-ink-muted">{poll.description}</p>}
            <div className="mt-4 grid gap-2">
              {poll.options.map((option, index) => {
                const share = poll.totalVotes ? Math.round((poll.tally[index]! / poll.totalVotes) * 100) : 0;
                return showResults ? (
                  <div key={option} className="relative overflow-hidden rounded-lg border border-line px-3 py-2 text-sm">
                    <div className="absolute inset-y-0 left-0 bg-clay-100" style={{ width: `${share}%` }} />
                    <span className="relative flex justify-between font-medium"><span>{option}{poll.myVote === index ? ' ✓' : ''}</span><span>{share}%</span></span>
                  </div>
                ) : status === 'authenticated' ? (
                  <button key={option} onClick={async () => { await api.post(`/community/polls/${poll.id}/vote`, { optionIndex: index }); void refresh(); }} className="rounded-lg border border-line px-3 py-2 text-left text-sm font-medium hover:border-acacia-600">{option}</button>
                ) : (
                  <span key={option} className="rounded-lg border border-line px-3 py-2 text-sm text-ink-muted">{option}</span>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              {poll.totalVotes} vote{poll.totalVotes === 1 ? '' : 's'}
              {poll.closed ? ' · closed' : ''}
              {status !== 'authenticated' && !poll.closed && <> · <Link href="/signin?next=/community" className="underline">Sign in to vote</Link></>}
            </p>
          </div>
        );
      })}
    </div>
  );
}
