import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicShell } from '@/components/layout/PublicShell';
import { EnquiryForm, SaveButton } from '@/components/public/Actions';
import { Facts, Gallery, Prose, VideoBlock } from '@/components/public/Cards';
import { SmartImage } from '@/components/public/SmartImage';
import { SocialIcon } from '@/components/site/SocialIcon';
import { apiGet } from '@/lib/api';
import { placeLabel, priceLabel, whenLabel, type Listing } from '@/lib/public';
import { getSite, waHref } from '@/lib/site';

export const revalidate = 60;
const load = (slug: string) => apiGet<Listing>(`/public/experiences/${slug}`, 60);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const item = await load((await params).slug);
  return item ? { title: String(item.title), description: item.summary ?? undefined } : { title: 'Experience' };
}

export default async function ExperiencePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [item, { settings }] = await Promise.all([load(slug), getSite()]);
  if (!item) notFound();
  const price = priceLabel(item.price, item.currency);
  return (
    <PublicShell>
      <section className="bg-[color:var(--color-cream)]">
        <div className="shell grid gap-8 py-10 md:py-14 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="kicker">{item.category?.icon} {item.category?.name ?? 'Experience'}</p>
            <h1 className="display-lg mt-4 text-acacia-700">{String(item.title)}</h1>
            {item.summary && <p className="mt-4 text-[1.0625rem] leading-relaxed text-ink-soft">{item.summary}</p>}
            <p className="mt-4 text-sm text-ink-muted">{placeLabel(item)} · Provided by {String(item.provider)}</p>
            <div className="mt-5"><SaveButton itemType="EXPERIENCE" itemId={item.id} /></div>
          </div>
          {item.coverImage && (
            <div className="relative aspect-[4/3] overflow-hidden rounded-[1.4rem]">
              <SmartImage src={item.coverImage} alt="" fill priority sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
            </div>
          )}
        </div>
      </section>
      <section className="shell grid gap-10 py-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-8">
          <Facts items={[
            { label: 'Duration', value: item.durationText as string },
            { label: 'When', value: (item.schedule as string) || whenLabel(item.startsAt, item.timezone, 'full') },
            { label: 'Meeting point', value: item.meetingPoint as string },
            { label: 'Price', value: price ? `${price}${item.priceNote ? ` ${item.priceNote}` : ''}` : 'On request' },
          ]} />
          <Prose text={item.description} />
          <div className="grid gap-6 sm:grid-cols-2">
            {((item.inclusions as string[]) ?? []).length > 0 && (
              <div><p className="font-display text-xl text-acacia-700">Included</p><ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">{(item.inclusions as string[]).map((line) => <li key={line}>{line}</li>)}</ul></div>
            )}
            {((item.exclusions as string[]) ?? []).length > 0 && (
              <div><p className="font-display text-xl text-acacia-700">Not included</p><ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">{(item.exclusions as string[]).map((line) => <li key={line}>{line}</li>)}</ul></div>
            )}
          </div>
          <VideoBlock url={item.videoUrl} />
          <Gallery images={(item.gallery ?? []).map((src) => ({ src }))} />
        </div>
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-[1.2rem] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
            <EnquiryForm type="EXPERIENCE" subjectType="EXPERIENCE" subjectId={item.id} subjectTitle={String(item.title)} heading="Ask about this experience" withDates withPeople whatsappHref={waHref(settings, 'experience', String(item.title))} />
            <a href={waHref(settings, 'experience', String(item.title))} target="_blank" rel="noreferrer noopener" className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#1f9d55] text-sm font-bold text-white">
              <SocialIcon platform="whatsapp" size={18} /> Ask on WhatsApp
            </a>
          </div>
        </aside>
      </section>
    </PublicShell>
  );
}
