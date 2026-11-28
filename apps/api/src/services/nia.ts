import Anthropic from '@anthropic-ai/sdk';
import { ACTIVITY_PUBLIC_STATUSES, EVENT_PUBLIC_STATUSES } from '@enhakkore/shared';
import { readJsonSetting } from '../lib/json';
import { prisma } from '../lib/prisma';
import { textContains } from '../lib/search';
import { ENHAKKORE_ORGANIZER_SLUG } from './resources/hooks';
import { expandQuery, scoreText } from './semantic';

/**
 * Nia — Enhakkore's discovery and help assistant for members.
 *
 * Everything Nia recommends comes from the Enhakkore database through
 * `searchPlatform`; she never invents listings, events, prices or
 * availability. She only proposes actions (save to wishlist, join a public
 * group); the member confirms them with a button, and the normal API with
 * its own permission checks does the work.
 */

export const NIA_DEFAULTS = {
  enabled: true,
  text: true,
  voice: true,
  /** Questions per member per day. */
  dailyLimit: 40,
  categories: ['places', 'experiences', 'trips', 'events', 'activities', 'communities', 'study_groups', 'tournaments', 'gaming_sessions'] as string[],
};
export type NiaSettings = typeof NIA_DEFAULTS;
export const niaSettings = () => readJsonSetting('nia', NIA_DEFAULTS);
export const niaAiConnected = () => !!process.env.ANTHROPIC_API_KEY?.trim();

export const NIA_CATEGORIES: Record<string, string> = {
  places: 'Explore places (stays, food, venues, attractions)',
  experiences: 'Experiences',
  trips: 'Travel packages and trips',
  events: 'Events',
  activities: 'Community activities',
  communities: 'Communities',
  study_groups: 'Study groups',
  tournaments: 'Gaming tournaments',
  gaming_sessions: 'Gaming sessions',
};

export interface NiaResult {
  type: string;
  id: string;
  title: string;
  subtitle: string | null;
  link: string;
  image: string | null;
  /** A reversible action Nia may offer; the member confirms it. */
  action?: { kind: 'SAVE' | 'JOIN_GROUP'; itemType?: string; itemId?: string; slug?: string; label: string } | null;
}

/** Where things are in the member's account — used to answer "where do I find…" questions. */
export const ACCOUNT_GUIDE: { keywords: string[]; title: string; link: string; help: string }[] = [
  { keywords: ['trip', 'trips', 'arusha', 'my trips', 'booking status', 'itinerary'], title: 'My Trips', link: '/account/applications', help: 'Your trip bookings: upcoming, active and completed, with status and itinerary.' },
  { keywords: ['payment', 'deposit', 'receipt', 'balance', 'pay'], title: 'My Trip Payments', link: '/account/applications', help: 'Open a trip to see the price, deposit, balance and upload a payment receipt.' },
  { keywords: ['reservation', 'hotel', 'restaurant', 'venue', 'table', 'room'], title: 'My Reservations', link: '/account/enquiries', help: 'Hotel, restaurant and venue requests with their reference and status.' },
  { keywords: ['pass', 'ticket', 'qr', 'check-in'], title: 'My Passes', link: '/account/passes', help: 'Your Enhakkore Pass for confirmed events, trips and reservations.' },
  { keywords: ['wishlist', 'saved', 'favourite', 'favorite'], title: 'Wishlist', link: '/account/saved', help: 'Places, trips, events and activities you saved.' },
  { keywords: ['message', 'messages', 'dm', 'chat with', 'inbox'], title: 'My Messages', link: '/account/messages', help: 'Private one-to-one conversations with friends and members who follow you back.' },
  { keywords: ['group chat', 'group chats'], title: 'My Group Chats', link: '/account/chats', help: 'Chats of your communities, study groups, teams and tournaments.' },
  { keywords: ['study group', 'study groups', 'revision'], title: 'My Study Groups', link: '/account/study-groups', help: 'Your study group conversations. Use Discover to find new groups, or + to start one.' },
  { keywords: ['tournament', 'gaming', 'game friends', 'squad', 'guild', 'team'], title: 'Gaming Hub', link: '/account/gaming', help: 'My Tournaments and Game Friends: your registrations, results, friends, squads and guilds.' },
  { keywords: ['notification', 'notifications', 'alerts', 'quiet hours'], title: 'My Notifications', link: '/account/notifications', help: 'All your updates; switch types and push notifications on or off under Settings there.' },
  { keywords: ['profile', 'username', 'photo', 'privacy', 'date of birth'], title: 'Profile & privacy', link: '/account/profile', help: 'Edit your photo, name, username, interests and who sees each part of your profile.' },
  { keywords: ['password', 'security', 'sign out', 'sessions'], title: 'Settings', link: '/account/settings', help: 'Password, signed-in devices and preferences.' },
  { keywords: ['host', 'organise', 'organize', 'create activity', 'create event'], title: 'Host & Organise', link: '/experiences/host', help: 'Apply as an organiser and publish your own activities.' },
];

