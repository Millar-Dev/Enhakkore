import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import {
  BRACKET_FORMATS,
  GAME_INVITE_DEFAULT_MINUTES,
  NEARBY_RADIUS_KM,
  ORGANISER_TYPES,
  TOURNAMENT_CATEGORIES,
  slugify,
} from '@enhakkore/shared';
import { env } from '../env';
import { randomToken, sha256 } from '../lib/crypto';
import { ApiError, route } from '../lib/http';
import { shortCode } from '../lib/ids';
import { prisma } from '../lib/prisma';
import { textContains } from '../lib/search';
import { requireAuth, type AuthUser } from '../middleware/auth';
import { recordActivity } from '../services/activity';
import { assetBelongsTo } from '../services/storage';
import { generateFixtures, recordResult, standings } from '../services/brackets';
import { notify, notifyMany, notifyStaff } from '../services/notifications';
import { LOCATION_FRESH_MS, blockedSet, distanceKm, friendIds, isAdult } from '../services/social';

/**
 * Gaming Hub (Phase 1G).
 *
 * Tournaments: any eligible member creates one and it is published at once —
 * no routine approval. The team sees it straight away in the control centre
 * with the organiser's contact details and can check, restrict, hide or
 * suspend it. Entry is free at launch; no entry fees are collected.
 *
 * Verified badges: an esports listing shows "Verified organiser" only when the
 * organiser's esports application was verified by the team. Prize claims are
 * shown as stated by the organiser, never as verified.
 *
 * Nearby invitations: adults who opted in, within 2 km of the requester's
 * approximate position (server-side, rounded positions). Nobody sees anyone's
 * coordinates; the requester never sees who ignored or declined.
 */
export const gamingMember = Router();
export const gamingPublic = Router();

const createLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: env.isProduction ? 10 : 10_000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'You have created a lot today. Try again tomorrow.' } },
});
const inviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: env.isProduction ? 12 : 10_000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'You have sent several invitations. Try again a little later.' } },
});

const isGamingStaff = (auth: AuthUser | undefined) => !!auth && (auth.permissions.includes('*') || auth.permissions.includes('gaming.edit') || auth.permissions.includes('gaming.*'));
const PUBLIC_STATUSES = ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const playerName = (user: { name: string; username: string | null }) => (user.username ? `@${user.username}` : user.name.split(' ')[0]!);

/* -------------------------------- Tournaments -------------------------------- */

const tournamentSchema = z.object({
  title: z.string().trim().min(4, 'Give the tournament a name.').max(120),
  category: z.enum(TOURNAMENT_CATEGORIES.map((item) => item.key) as [string, ...string[]]),
  organiserType: z.enum(ORGANISER_TYPES.map((item) => item.key) as [string, ...string[]]),
  organiserName: z.string().trim().min(2, 'Who is organising it (your name, guild, squad or organisation).').max(120),
  contactName: z.string().trim().min(2, 'Your full name.').max(120),
  contactPhone: z.string().trim().min(7, 'A phone number the Enhakkore team can reach you on.').max(40),
  contactEmail: z.string().trim().email().max(160).optional().or(z.literal('')),
  gameId: z.string().min(5, 'Choose the game.'),
  platform: z.string().trim().min(2, 'Choose the platform.').max(60),
  bracketFormat: z.enum(BRACKET_FORMATS.map((item) => item.key) as [string, ...string[]]),
  format: z.enum(['SOLO', 'DUO', 'SQUAD', 'TEAM']).default('SOLO'),
  teamSize: z.number().int().min(1).max(20).default(1),
  kind: z.enum(['ONLINE', 'CONSOLE']).default('ONLINE'),
  summary: z.string().trim().max(300).optional().or(z.literal('')),
  description: z.string().trim().max(4000).optional().or(z.literal('')),
  rules: z.string().trim().min(20, 'Write the rules (at least a few lines).').max(8000),
  startsAt: z.coerce.date(),
  registrationDeadline: z.coerce.date().optional(),
  slots: z.number().int().min(2, 'At least two places.').max(1024),
  venue: z.string().trim().max(200).optional().or(z.literal('')),
  server: z.string().trim().max(80).optional().or(z.literal('')),
  region: z.string().trim().max(80).optional().or(z.literal('')),
  minAge: z.number().int().min(0).max(99).optional(),
  prizeDetails: z.string().trim().max(2000).optional().or(z.literal('')),
  disputeProcedure: z.string().trim().max(3000).optional().or(z.literal('')),
  coverImage: z.string().url().optional().or(z.literal('')),
  /** Entry fees are not available at launch. */
  entryFee: z.undefined({ invalid_type_error: 'Paid entry is not available yet — tournaments are free to enter.' }).optional(),
});

gamingMember.post(
  '/tournaments',
  requireAuth,
  createLimiter,
  route(async (req, res) => {
    const input = tournamentSchema.parse(req.body);
    if (input.startsAt.getTime() < Date.now()) throw ApiError.badRequest('Choose a start time in the future.');
    if (input.kind === 'CONSOLE' && !input.venue) throw new ApiError(422, 'Please check the highlighted fields.', 'validation_error', { venue: 'Where does it take place?' });
    const game = await prisma.category.findFirst({ where: { id: input.gameId, kind: 'GAME' } });
    if (!game) throw ApiError.badRequest('Choose a game from the list.');
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.id } });
    if (user.status !== 'ACTIVE') throw ApiError.forbidden('Your account cannot create tournaments.');
    // An esports listing links to the organiser's verification only when it is verified and current.
    const esports = input.category === 'ESPORTS'
      ? await prisma.esportsOrganiser.findFirst({ where: { userId: user.id, status: 'VERIFIED', OR: [{ verifiedUntil: null }, { verifiedUntil: { gt: new Date() } }] } })
      : null;
    let slug = slugify(input.title) || `tournament-${shortCode(4).toLowerCase()}`;
    if (await prisma.tournament.findUnique({ where: { slug } })) slug = `${slug}-${shortCode(4).toLowerCase()}`;
    const tournament = await prisma.tournament.create({
      data: {
        slug,
        title: input.title,
        category: input.category,
        organiserType: input.organiserType,
        organiserName: input.organiserName,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        contactEmail: input.contactEmail || user.email,
        createdById: user.id,
        gameId: game.id,
        platform: input.platform,
        bracketFormat: input.bracketFormat,
        format: input.format,
        teamSize: input.format === 'SOLO' ? 1 : Math.max(2, input.teamSize),
        kind: input.kind,
        summary: input.summary || null,
        description: input.description || null,
        rules: input.rules,
        startsAt: input.startsAt,
        registrationDeadline: input.registrationDeadline ?? input.startsAt,
        slots: input.slots,
        venue: input.venue || null,
        server: input.server || null,
        region: input.region || null,
        minAge: input.minAge ?? null,
        prizeDetails: input.prizeDetails || null,
        disputeProcedure: input.disputeProcedure || 'Report a problem with a match from the tournament page. The organiser reviews it first; the Enhakkore team can step in.',
        coverImage: input.coverImage || null,
        esportsOrganiserId: esports?.id ?? null,
        status: 'REGISTRATION_OPEN',
        publishedAt: new Date(),
      },
    });
    await notify({ userId: user.id, type: 'TOURNAMENT_UPDATE', title: 'Your tournament is live', body: `${tournament.title} is published. Manage entries and fixtures from Gaming Hub → My Tournaments.`, link: `/experiences/gaming/${tournament.slug}`, dedupeKey: `tournament-live:${tournament.id}` });
    await notifyStaff('gaming.view', { type: 'ANNOUNCEMENT', title: `New tournament: ${tournament.title}`, body: `${input.contactName} (${ORGANISER_TYPES.find((t) => t.key === input.organiserType)?.label}) published a ${TOURNAMENT_CATEGORIES.find((t) => t.key === input.category)?.label}. Contact: ${input.contactPhone}.`, link: `/admin/gaming?tab=tournaments&id=${tournament.id}` });
    await recordActivity({ userId: user.id, action: 'TOURNAMENT_CREATED', title: `Created ${tournament.title}`, link: `/experiences/gaming/${tournament.slug}`, subjectType: 'TOURNAMENT', subjectId: tournament.id });
    res.status(201).json({ slug: tournament.slug, id: tournament.id });
  }),
);

