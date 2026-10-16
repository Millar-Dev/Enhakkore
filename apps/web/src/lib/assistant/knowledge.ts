import { ARUSHA } from '@/content/arusha';
import { CONTACT } from '@/content/contact';
import { MKURANGA } from '@/content/mkuranga';
import { NAPURU } from '@/content/napuru';
import { UPCOMING_TRIPS } from '@/content/packages';
import { formatMoney } from '@enhakkore/shared';

/**
 * What the assistant is allowed to know.
 *
 * Every fact is read from the same content files the pages render, so the
 * assistant cannot drift from the website: change a price in napuru.ts and the
 * answer changes with it. Nothing is written here twice, and nothing is
 * written here that is not already published.
 *
 * This is the whole of its knowledge. Asked about anything outside it, the
 * assistant says it does not know and hands over a phone number — which is far
 * more use to someone than a confident guess about a departure time.
 */

export interface Topic {
  id: string;
  /** Words that suggest this is what was asked about. */
  cues: string[];
  question: string;
  answer: string;
  href?: string;
}

const money = (m: { amount: number; currency: string }) => formatMoney(m);

function tripTopics(): Topic[] {
  return UPCOMING_TRIPS.flatMap((trip) => {
    const name = trip.title.toLowerCase();
    const first = name.split(' ')[0]!;
    // Price and date first: on an equal score the sharper answer wins, and
    // "how much is it" deserves the number, not the brochure paragraph.
    return [
      {
        id: `${trip.slug}-price`,
        cues: [first, 'price', 'cost', 'how much', 'fee', 'charge', 'tsh', 'tzs', 'usd', 'dollars', 'shillings'],
        question: `How much is ${trip.title}?`,
        answer: `${trip.title} is ${money(trip.price)} per person${trip.altPrice ? `. Non-residents pay ${money(trip.altPrice)} per person — that is a separate price, not a conversion` : ''}.`,
        href: `/packages/${trip.slug}`,
      },
      {
        id: `${trip.slug}-date`,
        cues: [first, 'when', 'date', 'departure', 'leaving', 'month'],
        question: `When does ${trip.title} leave?`,
        answer: `${trip.title} runs ${trip.datesLabel} — ${trip.duration}.`,
        href: `/packages/${trip.slug}`,
      },
      {
        id: `${trip.slug}-overview`,
        cues: [first, name, trip.destination.toLowerCase(), 'trip', 'tour', 'package', 'travel', 'upcoming', 'coming up'],
        question: `Tell me about ${trip.title}`,
        answer: `${trip.title} — ${trip.subtitle}. ${trip.duration} to ${trip.destination}, departing ${trip.datesLabel}, ${money(trip.price)} per person. ${trip.summary}`,
        href: `/packages/${trip.slug}`,
      },
    ];
  });
}