export function guideFor(text: string) {
  const lower = text.toLowerCase();
  return ACCOUNT_GUIDE.filter((entry) => entry.keywords.some((keyword) => lower.includes(keyword))).slice(0, 3);
}

/** Searches real, published Enhakkore records. */
export async function searchPlatform(query: string, categories: string[], limit = 8): Promise<NiaResult[]> {
  const q = query.trim().slice(0, 120);
  if (!q) return [];
  const expanded = expandQuery(q);
  const terms = [...new Set([...expanded.direct.filter((word) => word.length >= 3), ...expanded.related.filter((term) => !term.includes(' ')).slice(0, 6)])].slice(0, 8);
  if (terms.length === 0) return [];
  const anyOf = (fields: string[]) => ({ OR: terms.flatMap((term) => fields.map((field) => ({ [field]: textContains(term) }))) });
  const on = (key: string) => categories.includes(key);
  const now = new Date();
  const [places, experiences, trips, events, activities, communities, tournaments, sessions] = await Promise.all([
    on('places') ? prisma.place.findMany({ where: { status: 'PUBLISHED', ...anyOf(['name', 'summary', 'description']) }, include: { city: true }, take: 20 }) : [],
    on('experiences') ? prisma.experience.findMany({ where: { status: 'PUBLISHED', ...anyOf(['title', 'summary', 'description']) }, take: 15 }) : [],
    on('trips') ? prisma.trip.findMany({ where: { status: 'PUBLISHED', organizer: { slug: ENHAKKORE_ORGANIZER_SLUG }, ...anyOf(['title', 'summary', 'description']) }, take: 10 }) : [],
    on('events') ? prisma.event.findMany({ where: { status: { in: EVENT_PUBLIC_STATUSES.filter((s) => s !== 'COMPLETED') }, ...anyOf(['title', 'summary', 'description']) }, take: 15 }) : [],
    on('activities') ? prisma.activity.findMany({ where: { status: { in: ACTIVITY_PUBLIC_STATUSES.filter((s) => s !== 'COMPLETED') }, ...anyOf(['title', 'summary', 'description']) }, take: 15 }) : [],
    on('communities') || on('study_groups')
      ? prisma.community.findMany({ where: { status: 'PUBLISHED', kind: { in: [...(on('communities') ? ['COMMUNITY'] : []), ...(on('study_groups') ? ['STUDY_GROUP'] : [])] }, ...anyOf(['name', 'summary', 'description', 'subject', 'topic', 'course', 'tags']) }, take: 25 })
      : [],
    on('tournaments') ? prisma.tournament.findMany({ where: { status: { in: ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS'] }, OR: [...anyOf(['title', 'summary']).OR, ...terms.map((term) => ({ game: { name: textContains(term) } }))] }, include: { game: true }, take: 10 }) : [],
    on('gaming_sessions') ? prisma.gamingSession.findMany({ where: { status: 'OPEN', startsAt: { gte: now }, ...anyOf(['title', 'game', 'description']) }, take: 10 }) : [],
  ]);
  const scored: (NiaResult & { score: number })[] = [];
  const add = (result: NiaResult, text: string) => scored.push({ ...result, score: scoreText(text, expanded, 1) });
  for (const p of places) add({ type: 'Place', id: p.id, title: p.name, subtitle: [p.city?.name, p.summary].filter(Boolean).join(' · ') || null, link: `/explore/${p.slug}`, image: p.coverImage, action: { kind: 'SAVE', itemType: 'PLACE', itemId: p.id, label: 'Save to wishlist' } }, `${p.name} ${p.summary ?? ''}`);
  for (const e of experiences) add({ type: 'Experience', id: e.id, title: e.title, subtitle: e.summary ?? null, link: `/experiences/${e.slug}`, image: e.coverImage, action: { kind: 'SAVE', itemType: 'EXPERIENCE', itemId: e.id, label: 'Save to wishlist' } }, `${e.title} ${e.summary ?? ''}`);
  for (const t of trips) add({ type: 'Trip', id: t.id, title: t.title, subtitle: t.summary ?? null, link: `/travel/${t.slug}`, image: t.heroImage, action: null }, `${t.title} ${t.summary ?? ''}`);
  for (const e of events) add({ type: 'Event', id: e.id, title: e.title, subtitle: e.startsAt ? e.startsAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Dar_es_Salaam' }) : null, link: `/events/${e.slug}`, image: e.poster, action: { kind: 'SAVE', itemType: 'EVENT', itemId: e.id, label: 'Save to wishlist' } }, `${e.title} ${e.summary ?? ''}`);
  for (const a of activities) add({ type: 'Activity', id: a.id, title: a.title, subtitle: a.summary ?? null, link: `/activities/${a.slug}`, image: a.coverImage, action: { kind: 'SAVE', itemType: 'ACTIVITY', itemId: a.id, label: 'Save to wishlist' } }, `${a.title} ${a.summary ?? ''}`);
  for (const c of communities) {
    const isPrivate = c.accessType === 'PRIVATE';
    add(
      {
        type: c.kind === 'STUDY_GROUP' ? 'Study group' : 'Community',
        id: c.id,
        title: c.name,
        subtitle: [isPrivate ? 'Private' : 'Public', c.subject, c.summary].filter(Boolean).join(' · '),
        link: `/experiences/communities/${c.slug}`,
        image: c.coverImage,
        action: !isPrivate && c.accessType === 'FREE' && !c.isDemo ? { kind: 'JOIN_GROUP', slug: c.slug, label: 'Join group' } : null,
      },
      `${c.name} ${c.subject ?? ''} ${c.topic ?? ''} ${c.course ?? ''} ${c.tags} ${c.summary ?? ''}`,
    );
  }
  for (const t of tournaments) add({ type: 'Tournament', id: t.id, title: t.title, subtitle: [t.game?.name, t.startsAt?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Dar_es_Salaam' })].filter(Boolean).join(' · '), link: `/experiences/gaming/${t.slug}`, image: t.coverImage, action: null }, `${t.title} ${t.game?.name ?? ''} ${t.summary ?? ''}`);
  for (const s of sessions) add({ type: 'Gaming session', id: s.id, title: s.title, subtitle: `${s.game} · ${s.platform}`, link: `/experiences/gaming/sessions/${s.slug}`, image: null, action: null }, `${s.title} ${s.game}`);
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _score, ...result }) => result);
}

const SYSTEM = (categories: string[]) =>
  [
    'You are Nia, the discovery and help assistant of Enhakkore Travel & Impact, a travel, experiences and community platform based in Tanzania. You speak as a warm, clear woman; you are not human — you are an AI assistant.',
    'You help members find places, experiences, trips, events, communities, study groups and gaming on Enhakkore, and you explain where things are in their account.',
    `You can search these areas: ${categories.map((key) => NIA_CATEGORIES[key] ?? key).join('; ')}.`,
    'Rules:',
    '- Recommend only records returned by the search_enhakkore tool. Never invent a listing, event, price, date, availability, rating or contact detail. If nothing matches, say so and suggest a different search or where to look.',
    '- Availability, prices and bookings are confirmed by Enhakkore or the business, not by you. Never say something is booked, confirmed or paid.',
    '- You cannot take actions yourself. Cards under your reply may offer a button (save to wishlist, join a public group); the member decides.',
    '- You cannot see other members’ private information, messages or locations, and you never ask for passwords or payment details.',
    '- Use the account_guide tool for "where do I find…" questions.',
    '- Keep replies short: two to four sentences, or a short list. Do not repeat every card — the member sees them.',
  ].join('\n');

/**
 * Asks Nia. Without an Anthropic key she still searches and answers in a fixed,
 * honest form; with one, Claude writes the reply from the same real results.
 */
export async function askNia(message: string, history: { role: string; content: string }[], settings: NiaSettings) {
  const guide = guideFor(message);
  if (!niaAiConnected()) {
    const results = await searchPlatform(message, settings.categories);
    const parts: string[] = [];
    if (guide.length) parts.push(guide.map((entry) => `${entry.title}: ${entry.help}`).join(' '));
    parts.push(results.length ? `Here is what I found on Enhakkore for “${message.slice(0, 60)}”.` : `I could not find anything on Enhakkore matching “${message.slice(0, 60)}”. Try other words, or browse Explore and Experiences.`);
    parts.push('(My conversation features are not connected yet, so I can only search for now.)');
    return { reply: parts.join(' '), results, guide, ai: false };
  }

  const client = new Anthropic();
  const model = process.env.NIA_MODEL?.trim() || process.env.ASSISTANT_MODEL?.trim() || 'claude-opus-5-5';
  const withFallback = /^claude-(opus-5-5|opus-5|fable-5|sonnet-5-5)/.test(model);
  const tools: Anthropic.Beta.BetaTool[] = [
    {
      name: 'search_enhakkore',
      description: 'Searches published Enhakkore records (places, experiences, trips, events, activities, communities, study groups, tournaments, gaming sessions). Returns real records only. Use specific words; call again with different words if the first search finds nothing.',
      input_schema: { type: 'object', properties: { query: { type: 'string', description: 'What to look for, in plain words.' }, areas: { type: 'array', items: { type: 'string', enum: settings.categories }, description: 'Optional: limit to these areas.' } }, required: ['query'] },
    },
    {
      name: 'account_guide',
      description: 'Where a feature is in the member’s account (trips, payments, reservations, passes, messages, study groups, gaming hub, notifications, profile, settings).',
      input_schema: { type: 'object', properties: { topic: { type: 'string' } }, required: ['topic'] },
    },
  ];
  const messages: Anthropic.Beta.BetaMessageParam[] = history.slice(-8).map((turn) => ({ role: turn.role === 'USER' ? 'user' : 'assistant', content: turn.content }));
  messages.push({ role: 'user', content: message });
  const found = new Map<string, NiaResult>();
  const guides = new Map(guide.map((entry) => [entry.link, entry]));
  let reply = '';
  for (let step = 0; step < 5; step++) {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 4000,
      system: SYSTEM(settings.categories),
      tools,
      messages,
      output_config: { effort: 'low' },
      ...(withFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    });
    if (response.stop_reason === 'refusal') {
      reply = 'I can’t help with that, but I’m happy to help you find things on Enhakkore.';
      break;
    }
    const text = response.content.filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text').map((block) => block.text).join('\n').trim();
    if (text) reply = text;
    if (response.stop_reason !== 'tool_use') break;
    messages.push({ role: 'assistant', content: response.content });
    const toolResults: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      const input = (block.input ?? {}) as { query?: string; areas?: string[]; topic?: string };
      if (block.name === 'search_enhakkore') {
        const areas = Array.isArray(input.areas) && input.areas.length ? input.areas.filter((area) => settings.categories.includes(area)) : settings.categories;
        const results = await searchPlatform(String(input.query ?? message), areas);
        for (const result of results) found.set(`${result.type}:${result.id}`, result);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(results.map((r) => ({ type: r.type, title: r.title, details: r.subtitle, link: r.link }))) || '[]' });
      } else if (block.name === 'account_guide') {
        const entries = guideFor(String(input.topic ?? message));
        for (const entry of entries) guides.set(entry.link, entry);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(entries.length ? entries.map((e) => ({ title: e.title, link: e.link, help: e.help })) : ACCOUNT_GUIDE.map((e) => ({ title: e.title, link: e.link }))) });
      } else {
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'Unknown tool.', is_error: true });
      }
    }
    messages.push({ role: 'user', content: toolResults });
  }
  return { reply: reply || 'Here is what I found.', results: [...found.values()].slice(0, 8), guide: [...guides.values()].slice(0, 3), ai: true };
}
