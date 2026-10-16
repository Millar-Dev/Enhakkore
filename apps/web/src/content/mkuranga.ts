/**
 * Mkuranga Community Outreach — a completed project.
 *
 * Everything here is either something the photographs show or something you
 * told me. There are no figures for children reached, money spent or donations
 * collected, because none were given: an outreach page that invents numbers is
 * worth less than one that stays quiet about them. Add them to `figures` below
 * when you have them and the section appears on its own.
 *
 * The photographs are of real children. They were chosen to show the day — the
 * journey, the village, the meal, the group — rather than to single any child
 * out, and no child is named anywhere. Publishing them needs the permission of
 * the people responsible for those children; that is yours to confirm, and
 * removing any frame is one line in `gallery`.
 */

export const MKURANGA = {
  slug: 'mkuranga-outreach',
  title: 'Mkuranga Community Outreach',
  location: 'Hoyoyo village, Mkuranga, Tanzania',
  status: 'Completed' as const,
  /** The day the outreach took place. Correct this if the date is different. */
  dateLabel: 'October 2026',

  summary:
    'A day spent with children at Hoyoyo village in Mkuranga — travelling down together, sharing a meal, and spending the afternoon with the community.',

  story: [
    'The team travelled from Dar es Salaam to Hoyoyo village in Mkuranga for the day. What had been planned on paper turned into something simpler once everyone arrived: a large group of children, a shade of trees, and an afternoon together.',
    'Food was prepared and shared on mats in the open. The children ate together, the volunteers served and sat with them, and the afternoon carried on from there — the kind of day that is easier to show in photographs than to describe.',
    'This was Enhakkore’s own community outreach, carried out with the people who travel with us. It is recorded here as it happened, without claims about how much was spent or how many people it reached.',
  ],

  /**
   * Add real, verified numbers here when you have them — each becomes a tile.
   * Leave it empty rather than estimating.
   */
  figures: [] as { label: string; value: string }[],

  cover: {
    src: '/impact/mkuranga/cover.webp',
    alt: 'The outreach team and children of Hoyoyo village together for a group photograph',
  },

  gallery: [
    { src: '/impact/mkuranga/travelling.webp', alt: 'The team travelling from Dar es Salaam to Mkuranga' },
    { src: '/impact/mkuranga/village.webp', alt: 'Arriving at Hoyoyo village, Mkuranga' },
    { src: '/impact/mkuranga/welcome.webp', alt: 'Children and volunteers gathered together on arrival' },
    { src: '/impact/mkuranga/meal-served.webp', alt: 'Plates prepared for the shared meal' },
    { src: '/impact/mkuranga/meal-shared.webp', alt: 'The meal shared together on mats under the trees' },
    { src: '/impact/mkuranga/gathering.webp', alt: 'Children and volunteers gathered under the trees' },
    { src: '/impact/mkuranga/together.webp', alt: 'The group together during the afternoon' },
    { src: '/impact/mkuranga/group.webp', alt: 'The whole group under the trees' },
    { src: '/impact/mkuranga/farewell.webp', alt: 'Waving at the end of the day' },
  ],

  /**
   * A video was mentioned but none arrived — the folder held photographs only.
   * Drop the file in /public/impact/mkuranga/ and name it here, with a poster
   * frame, and the player appears.
   */
  video: null as { src: string; poster: string; caption: string } | null,
} as const;
