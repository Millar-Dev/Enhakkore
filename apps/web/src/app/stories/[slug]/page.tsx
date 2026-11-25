import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicShell } from '@/components/layout/PublicShell';
import { Gallery, Prose } from '@/components/public/Cards';
import { SmartImage } from '@/components/public/SmartImage';
import { apiGet } from '@/lib/api';
import { placeLabel, type Listing } from '@/lib/public';

export const revalidate = 120;
const load = (slug: string) => apiGet<Listing>(`/public/stories/${slug}`, 120);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const story = await load((await params).slug);
  return story ? { title: String(story.title), description: (story.excerpt as string) ?? undefined } : { title: 'Story' };
}

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const story = await load((await params).slug);
  if (!story) notFound();
  return (
    <PublicShell>
      <article className="shell max-w-3xl py-12">
        <p className="kicker">{placeLabel(story) || 'Community story'}</p>
        <h1 className="display-lg mt-4 text-acacia-700">{String(story.title)}</h1>
        <p className="mt-3 text-sm text-ink-muted">By {String(story.authorName)}{story.publishedAt ? ` · ${new Date(String(story.publishedAt)).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}</p>
        {story.coverImage && <div className="relative mt-8 aspect-[16/10] overflow-hidden rounded-[1.2rem]"><SmartImage src={story.coverImage} alt="" fill priority sizes="768px" className="object-cover" /></div>}
        <Prose text={String(story.body)} className="mt-8 text-[1.0625rem]" />
        <div className="mt-8"><Gallery images={(story.gallery ?? []).map((src) => ({ src }))} /></div>
      </article>
    </PublicShell>
  );
}