export function buildKnowledge(): Topic[] {
  const phones = CONTACT.phones.map((p) => p.display).join(' or ');

  return [
    ...tripTopics(),

    {
      id: 'napuru-included',
      cues: ['napuru', 'include', 'included', 'cover', 'covers', 'what do i get', 'inclusive'],
      question: 'What does the Napuru Gateway price include?',
      answer: `Napuru Gateway covers ${NAPURU.included.join(', ').toLowerCase()}. Anything not on that list is not included. Departure time, meeting point and how many places are left have not been announced yet — ask us and we will tell you.`,
      href: `/packages/${NAPURU.slug}`,
    },
    {
      id: 'arusha-included',
      cues: ['arusha', 'include', 'included', 'cover', 'covers', 'accommodation', 'hotel', 'meals', 'food'],
      question: 'What does Arusha Escape include?',
      answer: `Arusha Escape covers ${ARUSHA.included.map((i) => i.title.toLowerCase()).join(', ')}. The evening at ACES is still subject to confirming the venue.`,
      href: `/packages/${ARUSHA.slug}`,
    },
    {
      id: 'arusha-itinerary',
      cues: ['arusha', 'itinerary', 'plan', 'schedule', 'programme', 'program', 'days', 'chemka', 'shanga', 'waterfall', 'maasai', 'market'],
      question: "What is the Arusha itinerary?",
      answer: ARUSHA.itinerary
        .map((day) => `${day.day} ${day.date}: ${day.stops.map((s) => s.name).join(', ')}.`)
        .join(' '),
      href: `/packages/${ARUSHA.slug}`,
    },
    {
      id: 'booking',
      cues: ['book', 'booking', 'reserve', 'join', 'place', 'seat', 'sign up', 'register'],
      question: 'How do I book a place?',
      answer: `Send a booking request from the trip page and we will come back to you. Nothing is reserved by the form itself — you pay using the number on the trip page, send us the confirmation, and once a member of our team has checked it we confirm your place and add you to the private participant group.`,
      href: `/packages/${NAPURU.slug}`,
    },
    {
      id: 'payment',
      cues: ['pay', 'paying', 'payment', 'mpesa', 'm-pesa', 'lipa', 'money', 'transfer', 'send money', 'deposit'],
      question: 'How do I pay?',
      answer: `Payments go directly to the trip organiser, not through this website — no card details are ever taken here. For Napuru Gateway the number is ${NAPURU.payment.number}. Talk to us on ${phones} before sending anything, and send your transaction reference afterwards so we can confirm your place.`,
      href: `/packages/${NAPURU.slug}`,
    },
    {
      id: 'group',
      cues: ['group', 'whatsapp', 'chat', 'participants', 'others', 'who else'],
      question: 'Is there a group chat?',
      answer: `Yes — each trip has its own private participant group on WhatsApp. The link is never posted publicly; we send it to you once your payment has been confirmed.`,
    },
    {
      id: 'impact',
      cues: ['impact', 'charity', 'wsc', 'children', 'donate', 'donation', 'give', 'outreach', 'community', 'mkuranga'],
      question: 'What is the impact work?',
      answer: `${MKURANGA.summary} It is recorded on the site as it happened — no figures for money spent or children reached, because we do not publish numbers we cannot stand behind. If you want to support the work, contact us and we will tell you how. Contributions are kept entirely separate from trip payments.`,
      href: `/impact/${MKURANGA.slug}`,
    },
    {
      id: 'contact',
      cues: ['contact', 'phone', 'call', 'email', 'reach', 'talk', 'speak', 'whatsapp number', 'instagram', 'social'],
      question: 'How do I contact you?',
      answer: `Call or message ${phones}, or email ${CONTACT.email}. We are also on Instagram at ${CONTACT.social.map((s) => s.handle).join(' and ')}.`,
      href: '/contact',
    },
    {
      id: 'who',
      cues: ['who are you', 'about', 'enhakkore', 'company', 'what do you do'],
      question: 'Who is Enhakkore?',
      answer: `Enhakkore Travel & Impact runs group trips and experiences, and does community outreach alongside them. The trips on this site are ones we organise ourselves.`,
      href: '/impact',
    },
    {
      id: 'refund',
      cues: ['refund', 'cancel', 'cancellation', 'money back', 'postpone', 'policy', 'terms'],
      question: 'What is the cancellation policy?',
      answer: `We have not published cancellation terms for these trips yet, so I do not want to guess at them. Please ask us directly on ${phones} and we will tell you where we stand before you pay anything.`,
      href: '/contact',
    },
  ];
}

/** A compact brief for the model adapter — the same facts, as plain text. */
export function knowledgeAsBrief(): string {
  return buildKnowledge()
    .map((topic) => `Q: ${topic.question}\nA: ${topic.answer}${topic.href ? `\n(page: ${topic.href})` : ''}`)
    .join('\n\n');
}

/** Shown as starting points before anyone has typed. */
export const SUGGESTIONS = [
  'What trips are coming up?',
  'How much is Napuru Gateway?',
  'How do I book and pay?',
  'What is the impact work?',
];
