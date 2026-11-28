import Anthropic from '@anthropic-ai/sdk';
import type { Request } from 'express';
import { z } from 'zod';
import { hasPermission, resourceByKey, slugify } from '@enhakkore/shared';
import { prisma } from '../lib/prisma';
import { audit } from './audit';
import { notifyMany } from './notifications';
import { popularityScores } from './popularity';

/**
 * The control centre's assistant: one interface, two modes.
 *
 * - Bethany (working mode, "Hey Bethany") can read and change content through
 *   the tools below. Every tool re-checks the signed-in person's permissions on
 *   the server and writes to the audit log. Sensitive actions are not run
 *   straight away: they are held until the person confirms them.
 * - Ariel (reporting mode, "Hello Ariel") gets only the read-only tools, so she
 *   cannot change anything — that is enforced here, not by the prompt.
 *
 * Payment verification, refunds, deleting records and staff permissions are
 * deliberately not available to the assistant: those stay with people.
 */

export type Mode = 'BETHANY' | 'ARIEL';

export function assistantConfigured(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
export const ASSISTANT_MODEL = () => process.env.ASSISTANT_MODEL || 'claude-opus-5-5';

/** The person the assistant acts for. Every tool runs with their permissions. */
interface Actor {
  req: Request;
  permissions: string[];
}

interface ToolDef {
  name: string;
  description: string;
  input_schema: Anthropic.Tool['input_schema'];
  /** Read-only tools are available to Ariel too. */
  readOnly: boolean;
  /** Held for the person's confirmation before it runs. */
  sensitive?: boolean;
  /** Permission needed (checked before running). */
  permission?: (input: Record<string, unknown>) => string;
  /** A one-line description of what will happen, shown when confirmation is needed. */
  summarise?: (input: Record<string, unknown>) => string;
  run: (input: Record<string, unknown>, actor: Actor) => Promise<unknown>;
}

const LISTING_KINDS = ['places', 'activities', 'events', 'communities', 'trips', 'experiences', 'tournaments'] as const;
const KIND_MODULE: Record<string, string> = { places: 'places', activities: 'activities', events: 'events', communities: 'communities', trips: 'trips', experiences: 'experiences', tournaments: 'gaming' };
const days = (n: number) => new Date(Date.now() - n * 86400000);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const model = (name: string) => (prisma as any)[name];

const obj = (properties: Record<string, unknown>, required: string[] = []): Anthropic.Tool['input_schema'] => ({ type: 'object', properties, required, additionalProperties: false });

const TOOLS: ToolDef[] = [
  /* ------------------------------- Read-only ------------------------------- */
  {
    name: 'platform_overview',
    description: 'Current numbers for the whole platform: members, new sign-ups, open requests by type, receipts waiting for verification, trip bookings by status, upcoming departures with seats left, communities and study groups, open reports, and failed notifications. Use for "how are we doing" or a daily report.',
    input_schema: obj({}),
    readOnly: true,
    run: async () => {
      const [members, newMembers, enquiries, receipts, bookings, departures, communities, studyGroups, reports, failed, notConfigured, organiserApps, submissions] = await Promise.all([
        prisma.user.count({ where: { role: { in: ['TRAVELER', 'ORGANIZER'] }, isDemo: false } }),
        prisma.user.count({ where: { role: { in: ['TRAVELER', 'ORGANIZER'] }, isDemo: false, createdAt: { gte: days(7) } } }),
        prisma.enquiry.groupBy({ by: ['type', 'status'], _count: { _all: true }, where: { status: { notIn: ['CLOSED', 'SPAM', 'CANCELLED', 'DECLINED', 'UNSUCCESSFUL', 'CONVERTED', 'CONFIRMED', 'PUBLISHED'] } } }),
        prisma.paymentReceipt.count({ where: { status: { in: ['SUBMITTED', 'UNDER_VERIFICATION'] } } }),
        prisma.booking.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.tripDate.findMany({ where: { startDate: { gte: new Date() } }, include: { trip: { select: { title: true, stage: true } } }, orderBy: { startDate: 'asc' }, take: 10 }),
        prisma.community.count({ where: { status: 'PUBLISHED', kind: 'COMMUNITY' } }),
        prisma.community.count({ where: { status: 'PUBLISHED', kind: 'STUDY_GROUP' } }),
        prisma.report.count({ where: { status: 'OPEN' } }),
        prisma.notificationDelivery.count({ where: { status: 'FAILED', createdAt: { gte: days(7) } } }),
        prisma.notificationDelivery.count({ where: { status: 'NOT_CONFIGURED', createdAt: { gte: days(7) } } }),
        prisma.organiserApplication.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
        prisma.activity.count({ where: { status: 'PENDING_REVIEW' } }),
      ]);
      return {
        members,
        newMembersLast7Days: newMembers,
        openRequests: enquiries.map((row) => ({ type: row.type, status: row.status, count: row._count._all })),
        receiptsAwaitingVerification: receipts,
        tripBookingsByStatus: Object.fromEntries(bookings.map((row) => [row.status, row._count._all])),
        upcomingDepartures: departures.map((row) => ({ trip: row.trip.title, stage: row.trip.stage, startDate: row.startDate.toISOString().slice(0, 10), seatsBooked: row.seatsBooked, capacity: row.capacity })),
        communities,
        studyGroups,
        openReports: reports,
        organiserApplicationsWaiting: organiserApps,
        activitySubmissionsWaiting: submissions,
        whatsappNoticesFailedLast7Days: failed,
        whatsappNoticesNotConfiguredLast7Days: notConfigured,
      };
    },
  },
  {
    name: 'pending_work',
    description: 'Items waiting for the team, oldest first: new hotel/restaurant/venue/trip requests, payment receipts to verify, organiser applications, activity submissions and reported content. Returns references and links into the control centre.',
    input_schema: obj({ limit: { type: 'integer', minimum: 1, maximum: 30, description: 'How many of each kind (default 10).' } }),
    readOnly: true,
    run: async (input) => {
      const take = Math.min(30, Number(input.limit) || 10);
      const [enquiries, receipts, applications, submissions, reports] = await Promise.all([
        prisma.enquiry.findMany({ where: { status: { in: ['NEW', 'IN_PROGRESS', 'CONTACTED', 'AWAITING_BUSINESS'] } }, orderBy: { createdAt: 'asc' }, take }),
        prisma.paymentReceipt.findMany({ where: { status: { in: ['SUBMITTED', 'UNDER_VERIFICATION'] } }, include: { booking: { select: { reference: true, trip: { select: { title: true } } } } }, orderBy: { createdAt: 'asc' }, take }),
        prisma.organiserApplication.findMany({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'MORE_INFO'] } }, orderBy: { createdAt: 'asc' }, take }),
        prisma.activity.findMany({ where: { status: 'PENDING_REVIEW' }, orderBy: { createdAt: 'asc' }, take, select: { id: true, title: true, reviewLevel: true, createdAt: true } }),
        prisma.report.findMany({ where: { status: 'OPEN' }, orderBy: { createdAt: 'asc' }, take, select: { id: true, targetType: true, targetId: true, reason: true, createdAt: true } }),
      ]);
      return {
        requests: enquiries.map((row) => ({ reference: row.reference, type: row.type, status: row.status, about: row.subjectTitle, date: row.startDate?.toISOString().slice(0, 10) ?? null, people: row.people, received: row.createdAt.toISOString(), link: `/admin/enquiries?ref=${row.reference}` })),
        receipts: receipts.map((row) => ({ reference: row.reference, booking: row.booking.reference, trip: row.booking.trip.title, amount: row.amount, currency: row.currency, status: row.status, link: '/admin/payments' })),
        organiserApplications: applications.map((row) => ({ name: row.legalName, status: row.status, received: row.createdAt.toISOString(), link: '/admin/organisers' })),
        activitySubmissions: submissions.map((row) => ({ id: row.id, title: row.title, review: row.reviewLevel, link: `/admin/r/activities/${row.id}` })),
        reports: reports.map((row) => ({ id: row.id, target: `${row.targetType} ${row.targetId}`, reason: row.reason, link: '/admin/moderation' })),
      };
    },
  },
  {
    name: 'find_listings',
    description: 'Search listings by name: places (hotels, restaurants, venues, attractions), activities, events, communities (including study groups), trips, guided experiences and tournaments. Returns id, title, status and city. Use before changing a listing, to get its id.',
    input_schema: obj({ kind: { type: 'string', enum: [...LISTING_KINDS] }, query: { type: 'string', description: 'Part of the name.' } }, ['kind', 'query']),
    readOnly: true,
    run: async (input) => {
      const kind = String(input.kind);
      const def = resourceByKey(kind);
      if (!def) throw new Error('Unknown kind.');
      const titleField = def.titleField;
      const rows = await model(def.model).findMany({
        where: { [titleField]: { contains: String(input.query), mode: process.env.DATABASE_URL?.startsWith('postgres') ? 'insensitive' : undefined } },
        take: 15,
        include: def.model === 'trip' ? undefined : { city: { select: { name: true } } },
      });
      return rows.map((row: Record<string, unknown>) => ({ id: row.id, title: row[titleField], slug: row.slug, status: def.statusField ? row[def.statusField] : null, city: (row.city as { name?: string } | null)?.name ?? null, isDemo: row.isDemo ?? false }));
    },
  },
  {
    name: 'popular_listings',
    description: 'The most viewed, saved and joined listings of one kind over the last 30 days (real member engagement only).',
    input_schema: obj({ kind: { type: 'string', enum: ['places', 'activities', 'events', 'trips'] } }, ['kind']),
    readOnly: true,
    run: async (input) => {
      const subject = { places: 'PLACE', activities: 'ACTIVITY', events: 'EVENT', trips: 'TRIP' }[String(input.kind)]!;
      const scores = await popularityScores(subject);
      const top = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      const def = resourceByKey(String(input.kind))!;
      const rows = await model(def.model).findMany({ where: { id: { in: top.map(([id]) => id) } } });
      return top.map(([id, score]) => ({ title: rows.find((row: { id: string }) => row.id === id)?.[def.titleField] ?? id, score: Math.round(score * 10) / 10 }));
    },
  },
  {
    name: 'recent_changes',
    description: 'The latest entries in the audit log: who changed what, and when. Use to explain recent website updates.',
    input_schema: obj({ limit: { type: 'integer', minimum: 1, maximum: 50 } }),
    readOnly: true,
    run: async (input) => {
      const rows = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: Math.min(50, Number(input.limit) || 20) });
      return rows.map((row) => ({ when: row.createdAt.toISOString(), who: (row.actorName ?? 'System').replace(/\s*\(.*\)$/, ''), action: row.action, what: row.entityType, summary: row.summary }));
    },
  },
  {
    name: 'delivery_problems',
    description: 'Technical problems the platform recorded: failed or not-configured WhatsApp/email notices in the last 7 days, with their error text.',
    input_schema: obj({}),
    readOnly: true,
    run: async () => {
      const rows = await prisma.notificationDelivery.findMany({ where: { status: { in: ['FAILED', 'NOT_CONFIGURED'] }, createdAt: { gte: days(7) } }, orderBy: { createdAt: 'desc' }, take: 30 });
      return rows.map((row) => ({ when: row.createdAt.toISOString(), channel: row.channel, status: row.status, summary: row.summary, error: row.error }));
    },
  },

  /* ------------------------------- Working --------------------------------- */
  {
    name: 'create_draft_place',
    description: 'Create a new Explore listing as a DRAFT (never published by this tool). Use for "add a hotel in Arusha". Only put in details the person gave you; anything unknown stays empty and is marked not yet verified. Tell the person to review it, add photos and verified details, then publish.',
    input_schema: obj(
      {
        name: { type: 'string' },
        section: { type: 'string', enum: ['STAYS', 'FOOD', 'VENUES', 'ATTRACTIONS'] },
        city: { type: 'string', description: 'City name, e.g. Arusha.' },
        countryCode: { type: 'string', description: 'ISO code, default TZ.' },
        summary: { type: 'string' },
        description: { type: 'string' },
      },
      ['name', 'section', 'city'],
    ),
    readOnly: false,
    permission: () => 'places.create',
    run: async (input, actor) => {
      const data = z.object({ name: z.string().min(2).max(160), section: z.enum(['STAYS', 'FOOD', 'VENUES', 'ATTRACTIONS']), city: z.string().min(2).max(80), countryCode: z.string().length(2).default('TZ'), summary: z.string().max(400).optional(), description: z.string().max(6000).optional() }).parse(input);
      const country = await prisma.country.findUnique({ where: { code: data.countryCode.toUpperCase() } });
      const city = country ? await prisma.city.findUnique({ where: { countryId_slug: { countryId: country.id, slug: slugify(data.city) } } }) : null;
      const category = await prisma.category.findFirst({ where: { kind: 'PLACE', section: data.section }, orderBy: { sortOrder: 'asc' } });
      let slug = slugify(data.name);
      if (await prisma.place.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      const place = await prisma.place.create({
        data: {
          slug,
          name: data.name,
          summary: data.summary ?? null,
          description: data.description ?? `${data.name} — details to be added and verified by the team.`,
          categoryId: category?.id ?? null,
          countryId: country?.id ?? null,
          cityId: city?.id ?? null,
          status: 'DRAFT',
          infoSource: 'UNVERIFIED',
          bookingMode: 'ENQUIRY',
          enquiryKind: data.section === 'STAYS' ? 'ROOM' : data.section === 'FOOD' ? 'TABLE' : data.section === 'VENUES' ? 'VENUE' : 'PLACE',
        },
      });
      await audit(actor.req, { action: 'create', entityType: 'places', entityId: place.id, summary: `Assistant created draft place ${place.name}` });
      return { id: place.id, status: 'DRAFT', city: city?.name ?? `${data.city} (not in the city list yet — set it in the form)`, editLink: `/admin/r/places/${place.id}` };
    },
  },
  {
    name: 'create_draft_activity',
    description: 'Create a new activity as a DRAFT, e.g. "a new Saturday activity". Never published by this tool; use set_visibility afterwards if the person asks to publish.',
    input_schema: obj(
      {
        title: { type: 'string' },
        description: { type: 'string' },
        startsAt: { type: 'string', description: 'ISO date-time in UTC, if known.' },
        meetingPoint: { type: 'string' },
        communitySlug: { type: 'string', description: 'Attach to this community, if any.' },
      },
      ['title', 'description'],
    ),
    readOnly: false,
    permission: () => 'activities.create',
    run: async (input, actor) => {
      const data = z.object({ title: z.string().min(3).max(160), description: z.string().min(10).max(6000), startsAt: z.string().datetime().optional(), meetingPoint: z.string().max(200).optional(), communitySlug: z.string().max(120).optional() }).parse(input);
      const community = data.communitySlug ? await prisma.community.findUnique({ where: { slug: data.communitySlug } }) : null;
      let slug = slugify(data.title);
      if (await prisma.activity.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      const activity = await prisma.activity.create({
        data: { slug, title: data.title, description: data.description, startsAt: data.startsAt ? new Date(data.startsAt) : null, meetingPoint: data.meetingPoint ?? null, organiserName: 'Enhakkore', source: 'ADMIN', status: 'DRAFT', communityId: community?.id ?? null, createdById: actor.req.auth!.id },
      });
      await audit(actor.req, { action: 'create', entityType: 'activities', entityId: activity.id, summary: `Assistant created draft activity ${activity.title}` });
      return { id: activity.id, status: 'DRAFT', editLink: `/admin/r/activities/${activity.id}` };
    },
  },
  {
    name: 'update_listing_text',
    description: 'Change the title, summary or description of an existing listing (find its id first with find_listings). Prices, dates, contact details and payment details cannot be changed with this tool.',
    input_schema: obj(
      { kind: { type: 'string', enum: [...LISTING_KINDS] }, id: { type: 'string' }, title: { type: 'string' }, summary: { type: 'string' }, description: { type: 'string' } },
      ['kind', 'id'],
    ),
    readOnly: false,
    permission: (input) => `${KIND_MODULE[String(input.kind)]}.edit`,
    run: async (input, actor) => {
      const def = resourceByKey(String(input.kind));
      if (!def) throw new Error('Unknown kind.');
      const data = z.object({ title: z.string().min(2).max(200).optional(), summary: z.string().max(600).optional(), description: z.string().max(10000).optional() }).parse({ title: input.title, summary: input.summary, description: input.description });
      const before = await model(def.model).findUnique({ where: { id: String(input.id) } });
      if (!before) throw new Error('Listing not found.');
      const patch: Record<string, unknown> = {};
      if (data.title) patch[def.titleField] = data.title;
      if (data.summary !== undefined && 'summary' in before) patch.summary = data.summary;
      if (data.description !== undefined && 'description' in before) patch.description = data.description;
      if (!Object.keys(patch).length) throw new Error('Nothing to change.');
      await model(def.model).update({ where: { id: before.id }, data: patch });
      await audit(actor.req, { action: 'update', entityType: def.key, entityId: before.id, summary: `Assistant updated text of ${before[def.titleField]}`, before: Object.fromEntries(Object.keys(patch).map((key) => [key, before[key]])), after: patch });
      return { updated: Object.keys(patch) };
    },
  },
  {
    name: 'set_visibility',
    description: 'Publish, unpublish (hide) or archive a listing. Hiding and archiving need the person’s confirmation.',
    input_schema: obj({ kind: { type: 'string', enum: [...LISTING_KINDS] }, id: { type: 'string' }, action: { type: 'string', enum: ['publish', 'unpublish', 'archive'] } }, ['kind', 'id', 'action']),
    readOnly: false,
    sensitive: true,
    permission: (input) => `${KIND_MODULE[String(input.kind)]}.publish`,
    summarise: (input) => `${String(input.action)} ${String(input.kind).replace(/s$/, '')} ${String(input.id)}`,
    run: async (input, actor) => {
      const def = resourceByKey(String(input.kind));
      if (!def?.statusField) throw new Error('This kind has no status.');
      const action = String(input.action);
      const status = action === 'publish' ? def.publishStatus : action === 'unpublish' ? def.unpublishStatus : def.archiveStatus;
      if (!status) throw new Error(`This kind cannot be ${action}ed.`);
      const before = await model(def.model).findUnique({ where: { id: String(input.id) } });
      if (!before) throw new Error('Listing not found.');
      await model(def.model).update({ where: { id: before.id }, data: { [def.statusField]: status, ...(action === 'publish' && 'publishedAt' in before && !before.publishedAt ? { publishedAt: new Date() } : {}) } });
      await audit(actor.req, { action: 'status', entityType: def.key, entityId: before.id, summary: `Assistant: ${action} ${before[def.titleField]}`, before: { status: before[def.statusField] }, after: { status } });
      return { title: before[def.titleField], status };
    },
  },
  {
    name: 'post_community_announcement',
    description: 'Post an announcement to a community or study group; every member is notified. Needs confirmation.',
    input_schema: obj({ communitySlug: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' } }, ['communitySlug', 'title', 'body']),
    readOnly: false,
    sensitive: true,
    permission: () => 'communities.edit',
    summarise: (input) => `Announce “${String(input.title)}” to every member of ${String(input.communitySlug)}`,
    run: async (input, actor) => {
      const data = z.object({ communitySlug: z.string(), title: z.string().min(3).max(160), body: z.string().min(3).max(4000) }).parse(input);
      const community = await prisma.community.findUnique({ where: { slug: data.communitySlug } });
      if (!community) throw new Error('Community not found.');
      await prisma.communityAnnouncement.create({ data: { communityId: community.id, authorId: actor.req.auth!.id, title: data.title, body: data.body } });
      const members = await prisma.communityMember.findMany({ where: { communityId: community.id, status: 'ACTIVE' }, select: { userId: true } });
      await notifyMany(members.map((row) => row.userId), { type: 'COMMUNITY_ANNOUNCEMENT', title: `${community.name}: ${data.title}`, body: data.body.slice(0, 160), link: `/experiences/communities/${community.slug}` });
      await audit(actor.req, { action: 'create', entityType: 'communities', entityId: community.id, summary: `Assistant announcement in ${community.name}: ${data.title}` });
      return { notified: members.length };
    },
  },
  {
    name: 'close_group_chat',
    description: 'Switch off the group chat of an activity, event or community (history stays readable). Needs confirmation.',
    input_schema: obj({ kind: { type: 'string', enum: ['activities', 'events', 'communities'] }, id: { type: 'string' } }, ['kind', 'id']),
    readOnly: false,
    sensitive: true,
    permission: (input) => `${KIND_MODULE[String(input.kind)]}.edit`,
    summarise: (input) => `Switch off the group chat of ${String(input.kind).replace(/s$/, '')} ${String(input.id)}`,
    run: async (input, actor) => {
      const def = resourceByKey(String(input.kind))!;
      const row = await model(def.model).findUnique({ where: { id: String(input.id) } });
      if (!row) throw new Error('Not found.');
      await model(def.model).update({ where: { id: row.id }, data: { chatEnabled: false } });
      await audit(actor.req, { action: 'update', entityType: def.key, entityId: row.id, summary: `Assistant switched off the group chat of ${row[def.titleField]}` });
      return { title: row[def.titleField], chat: 'off' };
    },
  },
  {
    name: 'remove_reported_message',
    description: 'Remove a chat message that was reported (give the report id from pending_work) and close the report. Needs confirmation.',
    input_schema: obj({ reportId: { type: 'string' } }, ['reportId']),
    readOnly: false,
    sensitive: true,
    permission: () => 'reviews.edit',
    summarise: (input) => `Remove the reported message in report ${String(input.reportId)}`,
    run: async (input, actor) => {
      const report = await prisma.report.findUnique({ where: { id: String(input.reportId) } });
      if (!report || report.targetType !== 'MESSAGE') throw new Error('No reported message with that id.');
      const message = await prisma.message.findUnique({ where: { id: report.targetId } });
      if (message) await prisma.message.delete({ where: { id: message.id } });
      await prisma.report.update({ where: { id: report.id }, data: { status: 'RESOLVED' } });
      await audit(actor.req, { action: 'delete', entityType: 'messages', entityId: report.targetId, summary: 'Assistant removed a reported message', before: message ? { body: message.body, userId: message.userId } : undefined });
      return { removed: !!message };
    },
  },
  {
    name: 'set_homepage_section',
    description: 'Show or hide a homepage section, or change its title. Keys: explore, experiences, happening, trips, destinations, purpose, review, impact, join, partner. Needs confirmation.',
    input_schema: obj({ key: { type: 'string' }, enabled: { type: 'boolean' }, title: { type: 'string' } }, ['key']),
    readOnly: false,
    sensitive: true,
    permission: () => 'homepage.edit',
    summarise: (input) => `Homepage section “${String(input.key)}”: ${input.enabled === false ? 'hide' : input.enabled === true ? 'show' : ''}${input.title ? ` title “${String(input.title)}”` : ''}`,
    run: async (input, actor) => {
      const row = await prisma.platformSetting.findUnique({ where: { key: 'site.homepage' } });
      const value = row ? (JSON.parse(row.value) as { sections?: { key: string; enabled?: boolean; title?: string }[] }) : {};
      const sections = value.sections ?? [];
      const section = sections.find((item) => item.key === String(input.key));
      if (!section) throw new Error('That section is not in the saved homepage settings. Open Homepage editor and save once, then try again.');
      const before = { ...section };
      if (typeof input.enabled === 'boolean') section.enabled = input.enabled;
      if (typeof input.title === 'string' && input.title.trim()) section.title = input.title.trim().slice(0, 120);
      await prisma.platformSetting.update({ where: { key: 'site.homepage' }, data: { value: JSON.stringify(value) } });
      await audit(actor.req, { action: 'update', entityType: 'settings', entityId: 'site.homepage', summary: `Assistant changed homepage section ${section.key}`, before, after: section });
      return { section };
    },
  },
];

export function toolsFor(mode: Mode) {
  return TOOLS.filter((tool) => mode === 'BETHANY' || tool.readOnly);
}

/** Runs one tool after checking mode and permission. Sensitive tools return a pending marker unless confirmed. */
export async function runTool(mode: Mode, name: string, input: Record<string, unknown>, actor: Actor, confirmed = false): Promise<{ ok: boolean; result?: unknown; error?: string; pending?: { tool: string; input: Record<string, unknown>; summary: string } }> {
  const tool = TOOLS.find((item) => item.name === name);
  if (!tool) return { ok: false, error: `Unknown tool ${name}.` };
  if (mode === 'ARIEL' && !tool.readOnly) return { ok: false, error: 'Ariel is in reporting mode and cannot change anything. Ask Bethany.' };
  const permission = tool.permission?.(input);
  if (permission && !hasPermission(actor.permissions, permission)) return { ok: false, error: `Your role does not have the permission ${permission}.` };
  if (tool.sensitive && !confirmed) return { ok: true, pending: { tool: name, input, summary: tool.summarise?.(input) ?? name } };
  try {
    return { ok: true, result: await tool.run(input, actor) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'The action failed.' };
  }
}

const SYSTEM = (mode: Mode, name: string) =>
  [
    mode === 'BETHANY'
      ? `You are Bethany, the working assistant inside the Enhakkore Travel & Impact control centre (Tanzania). You help the owner, ${name}, run the website: listings, activities, communities, homepage sections, moderation and reports. Act through your tools; they run with ${name}'s own permissions.`
      : `You are Ariel, the reporting assistant inside the Enhakkore Travel & Impact control centre (Tanzania). You report and explain: platform activity, what is waiting, popular listings, recent changes and technical problems. You are read-only — you cannot change anything; if asked to, say Bethany can do it in working mode.`,
    'Rules:',
    '- Only state facts that come from tool results. Never invent numbers, bookings, payments, reviews, prices or business details.',
    '- Report an action as done only if its tool returned ok. If a tool returns an error, say what failed and why.',
    '- Some actions need the owner to confirm. When a tool result says it is waiting for confirmation, tell them exactly what will happen and that they confirm with the button below your reply. Do not say it is done.',
    '- New listings are drafts. Tell the owner what is still missing (photos, verified contact details, prices) before it can be published.',
    '- You cannot verify payments, refund, delete records, change staff permissions or send WhatsApp messages. If asked, explain where in the control centre a person does it.',
    '- Reply in short plain sentences or a short list. Include control-centre links from tool results when useful.',
  ].join('\n');

const MAX_STEPS = 8;

/**
 * One request to the assistant: a short tool loop on the Messages API.
 * Returns the reply, the actions taken, and a pending action if one needs confirmation.
 */
export async function ask(mode: Mode, prompt: string, history: { prompt: string; reply: string }[], actor: Actor) {
  const client = new Anthropic();
  const modelId = ASSISTANT_MODEL();
  const tools = toolsFor(mode).map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.input_schema }));
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const turn of history.slice(-6)) {
    messages.push({ role: 'user', content: turn.prompt });
    if (turn.reply) messages.push({ role: 'assistant', content: turn.reply });
  }
  messages.push({ role: 'user', content: prompt });
  const actions: { tool: string; input: unknown; ok: boolean; result?: unknown; error?: string }[] = [];
  let pending: { tool: string; input: Record<string, unknown>; summary: string } | null = null;
  let reply = '';
  const withFallback = /^claude-(opus-5-5|opus-5|fable-5|sonnet-5-5)/.test(modelId);

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const response = await client.beta.messages.create({
      model: modelId,
      max_tokens: 16000,
      system: SYSTEM(mode, actor.req.auth!.name.split(' ')[0] ?? 'the owner'),
      tools,
      messages,
      output_config: { effort: (process.env.ASSISTANT_EFFORT as 'low' | 'medium' | 'high' | undefined) ?? 'medium' },
      ...(withFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    });
    if (response.stop_reason === 'refusal') {
      reply = 'I can’t help with that request.';
      break;
    }
    const text = response.content.filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text').map((block) => block.text).join('\n').trim();
    if (text) reply = text;
    if (response.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: response.content });
      continue;
    }
    if (response.stop_reason !== 'tool_use') break;
    messages.push({ role: 'assistant', content: response.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      const input = (block.input ?? {}) as Record<string, unknown>;
      const outcome: Awaited<ReturnType<typeof runTool>> = pending ? { ok: false, error: 'Another action is already waiting for confirmation.' } : await runTool(mode, block.name, input, actor);
      if ('pending' in outcome && outcome.pending) {
        pending = outcome.pending;
        actions.push({ tool: block.name, input, ok: true, result: 'waiting for confirmation' });
        results.push({ type: 'tool_result', tool_use_id: block.id, content: `Not run yet: waiting for the owner to confirm (“${outcome.pending.summary}”).` });
      } else {
        actions.push({ tool: block.name, input, ok: outcome.ok, result: outcome.result, error: outcome.error });
        results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(outcome.ok ? outcome.result : { error: outcome.error }).slice(0, 20000), is_error: !outcome.ok });
      }
    }
    messages.push({ role: 'user', content: results });
  }
  return { reply: reply || 'Done.', actions, pending };
}
