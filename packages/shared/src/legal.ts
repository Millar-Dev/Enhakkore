/**
 * The Policy Centre. Every document starts as a plain-language DRAFT written
 * for the owner to edit in Settings → Legal & policies. None has been reviewed
 * by a lawyer. Each needs review under the laws of the United Republic of
 * Tanzania (including the Personal Data Protection Act, 2022) and of any other
 * country where Enhakkore operates, and every page says so until the owner
 * ticks "reviewed".
 *
 * LEGAL_VERSION is stored with every member's acceptance, so changing the
 * terms later can be tracked.
 */
export const LEGAL_VERSION = '2026-11-26';

export const LEGAL_GROUPS = ['Platform', 'Experiences', 'Travel & reservations', 'Business', 'Gaming', 'Community & safety', 'Impact', 'Team'] as const;

export const LEGAL_PAGES = [
  { key: 'terms', title: 'Platform terms and conditions', group: 'Platform' },
  { key: 'privacy', title: 'Privacy policy', group: 'Platform' },
  { key: 'cookies', title: 'Cookie policy', group: 'Platform' },
  { key: 'member', title: 'Member account terms', group: 'Platform' },
  { key: 'activityRules', title: 'Event and activity rules', group: 'Experiences' },
  { key: 'organiser', title: 'Event organiser terms', group: 'Experiences' },
  { key: 'eventPlanning', title: 'Event planning and hosting terms', group: 'Experiences' },
  { key: 'travel', title: 'Travel booking terms', group: 'Travel & reservations' },
  { key: 'groupTrips', title: 'Group trip terms', group: 'Travel & reservations' },
  { key: 'privateTrips', title: 'Private trip terms', group: 'Travel & reservations' },
  { key: 'accommodation', title: 'Accommodation enquiry and reservation terms', group: 'Travel & reservations' },
  { key: 'restaurants', title: 'Restaurant reservation terms', group: 'Travel & reservations' },
  { key: 'cancellation', title: 'Cancellation and refund policy', group: 'Travel & reservations' },
  { key: 'partners', title: 'Business partner terms', group: 'Business' },
  { key: 'sponsored', title: 'Sponsored promotion terms', group: 'Business' },
  { key: 'referral', title: 'Referral and commission terms', group: 'Business' },
  { key: 'gaming', title: 'Gaming tournament rules', group: 'Gaming' },
  { key: 'gamingDisputes', title: 'Gaming dispute and anti-cheating policy', group: 'Gaming' },
  { key: 'community', title: 'Community guidelines', group: 'Community & safety' },
  { key: 'ugc', title: 'User-generated content policy', group: 'Community & safety' },
  { key: 'chat', title: 'Trip group chat and messaging rules', group: 'Community & safety' },
  { key: 'complaints', title: 'Reporting and complaints procedure', group: 'Community & safety' },
  { key: 'safety', title: 'Community safety', group: 'Community & safety' },
  { key: 'donations', title: 'Donation and WSC policy', group: 'Impact' },
  { key: 'staff', title: 'Staff and team access policy', group: 'Team' },
] as const;
export type LegalKey = (typeof LEGAL_PAGES)[number]['key'];

/** Which documents a person accepts at each step. */
export const LEGAL_ACCEPTANCE = {
  register: ['terms', 'member', 'privacy', 'community'] as LegalKey[],
  tripApplication: ['travel', 'groupTrips', 'cancellation', 'chat'] as LegalKey[],
  publishActivity: ['activityRules', 'organiser', 'ugc'] as LegalKey[],
  tournament: ['gaming', 'gamingDisputes'] as LegalKey[],
  partnership: ['partners', 'sponsored', 'referral'] as LegalKey[],
};

const p = (...paragraphs: string[]) => paragraphs.join('\n\n');