/** Loads a tournament the viewer organises (or gaming staff). */
async function organised(slug: string, auth: AuthUser) {
  const tournament = await prisma.tournament.findUnique({ where: { slug } });
  if (!tournament) throw ApiError.notFound('Tournament not found.');
  if (tournament.createdById !== auth.id && !isGamingStaff(auth)) throw ApiError.forbidden('Only the organiser can do that.');
  if (tournament.status === 'SUSPENDED' && !isGamingStaff(auth)) throw ApiError.forbidden('This tournament is suspended by the Enhakkore team.');
  return tournament;
}

gamingMember.patch(
  '/tournaments/:slug',
  requireAuth,
  route(async (req, res) => {
    const tournament = await organised(req.params.slug, req.auth!);
    const input = z
      .object({
        summary: z.string().trim().max(300).optional(),
        description: z.string().trim().max(4000).optional(),
        rules: z.string().trim().min(20).max(8000).optional(),
        startsAt: z.coerce.date().optional(),
        registrationDeadline: z.coerce.date().optional(),
        prizeDetails: z.string().trim().max(2000).optional(),
        slots: z.number().int().min(2).max(1024).optional(),
        status: z.enum(['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'CANCELLED']).optional(),
      })
      .parse(req.body);
    if (input.status === 'REGISTRATION_OPEN' && tournament.registrationRestricted && !isGamingStaff(req.auth)) throw ApiError.forbidden('The Enhakkore team has restricted registration for this tournament.');
    const updated = await prisma.tournament.update({ where: { id: tournament.id }, data: input });
    if (input.status === 'CANCELLED' || input.startsAt) {
      const entrants = await entrantIds(tournament.id);
      await notifyMany(entrants, { type: 'TOURNAMENT_UPDATE', title: input.status === 'CANCELLED' ? `Cancelled: ${tournament.title}` : `New time: ${tournament.title}`, body: input.status === 'CANCELLED' ? 'The organiser cancelled this tournament.' : `Now starts ${updated.startsAt?.toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam' })} (EAT).`, link: `/experiences/gaming/${tournament.slug}` });
    }
    res.json({ ok: true });
  }),
);

async function entrantIds(tournamentId: string) {
  const entries = await prisma.tournamentEntry.findMany({ where: { tournamentId, status: { in: ['REGISTERED', 'CONFIRMED'] } }, include: { members: { select: { userId: true } } } });
  return [...new Set(entries.flatMap((entry) => [entry.captainId, ...entry.members.map((member) => member.userId)]))];
}

gamingMember.post(
  '/tournaments/:slug/fixtures',
  requireAuth,
  route(async (req, res) => {
    const tournament = await organised(req.params.slug, req.auth!);
    if (['COMPLETED', 'CANCELLED'].includes(tournament.status)) throw ApiError.badRequest('This tournament has finished.');
    const started = await prisma.tournamentMatch.count({ where: { tournamentId: tournament.id, status: 'COMPLETED' } });
    if (started > 0 && req.query.confirm !== 'yes') throw new ApiError(428, 'Results have already been entered. Making the fixtures again deletes them.', 'confirmation_required');
    await generateFixtures(tournament.id);
    const entrants = await entrantIds(tournament.id);
    await notifyMany(entrants, { type: 'TOURNAMENT_UPDATE', title: `Fixtures are out · ${tournament.title}`, body: 'See your first match on the tournament page.', link: `/experiences/gaming/${tournament.slug}#fixtures` });
    res.json({ ok: true });
  }),
);

gamingMember.post(
  '/matches/:id/result',
  requireAuth,
  route(async (req, res) => {
    const input = z.object({ homeScore: z.number().int().min(0).max(999), awayScore: z.number().int().min(0).max(999) }).parse(req.body);
    const match = await prisma.tournamentMatch.findUnique({ where: { id: req.params.id }, include: { tournament: true } });
    if (!match) throw ApiError.notFound();
    await organised(match.tournament.slug, req.auth!);
    await recordResult(match.id, input.homeScore, input.awayScore, req.auth!.id);
    const after = await prisma.tournament.findUniqueOrThrow({ where: { id: match.tournamentId } });
    const players = new Set<string>();
    for (const entryId of [match.homeEntryId, match.awayEntryId]) {
      if (!entryId) continue;
      const entry = await prisma.tournamentEntry.findUnique({ where: { id: entryId }, include: { members: true } });
      if (entry) [entry.captainId, ...entry.members.map((m) => m.userId)].forEach((id) => players.add(id));
    }
    await notifyMany([...players], { type: 'TOURNAMENT_UPDATE', title: `Result recorded · ${after.title}`, body: `${input.homeScore}–${input.awayScore}`, link: `/experiences/gaming/${after.slug}#fixtures` });
    if (after.status === 'COMPLETED') {
      for (const userId of await entrantIds(after.id)) await recordActivity({ userId, action: 'TOURNAMENT_COMPLETED', title: `Completed ${after.title}`, link: `/experiences/gaming/${after.slug}`, subjectType: 'TOURNAMENT', subjectId: after.id });
    }
    res.json({ ok: true, tournamentStatus: after.status });
  }),
);

/** A player disputes a result. The organiser is told; the team can see disputes in Gaming → Disputes. */
gamingMember.post(
  '/matches/:id/dispute',
  requireAuth,
  route(async (req, res) => {
    const { reason } = z.object({ reason: z.string().trim().min(10, 'Explain what is wrong (at least a sentence).').max(2000) }).parse(req.body);
    const match = await prisma.tournamentMatch.findUnique({ where: { id: req.params.id }, include: { tournament: true } });
    if (!match) throw ApiError.notFound();
    const mine = await prisma.tournamentEntry.findFirst({
      where: { id: { in: [match.homeEntryId, match.awayEntryId].filter((id): id is string => !!id) }, OR: [{ captainId: req.auth!.id }, { members: { some: { userId: req.auth!.id } } }] },
    });
    if (!mine) throw ApiError.forbidden('Only players in this match can dispute it.');
    await prisma.tournamentMatch.update({ where: { id: match.id }, data: { disputed: true } });
    await prisma.report.create({ data: { reporterId: req.auth!.id, targetType: 'TOURNAMENT_MATCH', targetId: match.id, reason: 'Result dispute', details: `${match.tournament.title}\n${reason}` } });
    if (match.tournament.createdById) await notify({ userId: match.tournament.createdById, type: 'TOURNAMENT_UPDATE', title: `Result disputed · ${match.tournament.title}`, body: reason.slice(0, 140), link: `/experiences/gaming/${match.tournament.slug}#fixtures` });
    await notifyStaff('gaming.view', { type: 'ANNOUNCEMENT', title: `Match dispute · ${match.tournament.title}`, body: reason.slice(0, 140), link: `/admin/gaming?tab=disputes` });
    res.status(201).json({ ok: true, message: 'The organiser has been told. The Enhakkore team can step in if needed.' });
  }),
);

/** Invite friends to a tournament (notification only — they register themselves). */
gamingMember.post(
  '/tournaments/:slug/invite',
  requireAuth,
  inviteLimiter,
  route(async (req, res) => {
    const { userIds } = z.object({ userIds: z.array(z.string().min(5)).min(1).max(50) }).parse(req.body);
    const tournament = await prisma.tournament.findFirst({ where: { slug: req.params.slug, status: 'REGISTRATION_OPEN' } });
    if (!tournament) throw ApiError.notFound('That tournament is not open for registration.');
    const friends = new Set(await friendIds(req.auth!.id));
    const targets = userIds.filter((id) => friends.has(id));
    for (const userId of targets) {
      await notify({ userId, type: 'TOURNAMENT_UPDATE', title: `${req.auth!.name} invited you to a tournament`, body: tournament.title, link: `/experiences/gaming/${tournament.slug}`, dedupeKey: `tournament-invite:${tournament.id}:${req.auth!.id}` });
    }
    res.json({ invited: targets.length });
  }),
);

/** My Tournaments: registered (captain or teammate) and created. */
gamingMember.get(
  '/tournaments/mine',
  requireAuth,
  route(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const [entries, created] = await Promise.all([
      prisma.tournamentEntry.findMany({
        where: { OR: [{ captainId: req.auth!.id }, { members: { some: { userId: req.auth!.id } } }], status: { not: 'WITHDRAWN' } },
        include: { tournament: { include: { game: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.tournament.findMany({ where: { createdById: req.auth!.id }, include: { game: true, _count: { select: { entries: { where: { status: { in: ['REGISTERED', 'CONFIRMED'] } } } } } }, orderBy: { startsAt: 'desc' } }),
    ]);
    const now = Date.now();
    const phase = (t: { status: string; startsAt: Date | null }) =>
      t.status === 'COMPLETED' || t.status === 'CANCELLED' ? 'COMPLETED' : t.status === 'IN_PROGRESS' || (t.startsAt && t.startsAt.getTime() <= now) ? 'CURRENT' : 'UPCOMING';
    const registered = [];
    for (const entry of entries) {
      const t = entry.tournament;
      if (q && !`${t.title} ${t.game?.name ?? ''}`.toLowerCase().includes(q)) continue;
      // The member's next match and their result, from the fixtures.
      const matches = await prisma.tournamentMatch.findMany({ where: { tournamentId: t.id, OR: [{ homeEntryId: entry.id }, { awayEntryId: entry.id }] }, orderBy: [{ round: 'asc' }] });
      const next = matches.find((m) => m.status === 'READY');
      const champion = t.status === 'COMPLETED' && t.results?.includes(entry.teamName || entry.playerName);
      registered.push({
        slug: t.slug,
        title: t.title,
        game: t.game?.name ?? null,
        startsAt: t.startsAt,
        status: t.status,
        phase: phase(t),
        reference: entry.reference,
        entryStatus: entry.status,
        teamName: entry.teamName,
        nextMatch: next ? { id: next.id, round: next.round, stage: next.stage } : null,
        played: matches.filter((m) => m.status === 'COMPLETED').length,
        won: matches.filter((m) => m.status === 'COMPLETED' && m.winnerEntryId === entry.id).length,
        result: t.status === 'COMPLETED' ? (champion ? 'Winner' : t.results ?? 'Completed') : null,
      });
    }
    res.json({
      registered,
      created: created
        .filter((t) => !q || `${t.title} ${t.game?.name ?? ''}`.toLowerCase().includes(q))
        .map((t) => ({ slug: t.slug, title: t.title, game: t.game?.name ?? null, startsAt: t.startsAt, status: t.status, phase: phase(t), entries: t._count.entries, slots: t.slots, checked: !!t.checkedAt, registrationRestricted: t.registrationRestricted })),
    });
  }),
);

/** Fixtures, bracket and table for a tournament page. */
gamingPublic.get(
  '/gaming/tournaments/:slug/fixtures',
  route(async (req, res) => {
    const tournament = await prisma.tournament.findFirst({ where: { slug: req.params.slug, status: { in: PUBLIC_STATUSES } } });
    if (!tournament) throw ApiError.notFound('That tournament is not listed.');
    const [matches, entries] = await Promise.all([
      prisma.tournamentMatch.findMany({ where: { tournamentId: tournament.id }, orderBy: [{ stage: 'asc' }, { round: 'asc' }, { position: 'asc' }] }),
      prisma.tournamentEntry.findMany({ where: { tournamentId: tournament.id }, select: { id: true, teamName: true, playerName: true, captainId: true, members: { select: { userId: true } } } }),
    ]);
    const names = new Map(entries.map((entry) => [entry.id, entry.teamName || entry.playerName]));
    const mine = req.auth ? entries.filter((entry) => entry.captainId === req.auth!.id || entry.members.some((m) => m.userId === req.auth!.id)).map((entry) => entry.id) : [];
    res.json({
      format: tournament.bracketFormat,
      canManage: !!req.auth && (tournament.createdById === req.auth.id || isGamingStaff(req.auth)),
      myEntryIds: mine,
      matches: matches.map((m) => ({
        id: m.id,
        stage: m.stage,
        round: m.round,
        position: m.position,
        home: m.homeEntryId ? { id: m.homeEntryId, name: names.get(m.homeEntryId) ?? '—' } : null,
        away: m.awayEntryId ? { id: m.awayEntryId, name: names.get(m.awayEntryId) ?? '—' } : null,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        winnerId: m.winnerEntryId,
        status: m.status,
        disputed: m.disputed,
      })),
      standings: tournament.bracketFormat === 'LEAGUE' || tournament.bracketFormat === 'ROUND_ROBIN' ? await standings(tournament.id) : [],
    });
  }),
);

/** Public discovery with the tournament category tabs. */
gamingPublic.get(
  '/gaming/tournaments',
  route(async (req, res) => {
    const category = typeof req.query.category === 'string' ? req.query.category.toUpperCase() : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const when = req.query.when === 'past' ? 'past' : 'upcoming';
    const rows = await prisma.tournament.findMany({
      where: {
        status: { in: when === 'past' ? ['COMPLETED'] : ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS'] },
        ...(category && TOURNAMENT_CATEGORIES.some((c) => c.key === category) ? { category } : {}),
        ...(q ? { OR: [{ title: textContains(q) }, { organiserName: textContains(q) }, { game: { name: textContains(q) } }] } : {}),
      },
      include: { game: true, _count: { select: { entries: { where: { status: { in: ['REGISTERED', 'CONFIRMED'] } } } } } },
      orderBy: { startsAt: when === 'past' ? 'desc' : 'asc' },
      take: 80,
    });
    const verified = new Set(
      (await prisma.esportsOrganiser.findMany({ where: { id: { in: rows.map((r) => r.esportsOrganiserId).filter((id): id is string => !!id) }, status: 'VERIFIED' }, select: { id: true } })).map((row) => row.id),
    );
    res.json({
      categories: TOURNAMENT_CATEGORIES,
      items: rows.map((t) => ({
        slug: t.slug,
        title: t.title,
        category: t.category,
        organiserName: t.organiserName,
        organiserType: t.organiserType,
        verifiedOrganiser: !!t.esportsOrganiserId && verified.has(t.esportsOrganiserId),
        game: t.game ? { name: t.game.name, slug: t.game.slug, icon: t.game.icon } : null,
        platform: t.platform,
        bracketFormat: t.bracketFormat,
        kind: t.kind,
        startsAt: t.startsAt,
        status: t.status,
        slots: t.slots,
        entries: t._count.entries,
        coverImage: t.coverImage,
        prizeStated: !!t.prizeDetails,
        registrationOpen: t.status === 'REGISTRATION_OPEN' && !t.registrationRestricted && (!t.registrationDeadline || t.registrationDeadline > new Date()) && (!t.slots || t._count.entries < t.slots),
        isDemo: t.isDemo,
        memberCreated: !!t.createdById,
      })),
    });
  }),
);

/* -------------------------- Esports organiser verification -------------------- */

const esportsSchema = z.object({
  organisationName: z.string().trim().min(2).max(160),
  representativeName: z.string().trim().min(2).max(120),
  representativeRole: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(40),
  email: z.string().trim().email().max(160),
  country: z.string().trim().min(2).max(80),
  location: z.string().trim().max(160).optional().or(z.literal('')),
  website: z.string().url().max(300).optional().or(z.literal('')),
  socials: z.array(z.string().trim().min(3).max(300)).max(8).default([]),
  history: z.string().trim().min(20, 'Describe competitions you have run (dates, games, number of players).').max(5000),
  games: z.array(z.string().trim().min(1).max(60)).min(1, 'Choose at least one game.').max(20),
  authorityEvidence: z.string().trim().min(20, 'Explain how you are authorised to represent the organisation.').max(3000),
  documents: z.array(z.object({ assetId: z.string().min(8).max(200), format: z.string().max(10), name: z.string().max(120).default('Document') })).max(8).default([]),
});

gamingMember.post(
  '/esports-organisers',
  requireAuth,
  createLimiter,
  route(async (req, res) => {
    const input = esportsSchema.parse(req.body);
    const open = await prisma.esportsOrganiser.findFirst({ where: { userId: req.auth!.id, status: { in: ['PENDING', 'MORE_INFO'] } } });
    if (open) throw ApiError.conflict('You already have an application under review. Update it instead.');
    // Documents must be the applicant's own private uploads.
    if (input.documents.some((doc) => !assetBelongsTo(doc.assetId, req.auth!.id, 'ESPORTS_DOCUMENT'))) throw ApiError.badRequest('Upload the documents again, then submit.');
    const application = await prisma.esportsOrganiser.create({
      data: { ...input, userId: req.auth!.id, location: input.location || null, website: input.website || null, socials: JSON.stringify(input.socials), games: JSON.stringify(input.games), documents: JSON.stringify(input.documents) },
    });
    await notifyStaff('gaming.view', { type: 'ANNOUNCEMENT', title: `Esports organiser application: ${input.organisationName}`, body: `${input.representativeName} (${input.representativeRole}) applied for verification.`, link: `/admin/gaming?tab=esports&id=${application.id}` });
    res.status(201).json({ id: application.id, status: application.status, message: 'Thank you. The gaming team will review your application. You can publish tournaments meanwhile; they will not show a verified badge until you are verified.' });
  }),
);

gamingMember.get(
  '/esports-organisers/mine',
  requireAuth,
  route(async (req, res) => {
    const rows = await prisma.esportsOrganiser.findMany({ where: { userId: req.auth!.id }, orderBy: { createdAt: 'desc' } });
    res.json({ items: rows.map((row) => ({ id: row.id, organisationName: row.organisationName, status: row.status, reviewNote: row.reviewNote, verifiedUntil: row.verifiedUntil, createdAt: row.createdAt, updatedAt: row.updatedAt })) });
  }),
);

/** Answer a "more information required" request. */
gamingMember.patch(
  '/esports-organisers/:id',
  requireAuth,
  route(async (req, res) => {
    const input = esportsSchema.partial().extend({ note: z.string().trim().max(3000).optional() }).parse(req.body);
    const row = await prisma.esportsOrganiser.findFirst({ where: { id: req.params.id, userId: req.auth!.id } });
    if (!row) throw ApiError.notFound();
    if (!['PENDING', 'MORE_INFO'].includes(row.status)) throw ApiError.badRequest('This application has been decided. Submit a new one if your details changed.');
    const { note, socials, games, documents, ...rest } = input;
    if (documents?.some((doc) => !assetBelongsTo(doc.assetId, req.auth!.id, 'ESPORTS_DOCUMENT'))) throw ApiError.badRequest('Upload the documents again, then submit.');
    await prisma.esportsOrganiser.update({
      where: { id: row.id },
      data: {
        ...rest,
        ...(socials ? { socials: JSON.stringify(socials) } : {}),
        ...(games ? { games: JSON.stringify(games) } : {}),
        ...(documents ? { documents: JSON.stringify(documents) } : {}),
        ...(note ? { history: `${row.history}\n\n— Additional information (${new Date().toISOString().slice(0, 10)}):\n${note}` } : {}),
        status: 'PENDING',
      },
    });
    await notifyStaff('gaming.view', { type: 'ANNOUNCEMENT', title: `Esports application updated: ${row.organisationName}`, body: 'The applicant added information.', link: `/admin/gaming?tab=esports&id=${row.id}` });
    res.json({ ok: true });
  }),
);

/* ------------------------------- Gaming sessions ------------------------------ */

const sessionSchema = z.object({
  title: z.string().trim().min(3).max(120),
  game: z.string().trim().min(2).max(60),
  platform: z.string().trim().min(2).max(60),
  mode: z.enum(['ONLINE', 'PHYSICAL']),
  sessionType: z.enum(['CASUAL', 'PRACTICE', 'TRAINING', 'MEETUP', 'MULTIPLAYER']).default('CASUAL'),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional(),
  capacity: z.number().int().min(2).max(200),
  location: z.string().trim().max(200).optional().or(z.literal('')),
  onlinePlatform: z.string().trim().max(120).optional().or(z.literal('')),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
});

const sessionCard = (row: Awaited<ReturnType<typeof prisma.gamingSession.findMany>>[number] & { players: { userId: string }[] }, organiser?: { name: string; username: string | null } | null, viewerId?: string) => ({
  slug: row.slug,
  title: row.title,
  game: row.game,
  platform: row.platform,
  mode: row.mode,
  sessionType: row.sessionType,
  startsAt: row.startsAt,
  endsAt: row.endsAt,
  capacity: row.capacity,
  joined: row.players.length,
  spotsLeft: Math.max(0, row.capacity - row.players.length),
  // A physical venue is shown to everyone (it is a public meet-up). Online details go to players only.
  location: row.mode === 'PHYSICAL' ? row.location : null,
  onlinePlatform: viewerId && (row.players.some((p) => p.userId === viewerId) || row.organiserId === viewerId) ? row.onlinePlatform : null,
  description: row.description,
  status: row.status,
  organiser: organiser ? playerName(organiser) : null,
  mine: viewerId ? row.organiserId === viewerId : false,
  joinedByMe: viewerId ? row.players.some((p) => p.userId === viewerId) : false,
});

gamingMember.post(
  '/sessions',
  requireAuth,
  createLimiter,
  route(async (req, res) => {
    const input = sessionSchema.parse(req.body);
    if (input.startsAt.getTime() < Date.now() - 60_000) throw ApiError.badRequest('Choose a time in the future.');
    if (input.mode === 'PHYSICAL' && !input.location) throw ApiError.badRequest('Give the venue (a public place).');
    let slug = slugify(`${input.game} ${input.title}`) || `session-${shortCode(4).toLowerCase()}`;
    if (await prisma.gamingSession.findUnique({ where: { slug } })) slug = `${slug}-${shortCode(4).toLowerCase()}`;
    const session = await prisma.gamingSession.create({
      data: { ...input, slug, organiserId: req.auth!.id, location: input.location || null, onlinePlatform: input.onlinePlatform || null, description: input.description || null, endsAt: input.endsAt ?? null, players: { create: { userId: req.auth!.id } } },
    });
    await recordActivity({ userId: req.auth!.id, action: 'GAMING_SESSION_CREATED', title: `Organised ${session.title}`, link: `/experiences/gaming/sessions/${session.slug}`, subjectType: 'GAMING_SESSION', subjectId: session.id });
    res.status(201).json({ slug: session.slug });
  }),
);

gamingPublic.get(
  '/gaming/sessions',
  route(async (req, res) => {
    const game = typeof req.query.game === 'string' ? req.query.game.trim() : '';
    const mode = req.query.mode === 'ONLINE' || req.query.mode === 'PHYSICAL' ? req.query.mode : null;
    const rows = await prisma.gamingSession.findMany({
      where: { status: { in: ['OPEN', 'FULL'] }, startsAt: { gte: new Date(Date.now() - 2 * 3600 * 1000) }, ...(game ? { game: textContains(game) } : {}), ...(mode ? { mode } : {}) },
      include: { players: { select: { userId: true } } },
      orderBy: { startsAt: 'asc' },
      take: 80,
    });
    const organisers = new Map((await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.organiserId) } }, select: { id: true, name: true, username: true } })).map((u) => [u.id, u]));
    res.json({ items: rows.map((row) => sessionCard(row, organisers.get(row.organiserId), req.auth?.id)) });
  }),
);

gamingPublic.get(
  '/gaming/sessions/:slug',
  route(async (req, res) => {
    const row = await prisma.gamingSession.findUnique({ where: { slug: req.params.slug }, include: { players: { select: { userId: true } } } });
    if (!row || row.status === 'HIDDEN') throw ApiError.notFound('That session is not available.');
    const organiser = await prisma.user.findUnique({ where: { id: row.organiserId }, select: { name: true, username: true } });
    const players = await prisma.user.findMany({ where: { id: { in: row.players.map((p) => p.userId) } }, select: { name: true, username: true } });
    res.json({ session: sessionCard(row, organiser, req.auth?.id), players: req.auth ? players.map(playerName) : [] });
  }),
);

gamingMember.post(
  '/sessions/:slug/join',
  requireAuth,
  route(async (req, res) => {
    const row = await prisma.gamingSession.findUnique({ where: { slug: req.params.slug }, include: { _count: { select: { players: true } } } });
    if (!row || row.status !== 'OPEN') throw ApiError.conflict('This session is not open.');
    if ((await blockedSet(req.auth!.id)).has(row.organiserId)) throw ApiError.notFound('That session is not available.');
    try {
      await prisma.gamingSessionPlayer.create({ data: { sessionId: row.id, userId: req.auth!.id } });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') return res.json({ joined: true });
      throw error;
    }
    const count = await prisma.gamingSessionPlayer.count({ where: { sessionId: row.id } });
    if (count > row.capacity) {
      await prisma.gamingSessionPlayer.deleteMany({ where: { sessionId: row.id, userId: req.auth!.id } });
      throw ApiError.conflict('This session just filled up.');
    }
    if (count === row.capacity) await prisma.gamingSession.update({ where: { id: row.id }, data: { status: 'FULL' } });
    await notify({ userId: row.organiserId, type: 'GAMING_SESSION', title: `New player · ${row.title}`, body: `${req.auth!.name} joined your session.`, link: `/experiences/gaming/sessions/${row.slug}` });
    await recordActivity({ userId: req.auth!.id, action: 'GAMING_SESSION_JOINED', title: `Joined ${row.title}`, link: `/experiences/gaming/sessions/${row.slug}`, subjectType: 'GAMING_SESSION', subjectId: row.id });
    res.json({ joined: true });
  }),
);

gamingMember.post(
  '/sessions/:slug/leave',
  requireAuth,
  route(async (req, res) => {
    const row = await prisma.gamingSession.findUnique({ where: { slug: req.params.slug } });
    if (!row) throw ApiError.notFound();
    if (row.organiserId === req.auth!.id) throw ApiError.badRequest('You organise this session — cancel it instead.');
    await prisma.gamingSessionPlayer.deleteMany({ where: { sessionId: row.id, userId: req.auth!.id } });
    if (row.status === 'FULL') await prisma.gamingSession.update({ where: { id: row.id }, data: { status: 'OPEN' } });
    res.json({ joined: false });
  }),
);

gamingMember.post(
  '/sessions/:slug/cancel',
  requireAuth,
  route(async (req, res) => {
    const row = await prisma.gamingSession.findUnique({ where: { slug: req.params.slug }, include: { players: true } });
    if (!row) throw ApiError.notFound();
    if (row.organiserId !== req.auth!.id && !isGamingStaff(req.auth)) throw ApiError.forbidden('Only the organiser can cancel it.');
    await prisma.gamingSession.update({ where: { id: row.id }, data: { status: 'CANCELLED' } });
    await notifyMany(row.players.map((p) => p.userId).filter((id) => id !== req.auth!.id), { type: 'GAMING_SESSION', title: `Cancelled · ${row.title}`, body: 'The organiser cancelled this session.', link: `/experiences/gaming/sessions/${row.slug}` });
    res.json({ ok: true });
  }),
);

gamingMember.get(
  '/sessions/mine',
  requireAuth,
  route(async (req, res) => {
    const rows = await prisma.gamingSession.findMany({
      where: { OR: [{ organiserId: req.auth!.id }, { players: { some: { userId: req.auth!.id } } }], status: { not: 'HIDDEN' } },
      include: { players: { select: { userId: true } } },
      orderBy: { startsAt: 'desc' },
      take: 50,
    });
    res.json({ items: rows.map((row) => sessionCard(row, null, req.auth!.id)) });
  }),
);

/* ----------------------------- Squads, guilds, teams --------------------------- */

const groupSchema = z.object({
  kind: z.enum(['GUILD', 'SQUAD', 'TEAM']),
  name: z.string().trim().min(2).max(60),
  game: z.string().trim().max(60).optional().or(z.literal('')),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  privacy: z.enum(['PUBLIC', 'INVITE']).default('PUBLIC'),
  /** A squad inside a guild. */
  guildSlug: z.string().max(80).optional(),
});

gamingMember.post(
  '/groups',
  requireAuth,
  createLimiter,
  route(async (req, res) => {
    const input = groupSchema.parse(req.body);
    let parentId: string | null = null;
    if (input.guildSlug) {
      if (input.kind !== 'SQUAD') throw ApiError.badRequest('Only squads sit inside a guild.');
      const guild = await prisma.gamingGroup.findFirst({ where: { slug: input.guildSlug, kind: 'GUILD', status: 'ACTIVE' } });
      if (!guild) throw ApiError.notFound('Guild not found.');
      const me = await prisma.gamingGroupMember.findUnique({ where: { groupId_userId: { groupId: guild.id, userId: req.auth!.id } } });
      if (!me || me.status !== 'ACTIVE' || !['OWNER', 'CAPTAIN'].includes(me.role)) throw ApiError.forbidden('Only the guild owner or captains can add squads.');
      parentId = guild.id;
    }
    let slug = slugify(input.name) || `${input.kind.toLowerCase()}-${shortCode(4).toLowerCase()}`;
    if (await prisma.gamingGroup.findUnique({ where: { slug } })) slug = `${slug}-${shortCode(4).toLowerCase()}`;
    const group = await prisma.gamingGroup.create({
      data: { slug, kind: input.kind, name: input.name, game: input.game || null, description: input.description || null, privacy: input.privacy, ownerId: req.auth!.id, parentId, members: { create: { userId: req.auth!.id, role: 'OWNER', status: 'ACTIVE' } } },
    });
    await recordActivity({ userId: req.auth!.id, action: 'TEAM_CREATED', title: `Created the ${input.kind.toLowerCase()} ${group.name}`, link: `/experiences/gaming/groups/${group.slug}`, subjectType: 'GAMING_GROUP', subjectId: group.id });
    res.status(201).json({ slug: group.slug });
  }),
);

gamingMember.get(
  '/groups/mine',
  requireAuth,
  route(async (req, res) => {
    const rows = await prisma.gamingGroupMember.findMany({
      where: { userId: req.auth!.id, status: { in: ['ACTIVE', 'INVITED', 'PENDING'] }, group: { status: 'ACTIVE' } },
      include: { group: { include: { parent: { select: { name: true, slug: true } }, _count: { select: { members: { where: { status: 'ACTIVE' } }, children: true } } } } },
      orderBy: { joinedAt: 'desc' },
    });
    res.json({
      items: rows.map((row) => ({ slug: row.group.slug, name: row.group.name, kind: row.group.kind, game: row.group.game, role: row.role, status: row.status, members: row.group._count.members, squads: row.group._count.children, guild: row.group.parent })),
    });
  }),
);

gamingPublic.get(
  '/gaming/groups',
  route(async (req, res) => {
    const kind = typeof req.query.kind === 'string' && ['GUILD', 'SQUAD', 'TEAM'].includes(req.query.kind) ? req.query.kind : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const rows = await prisma.gamingGroup.findMany({
      where: { status: 'ACTIVE', ...(kind ? { kind } : {}), ...(q ? { OR: [{ name: textContains(q) }, { game: textContains(q) }] } : {}) },
      include: { parent: { select: { name: true, slug: true } }, _count: { select: { members: { where: { status: 'ACTIVE' } }, children: true } } },
      orderBy: { createdAt: 'desc' },
      take: 80,
    });
    res.json({ items: rows.map((g) => ({ slug: g.slug, name: g.name, kind: g.kind, game: g.game, description: g.description, privacy: g.privacy, members: g._count.members, squads: g._count.children, guild: g.parent })) });
  }),
);

gamingPublic.get(
  '/gaming/groups/:slug',
  route(async (req, res) => {
    const group = await prisma.gamingGroup.findFirst({
      where: { slug: req.params.slug, status: 'ACTIVE' },
      include: { parent: { select: { name: true, slug: true } }, children: { where: { status: 'ACTIVE' }, select: { name: true, slug: true, game: true } }, members: { where: { status: { in: ['ACTIVE', 'PENDING', 'INVITED'] } } } },
    });
    if (!group) throw ApiError.notFound('Not found.');
    const active = group.members.filter((m) => m.status === 'ACTIVE');
    const users = new Map((await prisma.user.findMany({ where: { id: { in: group.members.map((m) => m.userId) } }, select: { id: true, name: true, username: true, avatarUrl: true } })).map((u) => [u.id, u]));
    const me = req.auth ? group.members.find((m) => m.userId === req.auth!.id) : null;
    const canManage = !!me && me.status === 'ACTIVE' && ['OWNER', 'CAPTAIN'].includes(me.role);
    const conversation = me?.status === 'ACTIVE' ? await prisma.conversation.findUnique({ where: { subjectType_subjectId: { subjectType: 'GAMING_GROUP', subjectId: group.id } } }) : null;
    res.json({
      group: { slug: group.slug, name: group.name, kind: group.kind, game: group.game, description: group.description, privacy: group.privacy, guild: group.parent, squads: group.children },
      members: req.auth ? active.map((m) => ({ userId: m.userId, name: playerName(users.get(m.userId) ?? { name: 'Member', username: null }), avatarUrl: users.get(m.userId)?.avatarUrl ?? null, role: m.role })) : [],
      requests: canManage ? group.members.filter((m) => m.status === 'PENDING').map((m) => ({ userId: m.userId, name: playerName(users.get(m.userId) ?? { name: 'Member', username: null }) })) : [],
      viewer: req.auth ? { status: me?.status ?? null, role: me?.role ?? null, canManage, conversationId: conversation?.id ?? null } : null,
    });
  }),
);

async function groupFor(slug: string) {
  const group = await prisma.gamingGroup.findFirst({ where: { slug, status: 'ACTIVE' } });
  if (!group) throw ApiError.notFound('Not found.');
  return group;
}

async function captainOf(groupId: string, userId: string) {
  const me = await prisma.gamingGroupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
  if (!me || me.status !== 'ACTIVE' || !['OWNER', 'CAPTAIN'].includes(me.role)) throw ApiError.forbidden('Only the owner or a captain can do that.');
  return me;
}

/** Public groups: a request the owner or a captain accepts. Invite-only: by invitation. */
gamingMember.post(
  '/groups/:slug/join',
  requireAuth,
  route(async (req, res) => {
    const group = await groupFor(req.params.slug);
    const existing = await prisma.gamingGroupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: req.auth!.id } } });
    if (existing?.status === 'ACTIVE') return res.json({ status: 'ACTIVE' });
    if (existing?.status === 'INVITED') {
      await prisma.gamingGroupMember.update({ where: { id: existing.id }, data: { status: 'ACTIVE', joinedAt: new Date() } });
      await recordActivity({ userId: req.auth!.id, action: 'TEAM_JOINED', title: `Joined ${group.name}`, link: `/experiences/gaming/groups/${group.slug}`, subjectType: 'GAMING_GROUP', subjectId: group.id });
      return res.json({ status: 'ACTIVE' });
    }
    if (group.privacy === 'INVITE') throw ApiError.forbidden('This group is invitation only.');
    if ((await blockedSet(req.auth!.id)).has(group.ownerId)) throw ApiError.notFound('Not found.');
    await prisma.gamingGroupMember.upsert({ where: { groupId_userId: { groupId: group.id, userId: req.auth!.id } }, create: { groupId: group.id, userId: req.auth!.id, status: 'PENDING' }, update: { status: 'PENDING' } });
    const leaders = await prisma.gamingGroupMember.findMany({ where: { groupId: group.id, status: 'ACTIVE', role: { in: ['OWNER', 'CAPTAIN'] } }, select: { userId: true } });
    await notifyMany(leaders.map((l) => l.userId), { type: 'FRIEND_REQUEST', title: `Request to join ${group.name}`, body: `${req.auth!.name} asked to join.`, link: `/experiences/gaming/groups/${group.slug}` });
    res.json({ status: 'PENDING' });
  }),
);

