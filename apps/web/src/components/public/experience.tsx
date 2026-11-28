import type { CommunityCard } from '@/components/home/types';
import { ListingCard } from './Cards';

export function sectionHref(key: string) {
  return key === 'GAMING' ? '/experiences/gaming' : key === 'COMMUNITIES' ? '/experiences/communities' : `/experiences/c/${key.toLowerCase()}`;
}

export function CommunityTile({ community }: { community: CommunityCard & { official?: boolean; kind?: string; subject?: string | null; accessType?: string } }) {
  return (
    <ListingCard
      href={`/experiences/communities/${community.slug}`}
      image={community.coverImage}
      kicker={community.kind === 'STUDY_GROUP' ? `📚 ${community.subject ?? 'Study group'}` : community.category ? `${community.category.icon ?? ''} ${community.category.name}` : 'Community'}
      title={community.name}
      badges={[
        ...(community.isDemo ? [{ label: 'Demo', tone: 'demo' as const }] : []),
        ...(community.official ? [{ label: 'Official', tone: 'green' as const }] : []),
        ...(community.accessType === 'PRIVATE' ? [{ label: 'Private', tone: 'green' as const }] : []),
      ]}
      meta={[community.summary, `${community.memberCount} member${community.memberCount === 1 ? '' : 's'}`, [community.city?.name, community.country?.name].filter(Boolean).join(', ')]}
    />
  );
}

