import type { Money } from '@enhakkore/shared';

/**
 * Arusha Escape — the whole package in one file.
 *
 * Everything the package page shows comes from here: dates, prices, the
 * day-by-day, what is included, what is still being confirmed, and the payment
 * details. Editing the trip means editing this file — no component needs to be
 * touched, and nothing is written twice.
 *
 * SOURCING RULE: every line below came from the trip brief. Where the brief
 * called something provisional it is marked `provisional: true` here and the
 * page says so plainly. Nothing is invented — no venue prices, no opening
 * hours, no reservations, no availability.
 */

export const ARUSHA = {
  slug: 'arusha-escape',
  title: 'Arusha Escape',
  subtitle: 'Adventure, Culture & Impact',

  destination: 'Arusha, Tanzania',
  departureCity: 'Dar es Salaam, Tanzania',

  /** 18–20 December 2026. */
  startDate: '2026-12-18',
  endDate: '2026-12-20',
  datesLabel: '18–20 December 2026',
  duration: '3 days, 2 nights',
  groupSize: 28,

  overview:
    'Three days away from the coast, in the green shadow of Mount Meru. A long road north with the people you will spend the weekend with, a day of waterfalls, craft and market colour in Arusha, and a last morning in the warm, impossibly clear water at Chemka before the journey home. Built for a group of twenty-eight, and run by Enhakkore together with WSC.',

  /**
   * Two prices, two different travellers. The USD figure is a price in its own
   * right, not a conversion — the page must never present it as one.
   */
  pricing: {
    resident: {
      label: 'Tanzanian resident',
      note: 'Residents of Tanzania',
      amount: { amount: 270_000, currency: 'TZS' } as Money,
    },
    nonResident: {
      label: 'International visitor',
      note: 'Non-residents',
      amount: { amount: 25_000, currency: 'USD' } as Money,
    },
  },

  itinerary: [
    {
      day: 'Friday',
      date: '18 December',
      title: 'Dar es Salaam to Arusha',
      summary: 'The group meets, the road north begins, and the weekend starts over a briefing.',
      stops: [
        { name: 'Mlimani City, Dar es Salaam', detail: 'Meeting point for the group before departure.' },
        { name: 'Travel to Arusha', detail: 'The journey north, together.' },
        {
          name: 'Check in and trip briefing',
          detail: 'Settle in, rest, meet the other travellers and run through the plan for the weekend.',
        },
      ],
    },
    {
      day: 'Saturday',
      date: '19 December',
      title: 'Adventure, Culture & Arusha City',
      summary: 'Waterfalls and a nature walk in the morning, craft and market colour in the afternoon.',
      stops: [
        { name: 'Meru Eco Camp', detail: 'The day starts in the green country below Mount Meru.' },
        { name: 'Napuru Waterfalls', detail: 'A nature walk and hike to the falls.' },
        { name: 'Cultural Heritage Centre', detail: 'Tanzanian art, craft and history under one roof.' },
        { name: 'Maasai Market', detail: 'Colour, cloth and beadwork — and room to bargain.' },
        {
          name: 'Evening at ACES',
          detail: 'An evening outing to finish the day.',
          provisional: true,
          provisionalNote: 'Venue and access arrangements still to be confirmed.',
        },
      ],
    },
    {
      day: 'Sunday',
      date: '20 December',
      title: 'Crafts, Nature & Return',
      summary: 'Artisan workshops, the clear water at Chemka, then the road home.',
      stops: [
        {
          name: 'Shanga',
          detail: 'Artisan glass, beadwork and weaving, made by a workshop built around social impact.',
        },
        {
          name: 'Chemka / Kikuletwa Hot Springs',
          detail: 'Warm, startlingly clear water under fig roots. Swimming, photographs and nothing to rush for.',
        },
        { name: 'Group games and bonding', detail: 'The part of a trip people actually remember.' },
        { name: 'Return to Dar es Salaam', detail: 'The journey home.' },
      ],
    },
  ],

  /** What a place on the trip covers. */
  included: [
    { title: 'Accommodation', detail: 'Two nights in Arusha.' },
    { title: 'Transport', detail: 'Return road transport from Dar es Salaam, and travel between the stops.' },
    { title: 'Meals', detail: 'Meals across the three days.' },
    { title: 'Entry fees', detail: 'Entry to the sites on the itinerary.' },
    { title: 'Guiding fees', detail: 'Guiding throughout the weekend.' },
    { title: 'Swimming and games', detail: 'Chemka hot springs, and the group games on the last day.' },
  ],

  /**
   * Said plainly rather than buried. Only what the trip itself flagged as
   * unsettled belongs here — everything else is in `included` above.
   */
  toConfirm: [
    {
      title: 'The evening at ACES',
      detail: 'Subject to confirming the venue and access arrangements.',
    },
  ],

  payment: {
    method: 'Vodacom M-Pesa',
    /** Both sets are in use and confirmed by the organiser. Either works. */
    options: [
      { kind: 'Lipa number', number: '58475848', name: 'Marystella Kirati' },
      { kind: 'M-Pesa number', number: '0750998996', name: 'Neema Maganga' },
    ],
    instruction:
      'Please contact the trip organiser to confirm availability and payment instructions before sending money. Submit your payment confirmation using the official booking contact.',
  },

  /** Who to call about a place, and where a payment confirmation goes. */
  contacts: [
    { label: 'Tanzania', display: '+255 745 341 440', dial: '+255745341440' },
    { label: 'Tanzania', display: '+255 672 302 026', dial: '+255672302026' },
    { label: 'Malaysia', display: '+60 11-3936 9848', dial: '+601139369848' },
  ],

  /**
   * Photographs of the places this trip actually goes to, from Wikimedia
   * Commons under Creative Commons licences. Each one names its
   * photographer and links to the original, because that is the condition
   * of using them — and because a credit costs nothing.
   *
   * Replace these with your own pictures from the trip when you have them;
   * drop the credit fields at the same time and the line disappears.
   */
  gallery: [
    {
      src: '/packages/arusha/napuru-waterfalls.webp',
      alt: 'Napuru Waterfalls, Arusha',
      credit: 'Tobias Kasambala',
      licence: 'CC BY-SA 4.0',
      source: 'https://commons.wikimedia.org/wiki/File:Napuru_waterfalls.jpg',
    },
    {
      src: '/packages/arusha/mount-meru.webp',
      alt: 'Mount Meru',
      credit: 'AmyAbroad',
      licence: 'CC BY-SA 4.0',
      source: 'https://commons.wikimedia.org/wiki/File:Mount_Meru_Tanzania_July_2025.jpg',
    },
    {
      src: '/packages/arusha/cultural-heritage-centre.webp',
      alt: 'Cultural Heritage Centre, Arusha',
      credit: 'George Lamson',
      licence: 'CC BY-SA 2.0',
      source: 'https://commons.wikimedia.org/wiki/File:Arusha_Cultural_Heritage_Centre.jpg',
    },
    {
      src: '/packages/arusha/arusha-city.webp',
      alt: 'Arusha',
      credit: 'Halidtz',
      licence: 'CC BY-SA 4.0',
      source: 'https://commons.wikimedia.org/wiki/File:Arusha_City_view.jpg',
    },
    {
      src: '/packages/arusha/chemka-1.webp',
      alt: 'Chemka / Kikuletwa Hot Springs',
      credit: 'Snomwajay',
      licence: 'CC BY-SA 4.0',
      source: 'https://commons.wikimedia.org/wiki/File:Chemka_Hot_Springs_01.jpg',
    },
    {
      src: '/packages/arusha/chemka-2.webp',
      alt: 'Chemka / Kikuletwa Hot Springs',
      credit: 'Daniel Msirikale',
      licence: 'CC BY-SA 4.0',
      source: 'https://commons.wikimedia.org/wiki/File:Chemka_Hot_Springs_6.jpg',
    },
  ],
} as const;

export type PricingTier = keyof typeof ARUSHA.pricing;
