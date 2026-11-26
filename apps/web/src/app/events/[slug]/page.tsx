import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EVENT_HOST_LABELS, zoneLabel } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { ReportButton, SaveButton } from '@/components/public/Actions';
import { Facts, Gallery, Prose, VideoBlock } from '@/components/public/Cards';
import { RegisterForm } from '@/components/public/RegisterForm';
import { SmartImage } from '@/components/public/SmartImage';
import { ShareButton, TrackView } from '@/components/public/Track';
import { SocialIcon } from '@/components/site/SocialIcon';
import { apiGet } from '@/lib/api';
import { placeLabel, whenLabel, type Listing } from '@/lib/public';
import { getSite, waHref } from '@/lib/site';

export const revalidate = 60;
const load = (slug: string) => apiGet<Listing>(`/public/events/${slug}`, 60);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const item = await load((await params).slug);
  return item ? { title: String(item.title), description: item.summary ?? undefined } : { title: 'Event' };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [item, { settings }] = await Promise.all([load(slug), getSite()]);
  if (!item) notFound();
  const zone = String(item.timezone);
  const ended = new Date(String(item.endsAt ?? item.startsAt)).getTime() < Date.now() || item.status === 'COMPLETED';
  const tickets = (item.tickets as { id: string; name: string; description: string | null; price: number; currency: string; remaining: number | null }[]) ?? [];
  const wa = waHref(settings, 'event', String(item.title));
  return (
    <PublicShell>
      <section className="bg-acacia-700 text-white">
        <div className="shell grid gap-8 py-10 md:py-14 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          {item.poster ? (
            <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-[1.2rem] shadow-2xl">
              <SmartImage src={String(item.poster)} alt={`${item.title} poster`} fill priority sizes="380px" className="object-cover" />
            </div>
          ) : null}
          <div className={item.poster ? '' : 'lg:col-span-2'}>
            <p className="kicker !text-clay-400">{item.category?.icon} {item.category?.name ?? 'Event'}</p>
            <h1 className="display-lg mt-4">{String(item.title)}</h1>
            <p className="mt-4 text-lg text-white/85">{whenLabel(item.startsAt, zone, 'full')} <span className="text-white/60">({zoneLabel(new Date(String(item.startsAt)), zone)})</span></p>
            <p className="mt-1 text-white/70">{[item.venue as string, placeLabel(item)].filter(Boolean).join(' · ')}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${item.host === 'ENHAKKORE' ? 'bg-clay-400 text-acacia-700' : 'bg-white/15 text-white'}`}>
                {item.host === 'ENHAKKORE' ? EVENT_HOST_LABELS.ENHAKKORE : `Third-party event${item.hostName ? ` · ${item.hostName}` : ''}`}
              </span>
              {item.status === 'SOLD_OUT' && <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink">Sold out</span>}
              {item.status === 'CANCELLED' && <span className="rounded-full bg-danger px-3 py-1.5 text-xs font-bold">Cancelled</span>}
              {ended && <span className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold">This event has taken place</span>}
            </div>
            <div className="mt-5 [&_.chip]:bg-white/10 [&_.chip]:text-white [&_.chip]:border-white/25"><SaveButton itemType="EVENT" itemId={item.id} /> <ShareButton subjectType="EVENT" subjectId={item.id} title={String(item.title)} /><TrackView subjectType="EVENT" subjectId={item.id} /></div>
          </div>
        </div>
      </section>
      <section className="shell grid gap-10 py-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-8">
          {item.summary && <p className="font-display text-2xl leading-snug text-acacia-700">{item.summary}</p>}
          <Prose text={item.description} />
          <Facts items={[
            { label: 'Venue', value: item.venue as string },
            { label: 'Address', value: item.address as string },
            { label: 'Ends', value: item.endsAt ? whenLabel(String(item.endsAt), zone) : null },
            { label: 'Dress code / theme', value: item.dressCode as string },
            { label: 'Age', value: item.ageRestriction as string },
            { label: 'Places left', value: typeof item.remaining === 'number' ? String(item.remaining) : null },
          ]} />
          <VideoBlock url={item.videoUrl} />
          <Gallery images={(item.gallery ?? []).map((src) => ({ src }))} />
        </div>
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-[1.2rem] border border-line bg-white p-5 shadow-[var(--shadow-card)]">
            <p className="font-display text-2xl text-acacia-700">{ended ? 'Event' : 'Tickets'}</p>
            <div className="mt-4">
              {ended || item.status === 'CANCELLED' ? (
                <p className="text-sm text-ink-muted">Registration is closed.</p>
              ) : item.registrationMode === 'ENHAKKORE' && item.status === 'PUBLISHED' ? (
                <RegisterForm slug={slug} tickets={tickets} whatsappHref={wa} />
              ) : item.registrationMode === 'EXTERNAL' && item.externalUrl ? (
                <a href={String(item.externalUrl)} target="_blank" rel="noreferrer noopener" className="inline-flex h-12 w-full items-center justify-center rounded-full bg-acacia-600 font-bold text-white">Get tickets from the organiser</a>
              ) : (
                <p className="text-sm text-ink-muted">{item.status === 'SOLD_OUT' ? 'Sold out.' : 'No registration needed — or ask us for details.'}</p>
              )}
            </div>
            <a href={wa} target="_blank" rel="noreferrer noopener" className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#1f9d55] text-sm font-bold text-white">
              <SocialIcon platform="whatsapp" size={18} /> Ask on WhatsApp
            </a>
            <div className="mt-4"><ReportButton targetType="EVENT" targetId={item.id} /></div>
          </div>
        </aside>
      </section>
    </PublicShell>
  );
}