/** Invite a friend. */
gamingMember.post(
  '/groups/:slug/invite',
  requireAuth,
  route(async (req, res) => {
    const { userId } = z.object({ userId: z.string().min(5) }).parse(req.body);
    const group = await groupFor(req.params.slug);
    await captainOf(group.id, req.auth!.id);
    if (!(await friendIds(req.auth!.id)).includes(userId)) throw ApiError.forbidden('You can invite your friends.');
    const existing = await prisma.gamingGroupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId } } });
    if (existing?.status === 'ACTIVE') return res.json({ status: 'ACTIVE' });
    await prisma.gamingGroupMember.upsert({ where: { groupId_userId: { groupId: group.id, userId } }, create: { groupId: group.id, userId, status: 'INVITED' }, update: { status: 'INVITED' } });
    await notify({ userId, type: 'INVITATION', title: `Invitation: ${group.name}`, body: `${req.auth!.name} invited you to their ${group.kind.toLowerCase()}.`, link: `/experiences/gaming/groups/${group.slug}`, dedupeKey: `group-invite:${group.id}` });
    res.json({ status: 'INVITED' });
  }),
);

gamingMember.post(
  '/groups/:slug/members/:userId',
  requireAuth,
  route(async (req, res) => {
    const { action } = z.object({ action: z.enum(['approve', 'decline', 'remove', 'captain', 'member']) }).parse(req.body);
    const group = await groupFor(req.params.slug);
    const me = await captainOf(group.id, req.auth!.id);
    const target = await prisma.gamingGroupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: req.params.userId } } });
    if (!target) throw ApiError.notFound();
    if (target.role === 'OWNER') throw ApiError.forbidden('The owner cannot be changed here.');
    if ((action === 'captain' || action === 'member') && me.role !== 'OWNER') throw ApiError.forbidden('Only the owner can change captains.');
    if (action === 'approve') {
      await prisma.gamingGroupMember.update({ where: { id: target.id }, data: { status: 'ACTIVE', joinedAt: new Date() } });
      await notify({ userId: target.userId, type: 'INVITATION', title: `Welcome to ${group.name}`, body: 'Your request was accepted.', link: `/experiences/gaming/groups/${group.slug}` });
      await recordActivity({ userId: target.userId, action: 'TEAM_JOINED', title: `Joined ${group.name}`, link: `/experiences/gaming/groups/${group.slug}`, subjectType: 'GAMING_GROUP', subjectId: group.id });
    } else if (action === 'decline' || action === 'remove') {
      await prisma.gamingGroupMember.delete({ where: { id: target.id } });
      const conversation = await prisma.conversation.findUnique({ where: { subjectType_subjectId: { subjectType: 'GAMING_GROUP', subjectId: group.id } } });
      if (conversation) await prisma.conversationMember.deleteMany({ where: { conversationId: conversation.id, userId: target.userId } });
    } else {
      await prisma.gamingGroupMember.update({ where: { id: target.id }, data: { role: action === 'captain' ? 'CAPTAIN' : 'MEMBER' } });
    }
    res.json({ ok: true });
  }),
);

