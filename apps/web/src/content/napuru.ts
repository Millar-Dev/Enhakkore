import type { Money } from '@enhakkore/shared';

/**
 * Napuru Gateway — the next departure.
 *
 * The whole trip in one file. Adding the next Gateway means copying this file,
 * changing the fields and pointing a route at it; no component needs editing.
 *
 * Everything here was supplied. Nothing about a departure time, a meeting
 * point, the number of places left or a cancellation policy appears, because
 * none was given — the fields are below, empty, waiting for you.
 */

export const NAPURU = {
  slug: 'napuru-gateway',
  title: 'Napuru Gateway',
  subtitle: 'A day at the waterfalls',

  destination: 'Napuru, Arusha',
  /** Not supplied yet — fill in and the line appears on the page. */
  departureCity: null as string | null,

  startDate: '2026-10-24',
  endDate: '2026-10-24',
  datesLabel: '24 October 2026',
  duration: 'One day',

  overview:
    'A day out to Napuru — the walk in through green country, the falls themselves, and a meal together. One day, one price, and a small group travelling as one.',

  price: { amount: 35_000, currency: 'TZS' } as Money,

  /** Exactly what the package covers, and nothing more. */
  included: ['Transport', 'One meal', 'The planned activity', 'Guiding fees'],

  /**
   * Details that have not been decided or not been given. Each one shows on
   * the page as outstanding rather than being guessed at. Delete a line once
   * it is settled, and add it to the page content instead.
   */
  notYetSet: [
    'Departure time and meeting point',
    'How many places are still open',
    'Cancellation and refund terms',
  ],

  payment: {
    /**
     * Supplied as the payment number for this trip. No account name and no
     * provider are shown, because neither was given, and guessing at either is
     * how money reaches the wrong place.
     */
    number: '255745341440',
    label: 'Payment number — Napuru Gateway',
  },

  /**
   * The private participant group.
   *
   * The link is deliberately NOT stored here and never reaches the browser.
   * It is sent by the organiser once a payment has been checked — see the
   * booking steps on the page. Putting it in this file would publish it to
   * anyone who views the page source, which is the opposite of private.
   */
  group: {
    platform: 'WhatsApp',
    accessAfter: 'payment has been confirmed by the Enhakkore team',
  },

  /**
   * No photograph of Napuru has been supplied. Put one at
   * /public/packages/napuru/cover.webp and name it here, and the hero uses it.
   */
  cover: null as { src: string; alt: string } | null,
} as const;
