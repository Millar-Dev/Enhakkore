/**
 * The policy pages. Each starts as a plain-language DRAFT written for the
 * owner to edit in Settings → Legal & policies. None has been reviewed by a
 * lawyer, and every page says so until the owner ticks "reviewed".
 */
export const LEGAL_PAGES = [
  { key: 'terms', title: 'Terms and conditions' },
  { key: 'privacy', title: 'Privacy policy' },
  { key: 'cookies', title: 'Cookie policy' },
  { key: 'community', title: 'Community guidelines' },
  { key: 'activityRules', title: 'Event and activity rules' },
  { key: 'travel', title: 'Travel booking conditions' },
  { key: 'accommodation', title: 'Accommodation enquiry and reservation terms' },
  { key: 'cancellation', title: 'Cancellation and refund policy' },
  { key: 'partners', title: 'Partner agreements' },
  { key: 'gaming', title: 'Gaming rules and disputes' },
  { key: 'donations', title: 'Donation policy' },
  { key: 'complaints', title: 'Complaints and reporting' },
  { key: 'safety', title: 'Community safety' },
] as const;
export type LegalKey = (typeof LEGAL_PAGES)[number]['key'];

export const LEGAL_DRAFTS: Record<LegalKey, string> = {
  terms:
    'These terms describe how Enhakkore Travel & Impact ("Enhakkore") lets you use this website.\n\nBrowsing, creating a member account, joining communities and free activities, and sending enquiries are free. An enquiry is a request, not a booking: nothing is confirmed until Enhakkore or the business confirms it to you directly.\n\nYou agree to give accurate details, to respect other members, and not to misuse the website. Enhakkore may remove content or suspend accounts that break these terms or the community guidelines.\n\nListings show who provided their details (verified by Enhakkore, submitted by the business, or not yet verified). Enhakkore is not responsible for services provided by third-party businesses or community organisers.',
  privacy:
    'Enhakkore collects the details you give us — your name, phone or WhatsApp number, email, and what you ask for — so we can answer enquiries, manage registrations and run trips.\n\nWe never show your phone number, email, payment details or registrations publicly. Your public profile shows only what you choose to share.\n\nWe use your details only to provide our services and to contact you about them. We do not sell personal data. You can ask us to correct or delete your details at any time on WhatsApp.',
  cookies:
    'This website uses only the storage needed to keep you signed in and to remember simple preferences on your device. It does not use advertising cookies. If visitor analytics is switched on, it counts visits without identifying you personally.',
  community:
    'Be respectful. No harassment, hate, threats, scams or spam. Do not share anyone else’s personal details. Meet in public places. Report anything that feels wrong — reports go to the Enhakkore team, and the person reported is not told who reported them.',
  activityRules:
    'Every activity and event submitted by a member is reviewed before it is published. Small, free, low-risk activities need basic approval; large, paid or higher-risk events need enhanced approval and organiser verification.\n\nOrganisers must describe their activity honestly, keep participants informed of changes, and never ask participants for payment outside what was approved. Enhakkore may cancel or remove any activity.',
  travel:
    'A trip registration is an application. Your place is confirmed only after Enhakkore reviews it and you receive confirmation. Payment instructions are given on each trip and confirmed by the team.\n\nTrips may depend on a minimum group size and on supplier confirmation; the trip page shows the current stage. Itineraries can change for safety, weather or supplier reasons, and you will be told of any change.',
  accommodation:
    'Hotel enquiries and restaurant reservation requests sent through Enhakkore are requests only. A room or table is not reserved until the property confirms availability and price. Enhakkore passes your request on and follows up, but does not guarantee availability.',
  cancellation:
    'Each trip, event and service shows its own cancellation terms. Where none are shown, ask the Enhakkore team on WhatsApp before you pay. Refunds, where due, are made to the payer by the original payment method where possible.',
  partners:
    'Businesses may apply to be listed or promoted. Enhakkore decides which businesses are featured and publishes all listings itself after verification. Paid placements are always labelled “Sponsored” and never change how other listings are ranked. Commission and referral terms are agreed in writing with each partner.',
  gaming:
    'Gaming tournaments are free to enter at launch. Players must give their real in-game ID, follow each tournament’s rules and respect age limits. Cheating, account sharing or abuse leads to disqualification.\n\nDisputes must be raised with the organiser within the time stated on the tournament, with evidence (screenshots or recordings). The organiser’s decision after review is final.',
  donations:
    'Donations support community projects carried out with WSC — We Save Children. They are recorded separately from Enhakkore’s business income. Online donation payments are not active yet; the donate page shows the account to use and how to confirm your gift.',
  complaints:
    'To complain or report a problem, use the report button on a listing or profile, or message Enhakkore on WhatsApp. We aim to acknowledge every report within two working days and tell you what we decided.',
  safety:
    'Meet in public places, especially the first time. Tell a friend where you are going. Never share your home address or live location with people you have not met. Activities are reviewed before they are published, but Enhakkore does not supervise community-organised activities — use your own judgement, and report anything that feels wrong.',
};