gamingMember.post(
  '/groups/:slug/leave',
  requireAuth,
  route(async (req, res) => {
    const group = await groupFor(req.params.slug);
    if (group.ownerId === req.auth!.id) throw ApiError.badRequest('You own this group. Make someone else the owner through support, or delete it.');
    await prisma.gamingGroupMember.deleteMany({ where: { groupId: group.id, userId: req.auth!.id } });
    res.json({ ok: true });
  }),
);

/* ---------------------- Gaming invitations (nearby, friends, link) ---------------------- */

const inviteSchema = z.object({
  kind: z.enum(['NEARBY', 'FRIENDS', 'EXTERNAL']),
  game: z.string().trim().min(2).max(60),
  platform: z.string().trim().min(2).max(60),
  slotsNeeded: z.number().int().min(1).max(10),
  playStyle: z.string().trim().max(40).optional().or(z.literal('')),
  message: z.string().trim().max(300).optional().or(z.literal('')),
  meetingArea: z.string().trim().max(120).optional().or(z.literal('')),
  minutes: z.number().int().min(5).max(24 * 60).default(GAME_INVITE_DEFAULT_MINUTES),
  friendIds: z.array(z.string().min(5)).max(100).optional(),
});

/** Coordinates or map pins are refused in invitation details and temporary chats. */
export function looksLikeExactLocation(text: string) {
  return /-?\d{1,2}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}/.test(text) || /(maps\.google|google\.[a-z.]+\/maps|goo\.gl\/maps|maps\.app\.goo\.gl|geo:|what3words|plus\.codes)/i.test(text);
}

