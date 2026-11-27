import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicShell } from '@/components/layout/PublicShell';
import { apiGet } from '@/lib/api';

interface Card {
  name: string;
  username: string | null;
  avatarUrl: string | null;
  coverImage: string | null;
  country: string | null;
  city: string | null;
  headline: string | null;
  bio: string | null;
  interests: string[];
  memberSince: string;
}

export const metadata: Metadata = { title: 'Member profile', robots: { index: false } };

/**
 * A member's public card. It shows only what the member chose to show to
 * everyone. No phone number or email is ever part of it; signed-in members see
 * more on the member's full profile.
 */
export default async function PublicCard({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const card = await apiGet<Card>(`/public/u/${encodeURIComponent(username)}`, 60);
  if (!card) notFound();
  const place = [card.city, card.country].filter(Boolean).join(', ');
  return (
    <PublicShell>
      <section className="shell max-w-2xl py-8">
        <article className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="aspect-[3/1] bg-gradient-to-br from-[#0b2547] to-[#06152a]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {card.coverImage && <img src={card.coverImage} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="px-5 pb-6">
            <div className="-mt-12 h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-sand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {card.avatarUrl ? <img src={card.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-3xl font-bold text-acacia-700">{(card.username ?? card.name).replace('@', '')[0]?.toUpperCase()}</span>}
            </div>
            <h1 className="mt-3 text-2xl font-bold text-ink">@{card.username}</h1>
            {card.headline && <p className="mt-1 text-ink-soft">{card.headline}</p>}
            {place && <p className="mt-1 text-sm text-ink-muted">{place}</p>}
            {card.bio && <p className="mt-4 whitespace-pre-line text-[0.9375rem] leading-relaxed text-ink-soft">{card.bio}</p>}
            {card.interests.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {card.interests.map((tag) => <li key={tag} className="chip">{tag}</li>)}
              </ul>
            )}
            <p className="mt-5 text-xs text-ink-faint">Member since {new Date(card.memberSince).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
            <p className="mt-4 text-sm text-ink-muted"><Link href="/signin" className="font-semibold text-acacia-700 underline">Sign in</Link> to connect or invite them to an experience.</p>
          </div>
        </article>
      </section>
    </PublicShell>
  );
}
