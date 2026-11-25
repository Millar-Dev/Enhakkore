import type { Metadata } from 'next';
import { CATERING_KIND_LABELS, PRICE_UNIT_LABELS, formatMoney } from '@enhakkore/shared';
import { PublicShell } from '@/components/layout/PublicShell';
import { EnquiryForm } from '@/components/public/Actions';
import { Empty } from '@/components/public/Cards';
import { SmartImage } from '@/components/public/SmartImage';
import { SocialIcon } from '@/components/site/SocialIcon';
import { apiGet } from '@/lib/api';
import type { Listing } from '@/lib/public';
import { getSite, waHref } from '@/lib/site';

export const metadata: Metadata = { title: 'Catering & lunchboxes', description: 'Travel lunchboxes, group catering and private chefs — for trips, safaris, excursions and events.' };
export const revalidate = 60;

const SERVICES = [
  ['LUNCHBOX', 'Travel lunchboxes', 'Packed meals for road trips, safaris, hikes, excursions and day trips — per person or for the whole group.'],
  ['GROUP', 'Group catering', 'Breakfast, lunch, dinner and refreshments for tour groups, private trips, events and outdoor activities, with menus shaped around the group and the budget.'],
  ['PRIVATE_CHEF', 'Private chef', 'On request: a chef cooking at your accommodation or chosen location, for a day or several. Availability, location, menu and price are confirmed individually.'],
] as const;

export default async function CateringPage() {
  const [{ settings }, packages] = await Promise.all([getSite(), apiGet<Listing[]>('/public/catering', 60)]);
  const list = packages ?? [];
  return (
    <PublicShell>
      <section className="relative overflow-hidden bg-acacia-700 text-white">
        <div className="absolute inset-0 opacity-[0.12] [background:radial-gradient(circle_at_20%_20%,#d4af53,transparent_45%),radial-gradient(circle_at_85%_70%,#e6cb8c,transparent_40%)]" />
        <div className="shell relative py-16 md:py-24">
          <p className="kicker !text-clay-400">Enhakkore Travel & Experiences</p>
          <h1 className="display-xl mt-4 max-w-3xl">Good journeys deserve good food</h1>
          <p className="mt-5 max-w-2xl text-[1.0625rem] leading-relaxed text-white/80">{settings.catering.intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={waHref(settings, 'catering')} target="_blank" rel="noreferrer noopener" className="inline-flex h-12 items-center gap-2 rounded-full bg-[#1f9d55] px-6 font-bold text-white"><SocialIcon platform="whatsapp" size={18} /> Order on WhatsApp</a>
            <a href={waHref(settings, 'privateChef')} target="_blank" rel="noreferrer noopener" className="inline-flex h-12 items-center rounded-full border border-white/30 px-6 font-semibold">Ask about a private chef</a>
          </div>
        </div>
      </section>

      <section className="shell py-14">
        <div className="grid gap-5 md:grid-cols-3">
          {SERVICES.map(([kind, title, body]) => (
            <div key={kind} className="rounded-[1.2rem] border border-line bg-[color:var(--color-cream)] p-6">
              <p className="font-display text-2xl text-acacia-700">{title}</p>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-ink-muted">Designed for travellers, groups and events — not a restaurant or delivery service.</p>
      </section>

      <section className="shell pb-14">
        {list.length === 0 ? (
          <Empty title="Menus are prepared to order" body="Tell us your group, dates, location and any dietary needs, and we will propose a menu and a price." />
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {list.map((item) => {
              const menu = (item.menu as { name: string; description?: string }[]) ?? [];
              const diet = (item.dietaryOptions as string[]) ?? [];
              return (
                <article key={item.id} id={item.slug} className="overflow-hidden rounded-[1.3rem] border border-line bg-white">
                  {item.coverImage && <div className="relative aspect-[16/9]"><SmartImage src={item.coverImage} alt="" fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover" /></div>}
                  <div className="p-6">
                    <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-clay-600">{CATERING_KIND_LABELS[String(item.kind)]}</p>
                    <h2 className="mt-1 font-display text-2xl text-acacia-700">{String(item.title)}</h2>
                    {item.summary && <p className="mt-2 text-ink-soft">{item.summary}</p>}
                    {menu.length > 0 && <ul className="mt-4 space-y-1.5 text-sm">{menu.map((dish) => <li key={dish.name}><strong className="text-ink">{dish.name}</strong>{dish.description ? <span className="text-ink-muted"> — {dish.description}</span> : null}</li>)}</ul>}
                    {diet.length > 0 && <p className="mt-3 text-xs text-ink-muted">Dietary options: {diet.join(', ')}</p>}
                    <p className="mt-4 font-bold text-acacia-600">
                      {typeof item.price === 'number' && item.currency && item.priceUnit !== 'ON_REQUEST' ? `${formatMoney({ amount: item.price, currency: item.currency })} ${PRICE_UNIT_LABELS[String(item.priceUnit)]}` : 'Price on request'}
                    </p>
                    {item.minPeople ? <p className="text-xs text-ink-muted">Minimum {String(item.minPeople)} people</p> : null}
                    {item.groupDiscounts ? <p className="mt-1 text-xs text-ink-muted">{String(item.groupDiscounts)}</p> : null}
                    {item.availability ? <p className="mt-1 text-xs text-ink-muted">{String(item.availability)}</p> : null}
                    {item.leadTime ? <p className="mt-1 text-xs text-ink-muted">Order notice: {String(item.leadTime)}</p> : null}
                    <a href={waHref(settings, item.kind === 'PRIVATE_CHEF' ? 'privateChef' : 'catering')} target="_blank" rel="noreferrer noopener" className="mt-5 inline-flex h-11 items-center rounded-full bg-acacia-600 px-5 text-sm font-bold text-white">Order or ask</a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="bg-[color:var(--color-cream)]">
        <div className="shell grid gap-8 py-14 lg:grid-cols-2">
          <div>
            <p className="kicker">Custom orders</p>
            <h2 className="display-md mt-3 text-acacia-700">Tell us what you need</h2>
            <p className="mt-3 text-ink-soft">Lunchboxes for a road trip, catering for a group, or a chef for your stay. Include your dates, the number of people, where you will be, and any dietary requirements or special requests.</p>
          </div>
          <div className="rounded-[1.2rem] border border-line bg-white p-5">
            <EnquiryForm type="CATERING" heading="Catering request" withDates withPeople extraFields={[{ name: 'location', label: 'Location', placeholder: 'Where should we deliver or cook?' }, { name: 'dietary', label: 'Dietary requirements', placeholder: 'Vegetarian, halal, allergies…' }]} messagePlaceholder="Lunchboxes, group meals or a private chef — what do you have in mind?" whatsappHref={waHref(settings, 'catering')} />
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