gamingMember.post(
  '/invites',
  requireAuth,
  inviteLimiter,
  route(async (req, res) => {
    const input = inviteSchema.parse(req.body);
    for (const text of [input.message, input.meetingArea]) {
      if (text && looksLikeExactLocation(text)) throw ApiError.badRequest('Do not share exact coordinates or map pins. Describe a public area instead (for example “near Mlimani City”).');
    }
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.id }, select: { id: true, name: true, username: true, dateOfBirth: true, approxLat: true, approxLng: true, approxLocatedAt: true } });
    const expiresAt = new Date(Date.now() + input.minutes * 60_000);
    let recipients: string[] = [];
    let grid: { lat: number; lng: number } | null = null;
    if (input.kind === 'NEARBY') {
      if (!isAdult(me.dateOfBirth)) throw ApiError.forbidden(me.dateOfBirth ? 'Nearby invitations are for members aged 18 and over.' : 'Add your date of birth in your profile first — nearby invitations are for members aged 18 and over.');
      if (input.minutes > 60) throw ApiError.badRequest('Nearby invitations last at most an hour.');
      if (!me.approxLocatedAt || Date.now() - me.approxLocatedAt.getTime() > LOCATION_FRESH_MS || me.approxLat === null || me.approxLng === null) {
        throw new ApiError(409, 'Share your approximate location first so we can find players near you.', 'location_needed');
      }
      grid = { lat: me.approxLat, lng: me.approxLng };
      const blocked = await blockedSet(me.id);
      // A coarse box first, then the exact 2 km check on the rounded positions.
      const box = NEARBY_RADIUS_KM / 111 + 0.01;
      const candidates = await prisma.user.findMany({
        where: {
          id: { not: me.id },
          status: 'ACTIVE',
          nearbyGaming: true,
          approxLocatedAt: { gt: new Date(Date.now() - LOCATION_FRESH_MS) },
          approxLat: { gte: grid.lat - box, lte: grid.lat + box },
          approxLng: { gte: grid.lng - box * 1.5, lte: grid.lng + box * 1.5 },
        },
        select: { id: true, dateOfBirth: true, approxLat: true, approxLng: true },
        take: 500,
      });
      recipients = candidates
        .filter((c) => !blocked.has(c.id) && isAdult(c.dateOfBirth) && distanceKm(grid!.lat, grid!.lng, c.approxLat!, c.approxLng!) <= NEARBY_RADIUS_KM)
        .slice(0, 50)
        .map((c) => c.id);
    } else if (input.kind === 'FRIENDS') {
      const friends = await friendIds(me.id);
      recipients = input.friendIds?.length ? input.friendIds.filter((id) => friends.includes(id)) : friends;
      if (recipients.length === 0) throw ApiError.badRequest('You have no friends to invite yet. Try Nearby Players or an outside link.');
    }
    const token = input.kind === 'EXTERNAL' ? randomToken(18) : null;
    const invite = await prisma.gameInvite.create({
      data: {
        kind: input.kind,
        requesterId: me.id,
        game: input.game,
        platform: input.platform,
        slotsNeeded: input.slotsNeeded,
        slotsRemaining: input.slotsNeeded,
        playStyle: input.playStyle || null,
        message: input.message || null,
        meetingArea: input.meetingArea || null,
        expiresAt,
        tokenHash: token ? sha256(token) : null,
        gridLat: grid?.lat ?? null,
        gridLng: grid?.lng ?? null,
        recipients: { create: recipients.map((userId) => ({ userId })) },
      },
    });
    // The temporary chat, tied to this invitation. Closes 12 hours after the invitation.
    const conversation = await prisma.conversation.create({
      data: { kind: 'GAMING', subjectType: 'GAME_INVITE', subjectId: invite.id, title: `${input.game} · ${playerName(me)}`, expiresAt: new Date(expiresAt.getTime() + 12 * 3600 * 1000), members: { create: { userId: me.id, role: 'ORGANIZER' } } },
    });
    await prisma.gameInvite.update({ where: { id: invite.id }, data: { conversationId: conversation.id } });
    const label = input.kind === 'NEARBY' ? 'Nearby gaming invitation' : `${playerName(me)} invited you to play`;
    for (const userId of recipients) {
      await notify({
        userId,
        type: 'GAMING_INVITE',
        title: label,
        body: `${input.game} on ${input.platform} · ${input.slotsNeeded} player${input.slotsNeeded > 1 ? 's' : ''} needed${input.kind === 'NEARBY' ? ' · within 2 km' : ''}`,
        link: `/gaming/invites/${invite.id}`,
        dedupeKey: `game-invite:${invite.id}`,
      });
    }
    res.status(201).json({
      id: invite.id,
      expiresAt,
      // How many people were reached is not shown for nearby invitations — only whether anyone was.
      reached: recipients.length > 0,
      link: token ? `${env.appUrl}/join/game/${token}` : null,
    });
  }),
);

