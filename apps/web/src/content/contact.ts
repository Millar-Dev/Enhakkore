/**
 * How to reach Enhakkore.
 *
 * The single source for contact details — the package pages, the contact page
 * and the footer all read from here, so a number is changed once.
 *
 * Only what has actually been supplied appears. No email address, office
 * address or social account is listed, because none has been given to publish;
 * add them below and they appear on their own.
 */

export const CONTACT = {
  phones: [
    { label: 'Tanzania', display: '+255 745 341 440', dial: '+255745341440' },
    { label: 'Tanzania', display: '+255 672 302 026', dial: '+255672302026' },
    { label: 'Malaysia', display: '+60 11-3936 9848', dial: '+601139369848' },
  ],

  /** Add when you have one you want published. */
  email: null as string | null,

  /** e.g. { label: 'Instagram', href: 'https://instagram.com/…' } */
  social: [] as { label: string; href: string }[],

  /** Where the team is based, when you want it shown. */
  address: null as string | null,
} as const;
