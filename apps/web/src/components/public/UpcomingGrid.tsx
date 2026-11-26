import { formatInZone } from '@enhakkore/shared';
import type { UpcomingCard } from '@/components/home/types';
import { CardGrid, ListingCard } from './Cards';

/** Activities, events and tournaments as one dated list of cards. */
export function UpcomingGrid({ items, limit }: { items: UpcomingCard[]; limit?: number }) {
  return (
    <CardGrid>
      {items.slice(0, limit ?? items.length).map((item) => (
        <ListingCard
          key={`${item.kind}-${item.id}`}
          href={item.href}
          image={item.image}
          kicker={[item.kind, item.category].filter(Boolean).join(' · ')}
          title={item.title}
          meta={[item.startsAt ? formatInZone(item.startsAt, 'Africa/Dar_es_Salaam', 'datetime') : item.recurrence ?? null, item.where]}
          badges={[...(item.isDemo ? [{ label: 'Demo', tone: 'demo' as const }] : []), ...(item.free ? [{ label: 'Free', tone: 'green' as const }] : [])]}
        />
      ))}
    </CardGrid>
  );
}