async function expireIfDue(invite: { id: string; status: string; expiresAt: Date }) {
  if (invite.status === 'OPEN' && invite.expiresAt.getTime() <= Date.now()) {
    await prisma.gameInvite.updateMany({ where: { id: invite.id, status: 'OPEN' }, data: { status: 'EXPIRED' } });
    return 'EXPIRED';
  }
  return invite.status;
}

async function inviteView(invite: Awaited<ReturnType<typeof prisma.gameInvite.findUniqueOrThrow>>, viewerId: string | null) {
  const status = await expireIfDue(invite);
  const requester = await prisma.user.findUnique({ where: { id: invite.requesterId }, select: { id: true, name: true, username: true, avatarUrl: true } });
  const isRequester = viewerId === invite.requesterId;
  const mine = viewerId ? await prisma.gameInviteResponse.findUnique({ where: { inviteId_userId: { inviteId: invite.id, userId: viewerId } } }) : null;
  // Accepted players are shown to the requester and to the other accepted players. Declines are never shown.
  const accepted = isRequester || mine?.status === 'ACCEPTED'
    ? await prisma.gameInviteResponse.findMany({ where: { inviteId: invite.id, status: 'ACCEPTED' }, orderBy: { createdAt: 'asc' } })
    : [];
  const acceptedUsers = accepted.length ? await prisma.user.findMany({ where: { id: { in: accepted.map((a) => a.userId) } }, select: { id: true, name: true, username: true, avatarUrl: true } }) : [];
  return {
    id: invite.id,
    kind: invite.kind,
    game: invite.game,
    platform: invite.platform,
    playStyle: invite.playStyle,
    message: invite.message,
    meetingArea: invite.meetingArea,
    slotsNeeded: invite.slotsNeeded,
    slotsRemaining: invite.slotsRemaining,
    expiresAt: invite.expiresAt,
    status,
    requester: requester ? { id: requester.id, name: playerName(requester), avatarUrl: requester.avatarUrl } : null,
    isRequester,
    myResponse: mine?.status ?? null,
    accepted: acceptedUsers.map((u) => ({ id: u.id, name: playerName(u), avatarUrl: u.avatarUrl })),
    conversationId: isRequester || mine?.status === 'ACCEPTED' ? invite.conversationId : null,
    linkActive: invite.kind === 'EXTERNAL' ? !!invite.tokenHash : undefined,
  };
}