export const LEGAL_DRAFTS: Record<LegalKey, string> = {
  terms: p(
    '1. Who we are. Enhakkore Travel & Impact ("Enhakkore", "we") runs this website and its services from Tanzania.',
    '2. What the website is. A platform to discover places, join experiences and communities, take part in free gaming tournaments, enquire about trips, stays and tables, and support community projects with WSC — We Save Children.',
    '3. What is free. Creating a member account, browsing, joining communities and free activities, entering gaming tournaments and sending enquiries are free.',
    '4. Requests are not bookings. An enquiry, reservation request or trip request is a request. Nothing is confirmed until Enhakkore, or the business concerned, confirms it to you directly.',
    '5. Third parties. Many listings describe businesses that are not Enhakkore. Each listing shows who provided its details. Enhakkore is not responsible for the services of third-party businesses or community organisers unless it says so in writing.',
    '6. Your conduct. You agree to give accurate information, to follow the community guidelines and the rules of anything you join, and not to misuse the website.',
    '7. Suspension. We may remove content or suspend accounts that break these terms.',
    '8. Changes. We may update these terms. The version and date are shown on each page; continuing to use the website after a change means you accept the new version.',
    '9. Law. These terms are intended to be governed by the laws of the United Republic of Tanzania. [Draft — to be confirmed by a lawyer.]',
  ),
  privacy: p(
    '1. What we collect: your name, phone or WhatsApp number, email, country and city if you give them, what you register for or ask about, and messages you send in trip groups.',
    '2. Why: to answer enquiries, run registrations, trips, tournaments and communities, keep the platform safe and meet legal duties.',
    '3. Who sees it: the Enhakkore team members whose role needs it, and — only for a request about a specific business — that business. Your phone number, email, game IDs, payments and registrations are never shown publicly.',
    '4. Messaging services: when the WhatsApp Business Platform is connected, enquiry summaries are sent to Enhakkore’s own WhatsApp numbers through Meta.',
    '5. Keeping it: we keep records while your account is active and as long as needed for accounting and legal purposes.',
    '6. Your rights: you can ask to see, correct or delete your details by messaging us on WhatsApp.',
    '7. Data protection law: Enhakkore intends to comply with the Personal Data Protection Act, 2022 of Tanzania, including any registration it requires. [Draft — to be confirmed by a lawyer.]',
  ),
  cookies: p(
    'This website uses only the storage needed to keep you signed in and remember simple preferences on your device. It uses no advertising cookies. If visitor analytics is switched on, it counts visits without identifying you personally.',
  ),
  member: p(
    '1. One account per person. Keep your password private; turn on two-factor sign-in if you have team access.',
    '2. Your profile shows only what you choose to share. Do not impersonate anyone.',
    '3. Creating an account does not give access to private trip groups — only a confirmed place on that departure does.',
    '4. You may close your account at any time by asking us on WhatsApp.',
  ),
  activityRules: p(
    '1. Every activity and event submitted by a member is reviewed before it is published.',
    '2. Small, free, low-risk activities need basic approval. Large, paid or higher-risk events need enhanced approval and verification of the organiser.',
    '3. Meet in public places. Never ask participants for home addresses or live locations.',
    '4. Enhakkore may cancel, change or remove any activity, and will tell registered members when a session changes.',
  ),
  organiser: p(
    '1. Organisers describe their activity honestly, keep participants informed, and manage their participant list responsibly.',
    '2. Organisers may not collect payment through or in the name of Enhakkore unless agreed in writing.',
    '3. Organisers are responsible for the safety of their activity and for any permits it needs.',
    '4. Enhakkore may remove an organiser’s activities or access if these terms are broken.',
  ),
  eventPlanning: p(
    '1. Sending an event-planning request is free and does not commit you to anything.',
    '2. Enhakkore’s planning and hosting services may be chargeable. Any price, deposit and cancellation terms are agreed with you in writing before work starts.',
    '3. Third-party suppliers (venues, caterers, photographers) remain responsible for their own services.',
  ),
  travel: p(
    '1. Applying for a trip is a request for a place. A place is confirmed only when Enhakkore confirms it and the payment shown on the trip has been verified.',
    '2. Payment instructions are shown on each trip and confirmed by the team. Never send money to anyone else in Enhakkore’s name.',
    '3. Trips can depend on a minimum group size and supplier confirmation. Each trip page shows its current stage and what is still being confirmed.',
    '4. Itineraries can change for safety, weather or supplier reasons; you will be told of any change.',
  ),
  groupTrips: p(
    '1. Group trips run for the group as a whole. Follow the trip leader’s instructions on safety and timing.',
    '2. Confirmed participants get access to the departure’s private group chat, which follows the trip group chat rules.',
    '3. If the minimum group size is not reached, Enhakkore will tell you what happens next before the trip.',
  ),
  privateTrips: p(
    'A private trip request is free. Enhakkore replies with a proposal; nothing is booked until you accept it in writing and any agreed payment is confirmed.',
  ),
  accommodation: p(
    'Hotel enquiries sent through Enhakkore are requests only. A room is not reserved until the property confirms availability and price. Enhakkore passes your request on and follows up, but does not guarantee availability and does not take payment on a property’s behalf unless stated.',
  ),
  restaurants: p(
    'A table request is not a confirmed reservation until the restaurant accepts it. Enhakkore will tell you the restaurant’s answer as soon as it has it.',
  ),
  cancellation: p(
    'Each trip, event and service shows its own cancellation terms. Where none are shown, ask the Enhakkore team on WhatsApp before you pay. Refunds, where due, go to the payer by the original method where possible. No refund, deposit or payment protection is promised beyond what the specific trip or service states in writing.',
  ),
  partners: p(
    '1. Businesses may apply to be listed, promoted or to partner. Enhakkore decides what is featured and publishes all listings itself after verification.',
    '2. A business must not describe itself as an Enhakkore partner unless a written agreement exists.',
    '3. Listing details must be accurate; Enhakkore labels who provided them.',
  ),
  sponsored: p(
    'Paid placements are always labelled “Sponsored”. Sponsorship never changes how other listings are ranked or reviewed.',
  ),
  referral: p(
    'Referral and booking commissions are agreed in writing with each partner, including the rate, what counts as a referral and when it is paid.',
  ),
  gaming: p(
    '1. Tournaments are free to enter at launch. No entry fees are taken.',
    '2. Players give their real in-game name and ID, follow each tournament’s rules and respect any age limit.',
    '3. Team captains are responsible for their squad’s registration.',
    '4. Example tournaments marked DEMO are not real scheduled tournaments.',
  ),
  gamingDisputes: p(
    '1. Cheating, hacking, account sharing, smurfing or abuse leads to disqualification.',
    '2. Raise a dispute with the organiser within the time stated on the tournament, with screenshots or recordings.',
    '3. The organiser reviews the evidence and decides; the decision after review is final.',
  ),
  community: p(
    'Be respectful. No harassment, hate, threats, scams or spam. Do not share anyone else’s personal details. Meet in public places. Report anything that feels wrong — reports go to the Enhakkore team, and the person reported is not told who reported them.',
  ),
  ugc: p(
    '1. You keep ownership of what you post, and give Enhakkore permission to show it on the platform.',
    '2. Post only content you have the right to share. Do not post anything illegal, harmful or misleading.',
    '3. Enhakkore may edit or remove content that breaks these rules.',
  ),
  chat: p(
    '1. Trip groups are private to confirmed participants and authorised team members.',
    '2. Be respectful and stay on topic. Do not share other people’s details or photos without permission.',
    '3. Messages can be reported; moderators may remove messages or participants, and the reason is recorded.',
    '4. Groups become read-only after the trip; their history is kept.',
  ),
  complaints: p(
    'Use the report button on a listing, profile or message, or message Enhakkore on WhatsApp. We aim to acknowledge reports within two working days and to tell you what we decided.',
  ),
  safety: p(
    'Meet in public places, especially the first time. Tell a friend where you are going. Never share your home address or live location with people you have not met. Activities are reviewed before they are published, but Enhakkore does not supervise community-organised activities — use your own judgement, and report anything that feels wrong.',
  ),
  donations: p(
    '1. Donations support community projects carried out with WSC — We Save Children, an independent charity group. They are recorded separately from Enhakkore’s business income.',
    '2. Online donation payments are not active. The donate page shows the account to use and how to confirm your gift.',
    '3. No impact figures are published unless they are verified.',
  ),
  staff: p(
    '1. Team access is by invitation only, one personal account per person, with only the permissions the role needs.',
    '2. Team members keep customer information confidential and use it only for their work.',
    '3. Two-factor sign-in is required for anyone with finance, staff or settings access.',
    '4. Access is removed when someone leaves the team. Actions are recorded in the audit log.',
  ),
};
