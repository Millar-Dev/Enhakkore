/**
 * Mkuranga Community Outreach — a completed project.
 *
 * Everything here is either something the photographs show or something you
 * told me. There are no figures for children reached, money spent or donations
 * collected, because none were given: an outreach page that invents numbers is
 * worth less than one that stays quiet about them. Add them to `figures` below
 * when you have them and the section appears on its own.
 *
 * The photographs are of real children, published with the organiser's
 * confirmed consent and authorisation. They were chosen to show the day — the
 * journey, the village, the meal, the group — rather than to single any child
 * out, and no child is named anywhere. Removing any frame is one line in
 * `gallery`.
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
    { src: '/impact/mkuranga/bus.webp', alt: 'Travelling down to Mkuranga together' },
    { src: '/impact/mkuranga/travelling.webp', alt: 'The team on the road from Dar es Salaam' },
    { src: '/impact/mkuranga/village.webp', alt: 'Arriving at Hoyoyo village, Mkuranga' },
    { src: '/impact/mkuranga/welcome.webp', alt: 'Children and volunteers gathered on arrival' },
    { src: '/impact/mkuranga/arrival-crowd.webp', alt: 'The group gathering at the village' },
    { src: '/impact/mkuranga/meal-served.webp', alt: 'Plates prepared for the shared meal' },
    { src: '/impact/mkuranga/plates.webp', alt: 'Sharing out the food' },
    { src: '/impact/mkuranga/meal-shared.webp', alt: 'The meal shared together on mats under the trees' },
    { src: '/impact/mkuranga/eating.webp', alt: 'Children eating together on the mats' },
    { src: '/impact/mkuranga/gathering.webp', alt: 'Children and volunteers under the trees' },
    { src: '/impact/mkuranga/under-trees.webp', alt: 'The group together under the trees' },
    { src: '/impact/mkuranga/together.webp', alt: 'The group during the afternoon' },
    { src: '/impact/mkuranga/afternoon.webp', alt: 'The afternoon at the village' },
    { src: '/impact/mkuranga/crowd-wide.webp', alt: 'The gathering at Hoyoyo village' },
    { src: '/impact/mkuranga/group.webp', alt: 'The whole group under the trees' },
    { src: '/impact/mkuranga/group-photo.webp', alt: 'Everyone together for a group photograph' },
    { src: '/impact/mkuranga/farewell.webp', alt: 'Waving at the end of the day' },
    { src: '/impact/mkuranga/waving.webp', alt: 'Waving as the day ends' },
  ],

  /**
   * A video was mentioned but none arrived — the folder held photographs only.
   * Drop the file in /public/impact/mkuranga/ and name it here, with a poster
   * frame, and the player appears.
   */
  video: null as { src: string; poster: string; caption: string } | null,
} as const;