gamingMember.get(
  '/invites',
  requireAuth,
  route(async (req, res) => {
    const [created, received] = await Promise.all([
      prisma.gameInvite.findMany({ where: { requesterId: req.auth!.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.gameInvite.findMany({ where: { OR: [{ recipients: { some: { userId: req.auth!.id } } }, { responses: { some: { userId: req.auth!.id, status: 'ACCEPTED' } } }] }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);
    res.json({ created: await Promise.all(created.map((i) => inviteView(i, req.auth!.id))), received: await Promise.all(received.map((i) => inviteView(i, req.auth!.id))) });
  }),
);

/** Who may see an invitation: the requester, the people it was sent to, and accepted players. */
async function visibleInvite(id: string, viewerId: string) {
  const invite = await prisma.gameInvite.findUnique({ where: { id } });
  if (!invite) throw ApiError.notFound('This invitation does not exist.');
  if (invite.requesterId === viewerId) return invite;
  const [recipient, response] = await Promise.all([
    prisma.gameInviteRecipient.findUnique({ where: { inviteId_userId: { inviteId: id, userId: viewerId } } }),
    prisma.gameInviteResponse.findUnique({ where: { inviteId_userId: { inviteId: id, userId: viewerId } } }),
  ]);
  if (!recipient && !response) throw ApiError.notFound('This invitation does not exist.');
  return invite;
}

gamingMember.get(
  '/invites/:id',
  requireAuth,
  route(async (req, res) => {
    const invite = await visibleInvite(req.params.id, req.auth!.id);
    res.json(await inviteView(invite, req.auth!.id));
  }),
);

/** Public view of an outside link: the game and details only — no location, no contacts. */
gamingPublic.get(
  '/gaming/invite-links/:token',
  route(async (req, res) => {
    const invite = await prisma.gameInvite.findUnique({ where: { tokenHash: sha256(req.params.token) } });
    if (!invite) throw ApiError.notFound('This invitation link is not valid. It may have been cancelled.');
    const view = await inviteView(invite, req.auth?.id ?? null);
    res.json({ ...view, conversationId: view.conversationId, meetingArea: null });
  }),
);

/**
 * Accept. The response row is created first (one per person), then a slot is
 * taken with a conditional decrement — so two people can never take the same
 * last slot and the same person cannot accept twice.
 */
gamingMember.post(
  '/invites/:id/accept',
  requireAuth,
  route(async (req, res) => {
    const { token } = z.object({ token: z.string().max(100).optional() }).parse(req.body ?? {});
    const invite = await prisma.gameInvite.findUnique({ where: { id: req.params.id } });
    if (!invite) throw ApiError.notFound('This invitation does not exist.');
    if (invite.requesterId === req.auth!.id) throw ApiError.badRequest('This is your own invitation.');
    if (invite.kind === 'EXTERNAL') {
      if (!token || !invite.tokenHash || sha256(token) !== invite.tokenHash) throw ApiError.forbidden('Open the invitation link again to accept.');
    } else {
      const recipient = await prisma.gameInviteRecipient.findUnique({ where: { inviteId_userId: { inviteId: invite.id, userId: req.auth!.id } } });
      if (!recipient) throw ApiError.notFound('This invitation does not exist.');
    }
    if ((await blockedSet(req.auth!.id)).has(invite.requesterId)) throw ApiError.notFound('This invitation does not exist.');
    const existing = await prisma.gameInviteResponse.findUnique({ where: { inviteId_userId: { inviteId: invite.id, userId: req.auth!.id } } });
    if (existing?.status === 'ACCEPTED') return res.json({ accepted: true, conversationId: invite.conversationId });
    if (existing) await prisma.gameInviteResponse.delete({ where: { id: existing.id } });
    try {
      await prisma.gameInviteResponse.create({ data: { inviteId: invite.id, userId: req.auth!.id, status: 'ACCEPTED' } });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') return res.json({ accepted: true, conversationId: invite.conversationId });
      throw error;
    }
    const taken = await prisma.gameInvite.updateMany({
      where: { id: invite.id, status: 'OPEN', slotsRemaining: { gt: 0 }, expiresAt: { gt: new Date() } },
      data: { slotsRemaining: { decrement: 1 } },
    });
    if (taken.count === 0) {
      await prisma.gameInviteResponse.deleteMany({ where: { inviteId: invite.id, userId: req.auth!.id } });
      await expireIfDue(invite);
      throw ApiError.conflict('Sorry — this invitation is already full or has expired.');
    }
    const after = await prisma.gameInvite.findUniqueOrThrow({ where: { id: invite.id } });
    if (after.slotsRemaining <= 0) await prisma.gameInvite.updateMany({ where: { id: invite.id, status: 'OPEN' }, data: { status: 'FULL' } });
    if (invite.conversationId) {
      await prisma.conversationMember.upsert({ where: { conversationId_userId: { conversationId: invite.conversationId, userId: req.auth!.id } }, create: { conversationId: invite.conversationId, userId: req.auth!.id }, update: {} });
    }
    await notify({
      userId: invite.requesterId,
      type: 'GAMING_INVITE',
      title: `${req.auth!.name} accepted your invitation`,
      body: `${invite.game} · ${Math.max(0, after.slotsRemaining)} place${after.slotsRemaining === 1 ? '' : 's'} left`,
      link: `/gaming/invites/${invite.id}`,
    });
    res.json({ accepted: true, conversationId: invite.conversationId });
  }),
);

/** Declining is silent: the requester is never told who declined or ignored. */
gamingMember.post(
  '/invites/:id/decline',
  requireAuth,
  route(async (req, res) => {
    const invite = await visibleInvite(req.params.id, req.auth!.id);
    if (invite.requesterId === req.auth!.id) throw ApiError.badRequest('This is your own invitation.');
    const existing = await prisma.gameInviteResponse.findUnique({ where: { inviteId_userId: { inviteId: invite.id, userId: req.auth!.id } } });
    if (existing?.status === 'ACCEPTED') throw ApiError.badRequest('You already accepted. Leave the chat if you cannot make it.');
    await prisma.gameInviteResponse.upsert({ where: { inviteId_userId: { inviteId: invite.id, userId: req.auth!.id } }, create: { inviteId: invite.id, userId: req.auth!.id, status: 'DECLINED' }, update: { status: 'DECLINED' } });
    res.json({ ok: true });
  }),
);

gamingMember.post(
  '/invites/:id/cancel',
  requireAuth,
  route(async (req, res) => {
    const invite = await prisma.gameInvite.findUnique({ where: { id: req.params.id } });
    if (!invite || invite.requesterId !== req.auth!.id) throw ApiError.notFound();
    await prisma.gameInvite.update({ where: { id: invite.id }, data: { status: 'CANCELLED', tokenHash: null } });
    const accepted = await prisma.gameInviteResponse.findMany({ where: { inviteId: invite.id, status: 'ACCEPTED' }, select: { userId: true } });
    await notifyMany(accepted.map((a) => a.userId), { type: 'GAMING_INVITE', title: 'Gaming invitation cancelled', body: `${invite.game} was cancelled by the organiser.`, link: `/gaming/invites/${invite.id}` });
    res.json({ ok: true });
  }),
);

/** Stops an outside link from working (people who already accepted keep their place). */
gamingMember.post(
  '/invites/:id/revoke-link',
  requireAuth,
  route(async (req, res) => {
    const invite = await prisma.gameInvite.findUnique({ where: { id: req.params.id } });
    if (!invite || invite.requesterId !== req.auth!.id) throw ApiError.notFound();
    await prisma.gameInvite.update({ where: { id: invite.id }, data: { tokenHash: null } });
    res.json({ ok: true });
  }),
);

/** Expires invitations that ran out (called every few minutes by the server). */
export async function expireGameInvites() {
  await prisma.gameInvite.updateMany({ where: { status: 'OPEN', expiresAt: { lte: new Date() } }, data: { status: 'EXPIRED' } });
}

/* ----------------------------- Gaming discovery helpers ------------------------- */

gamingPublic.get(
  '/gaming/games',
  route(async (_req, res) => {
    const games = await prisma.category.findMany({ where: { kind: 'GAME', status: 'PUBLISHED' }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true, slug: true, icon: true, group: true } });
    res.json({ items: games });
  }),
);

export { isGamingStaff };
