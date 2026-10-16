/**
 * How to reach Enhakkore.
 *
 * The single source for contact details — the footer, the contact page and the
 * package pages all read from here, so a number is changed once.
 *
 * The Instagram links are the plain profile addresses. The versions these came
 * from carried `utm_source`, `psln` and `xtok` parameters, which are tracking
 * tokens generated for a particular QR code or share; publishing them pins
 * every visitor's visit to that one share and serves no purpose on a website.
 */

export interface Phone {
  label: string;
  display: string;
  dial: string;
  /** Shown in the footer. The rest appear on the contact page. */
  primary?: boolean;
}

export const CONTACT = {
  phones: [
    { label: 'Tanzania', display: '+255 745 341 440', dial: '+255745341440', primary: true },
    { label: 'Malaysia', display: '+60 11-3936 9848', dial: '+601139369848', primary: true },
    { label: 'Tanzania', display: '+255 672 302 026', dial: '+255672302026' },
  ] as Phone[],

  email: 'michaelskitumi@gmail.com',

  /** Enhakkore's own accounts. */
  social: [
    { label: 'Travel', handle: '@enhakkoretravel', href: 'https://www.instagram.com/enhakkoretravel' },
    { label: 'Impact', handle: '@enhakkore.impact', href: 'https://www.instagram.com/enhakkore.impact' },
  ],

  /** WSC's own account — listed as theirs, not as ours. */
  partnerSocial: { label: 'WSC', handle: '@_wsc2022', href: 'https://www.instagram.com/_wsc2022' },

  /** Where the team is based, when you want it shown. */
  address: null as string | null,
} as const;
