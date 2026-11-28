import { Router } from 'express';
import { z } from 'zod';
import { ApiError, route } from '../../lib/http';
import { decryptText } from '../../lib/crypto';
import { readJsonSetting, writeJsonSetting } from '../../lib/json';
import { prisma } from '../../lib/prisma';
import { textContains } from '../../lib/search';
import { assertPermission } from '../../middleware/auth';
import { audit } from '../../services/audit';
import { notify, notifyMany } from '../../services/notifications';
import { baseUrlOf, fileStorage } from '../../services/storage';
import { MESSAGING_DEFAULTS } from '../messages';

/**
 * Control centre — Phase 1 modules:
 * Gaming (tournaments with organiser contacts and follow-up notes, esports
 * organiser verification, sessions, squads & guilds, disputes), restricted
 * access to reported private messages, messaging settings, and community /
 * study-group moderation. Every sensitive view and decision is audited.
 */
export const r8AdminRouter = Router();

/* ---------------------------------- Gaming ---------------------------------- */

r8AdminRouter.get(
  '/gaming/overview',
  route(async (req, res) => {
    assertPermission(req, 'gaming.view');
    const [tournaments, unchecked, esportsPending, sessions, groups, disputes, invitesToday] = await Promise.all([
      prisma.tournament.count({ where: { status: { in: ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS'] } } }),
      prisma.tournament.count({ where: { createdById: { not: null }, checkedAt: null, status: { notIn: ['ARCHIVED', 'CANCELLED'] } } }),
      prisma.esportsOrganiser.count({ where: { status: { in: ['PENDING', 'MORE_INFO'] } } }),
      prisma.gamingSession.count({ where: { status: { in: ['OPEN', 'FULL'] }, startsAt: { gte: new Date() } } }),
      prisma.gamingGroup.count({ where: { status: 'ACTIVE' } }),
      prisma.report.count({ where: { targetType: 'TOURNAMENT_MATCH', status: { in: ['OPEN', 'REVIEWING'] } } }),
      prisma.gameInvite.count({ where: { createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
    ]);
    res.json({ tournaments, unchecked, esportsPending, sessions, groups, disputes, invitesToday });
  }),
);

r8AdminRouter.get(
  '/gaming/tournaments',
  route(async (req, res) => {
    assertPermission(req, 'gaming.view');
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const filter = typeof req.query.filter === 'string' ? req.query.filter : 'all';
    const rows = await prisma.tournament.findMany({
      where: {
        ...(filter === 'unchecked' ? { checkedAt: null, createdById: { not: null } } : filter === 'restricted' ? { OR: [{ registrationRestricted: true }, { status: { in: ['HIDDEN', 'SUSPENDED'] } }] } : {}),
        ...(q ? { OR: [{ title: textContains(q) }, { organiserName: textContains(q) }, { contactName: textContains(q) }] } : {}),
      },
      include: { game: true, _count: { select: { entries: { where: { status: { in: ['REGISTERED', 'CONFIRMED'] } } }, notes: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({
      items: rows.map((t) => ({
        id: t.id,
        slug: t.slug,
        title: t.title,
        category: t.category,
        organiserType: t.organiserType,
        organiserName: t.organiserName,
        game: t.game?.name ?? null,
        startsAt: t.startsAt,
        status: t.status,
        entries: t._count.entries,
        slots: t.slots,
        notes: t._count.notes,
        checkedAt: t.checkedAt,
        registrationRestricted: t.registrationRestricted,
        memberCreated: !!t.createdById,
        createdAt: t.createdAt,
      })),
    });
  }),
);

/** One tournament with the organiser's contact details (team only; viewing is audited). */
r8AdminRouter.get(
  '/gaming/tournaments/:id',
  route(async (req, res) => {
    assertPermission(req, 'gaming.view');
    const t = await prisma.tournament.findUniqueOrThrow({ where: { id: req.params.id }, include: { game: true, notes: { orderBy: { createdAt: 'desc' } } } });
    const [organiser, esports, entries] = await Promise.all([
      t.createdById ? prisma.user.findUnique({ where: { id: t.createdById }, select: { id: true, name: true, email: true, username: true, status: true, phone: true } }) : null,
      t.esportsOrganiserId ? prisma.esportsOrganiser.findUnique({ where: { id: t.esportsOrganiserId }, select: { organisationName: true, status: true } }) : null,
      prisma.tournamentEntry.count({ where: { tournamentId: t.id, status: { in: ['REGISTERED', 'CONFIRMED'] } } }),
    ]);
    const authors = new Map((await prisma.user.findMany({ where: { id: { in: t.notes.map((n) => n.authorId) } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
    await audit(req, { action: 'view', entityType: 'tournaments', entityId: t.id, summary: `Viewed organiser contact details for “${t.title}”`, sensitive: true });
    res.json({
      tournament: { ...t, notes: undefined, game: t.game?.name ?? null, entries },
      contact: { name: t.contactName, phone: t.contactPhone, email: t.contactEmail },
      organiser,
      esports,
      notes: t.notes.map((n) => ({ id: n.id, kind: n.kind, body: n.body, createdAt: n.createdAt, author: authors.get(n.authorId) ?? 'Team' })),
    });
  }),
);

/**
 * Team actions on a tournament: note, contact logged, ask for information
 * (sent to the organiser), mark checked, restrict / allow registration,
 * hide, suspend, restore. Hiding and suspending need a reason.
 */
r8AdminRouter.post(
  '/gaming/tournaments/:id/action',
  route(async (req, res) => {
    const input = z
      .object({
        action: z.enum(['note', 'contact', 'request_info', 'check', 'restrict', 'allow', 'hide', 'suspend', 'restore']),
        body: z.string().trim().max(3000).optional(),
      })
      .parse(req.body);
    assertPermission(req, ['note', 'contact', 'check'].includes(input.action) ? 'gaming.view' : 'gaming.edit');
    const t = await prisma.tournament.findUniqueOrThrow({ where: { id: req.params.id } });
    const needsBody = ['note', 'contact', 'request_info', 'hide', 'suspend'].includes(input.action);
    if (needsBody && !input.body) throw ApiError.badRequest(input.action === 'request_info' ? 'Write what you need from the organiser.' : 'Write a note or a reason.');
    const note = (kind: string, body: string) => prisma.tournamentNote.create({ data: { tournamentId: t.id, authorId: req.auth!.id, kind, body } });
    switch (input.action) {
      case 'note':
        await note('NOTE', input.body!);
        break;
      case 'contact':
        await note('CONTACT', input.body!);
        break;
      case 'request_info':
        await note('INFO_REQUEST', input.body!);
        if (t.createdById) await notify({ userId: t.createdById, type: 'TOURNAMENT_UPDATE', title: `The Enhakkore team needs information · ${t.title}`, body: input.body!.slice(0, 300), link: `/experiences/gaming/${t.slug}` });
        break;
      case 'check':
        await prisma.tournament.update({ where: { id: t.id }, data: { checkedAt: new Date(), checkedById: req.auth!.id } });
        await note('CHECK', input.body || 'Marked as checked.');
        break;
      case 'restrict':
      case 'allow':
        await prisma.tournament.update({ where: { id: t.id }, data: { registrationRestricted: input.action === 'restrict', moderationReason: input.body ?? t.moderationReason } });
        await note('NOTE', `${input.action === 'restrict' ? 'Registration restricted' : 'Registration allowed again'}${input.body ? `: ${input.body}` : ''}`);
        break;
      case 'hide':
      case 'suspend': {
        await prisma.tournament.update({ where: { id: t.id }, data: { status: input.action === 'hide' ? 'HIDDEN' : 'SUSPENDED', moderationReason: input.body } });
        await note('NOTE', `${input.action === 'hide' ? 'Hidden' : 'Suspended'}: ${input.body}`);
        if (t.createdById) await notify({ userId: t.createdById, type: 'TOURNAMENT_UPDATE', title: `${input.action === 'hide' ? 'Hidden' : 'Suspended'} by the Enhakkore team · ${t.title}`, body: input.body!.slice(0, 300), link: `/account/gaming` });
        break;
      }
      case 'restore':
        await prisma.tournament.update({ where: { id: t.id }, data: { status: t.status === 'HIDDEN' || t.status === 'SUSPENDED' ? 'REGISTRATION_OPEN' : t.status, moderationReason: null } });
        await note('NOTE', `Restored${input.body ? `: ${input.body}` : ''}`);
        if (t.createdById) await notify({ userId: t.createdById, type: 'TOURNAMENT_UPDATE', title: `Restored · ${t.title}`, body: 'Your tournament is visible again.', link: `/experiences/gaming/${t.slug}` });
        break;
    }
    await audit(req, { action: 'update', entityType: 'tournaments', entityId: t.id, summary: `Tournament “${t.title}”: ${input.action.replace('_', ' ')}${input.body ? ` — ${input.body.slice(0, 120)}` : ''}`, sensitive: ['hide', 'suspend', 'restore'].includes(input.action) });
    res.json({ ok: true });
  }),
);

/* Esports organisers */

r8AdminRouter.get(
  '/gaming/esports',
  route(async (req, res) => {
    assertPermission(req, 'gaming.view');
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const rows = await prisma.esportsOrganiser.findMany({ where: status ? { status } : {}, orderBy: { createdAt: 'desc' }, take: 200 });
    res.json({ items: rows.map((row) => ({ ...row, socials: JSON.parse(row.socials), games: JSON.parse(row.games), documents: (JSON.parse(row.documents) as { name: string }[]).map((doc, index) => ({ index, name: doc.name })) })) });
  }),
);

/** Opens one evidence document (private; audited). */
r8AdminRouter.get(
  '/gaming/esports/:id/documents/:index',
  route(async (req, res) => {
    assertPermission(req, 'gaming.view');
    const row = await prisma.esportsOrganiser.findUniqueOrThrow({ where: { id: req.params.id } });
    const doc = (JSON.parse(row.documents) as { assetId: string; format: string; name: string }[])[Number(req.params.index)];
    if (!doc) throw ApiError.notFound();
    await audit(req, { action: 'view', entityType: 'esports_organisers', entityId: row.id, summary: `Opened an evidence document of ${row.organisationName}`, sensitive: true });
    res.json({ url: await fileStorage().privateUrl(doc.assetId, doc.format || 'pdf', baseUrlOf(req)) });
  }),
);

r8AdminRouter.post(
  '/gaming/esports/:id/decision',
  route(async (req, res) => {
    assertPermission(req, 'gaming.edit');
    const input = z.object({ status: z.enum(['PENDING', 'MORE_INFO', 'VERIFIED', 'REJECTED', 'SUSPENDED', 'EXPIRED']), note: z.string().trim().max(2000).optional(), months: z.number().int().min(1).max(36).default(12) }).parse(req.body);
    if (['MORE_INFO', 'REJECTED', 'SUSPENDED'].includes(input.status) && !input.note) throw ApiError.badRequest('Write a note the applicant will see.');
    const row = await prisma.esportsOrganiser.findUniqueOrThrow({ where: { id: req.params.id } });
    await prisma.esportsOrganiser.update({
      where: { id: row.id },
      data: { status: input.status, reviewNote: input.note ?? null, reviewedById: req.auth!.id, reviewedAt: new Date(), verifiedUntil: input.status === 'VERIFIED' ? new Date(Date.now() + input.months * 30 * 86_400_000) : row.verifiedUntil },
    });
    // Link (or unlink) their esports tournaments so the badge follows the verification.
    if (input.status === 'VERIFIED') {
      await prisma.tournament.updateMany({ where: { createdById: row.userId, category: 'ESPORTS', esportsOrganiserId: null }, data: { esportsOrganiserId: row.id } });
    }
    const labels: Record<string, string> = { PENDING: 'is back under review', MORE_INFO: 'needs more information', VERIFIED: 'is verified', REJECTED: 'was not approved', SUSPENDED: 'is suspended', EXPIRED: 'has expired' };
    await notify({ userId: row.userId, type: 'TOURNAMENT_UPDATE', title: `Esports organiser application ${labels[input.status]}`, body: input.note ?? row.organisationName, link: '/account/gaming?tab=tournaments&view=esports' });
    await audit(req, { action: 'update', entityType: 'esports_organisers', entityId: row.id, summary: `Esports organiser ${row.organisationName}: ${input.status}`, sensitive: true });
    res.json({ ok: true });
  }),
);

/* Sessions, squads & guilds, disputes */

r8AdminRouter.get(
  '/gaming/sessions',
  route(async (req, res) => {
    assertPermission(req, 'gaming.view');
    const rows = await prisma.gamingSession.findMany({ include: { _count: { select: { players: true } } }, orderBy: { startsAt: 'desc' }, take: 200 });
    const organisers = new Map((await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.organiserId) } }, select: { id: true, name: true, username: true } })).map((u) => [u.id, u]));
    res.json({ items: rows.map((r) => ({ id: r.id, slug: r.slug, title: r.title, game: r.game, platform: r.platform, mode: r.mode, startsAt: r.startsAt, capacity: r.capacity, players: r._count.players, status: r.status, location: r.location, organiser: organisers.get(r.organiserId) ?? null })) });
  }),
);

r8AdminRouter.post(
  '/gaming/sessions/:id/status',
  route(async (req, res) => {
    assertPermission(req, 'gaming.edit');
    const { status, reason } = z.object({ status: z.enum(['OPEN', 'HIDDEN', 'CANCELLED']), reason: z.string().trim().max(1000).optional() }).parse(req.body);
    const row = await prisma.gamingSession.update({ where: { id: req.params.id }, data: { status } });
    if (status !== 'OPEN') await notify({ userId: row.organiserId, type: 'GAMING_SESSION', title: `${status === 'HIDDEN' ? 'Hidden' : 'Cancelled'} by the Enhakkore team · ${row.title}`, body: reason ?? 'Contact support if you have questions.', link: `/account/gaming` });
    await audit(req, { action: 'update', entityType: 'gaming_sessions', entityId: row.id, summary: `Gaming session “${row.title}”: ${status}${reason ? ` — ${reason}` : ''}` });
    res.json({ ok: true });
  }),
);

r8AdminRouter.get(
  '/gaming/groups',
  route(async (req, res) => {
    assertPermission(req, 'gaming.view');
    const rows = await prisma.gamingGroup.findMany({ include: { parent: { select: { name: true } }, _count: { select: { members: { where: { status: 'ACTIVE' } }, children: true } } }, orderBy: { createdAt: 'desc' }, take: 300 });
    const owners = new Map((await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.ownerId) } }, select: { id: true, name: true, username: true } })).map((u) => [u.id, u]));
    res.json({ items: rows.map((g) => ({ id: g.id, slug: g.slug, name: g.name, kind: g.kind, game: g.game, status: g.status, guild: g.parent?.name ?? null, members: g._count.members, squads: g._count.children, owner: owners.get(g.ownerId) ?? null, createdAt: g.createdAt })) });
  }),
);

r8AdminRouter.post(
  '/gaming/groups/:id/status',
  route(async (req, res) => {
    assertPermission(req, 'gaming.edit');
    const { status, reason } = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']), reason: z.string().trim().max(1000).optional() }).parse(req.body);
    if (status === 'SUSPENDED' && !reason) throw ApiError.badRequest('Give a reason.');
    const group = await prisma.gamingGroup.update({ where: { id: req.params.id }, data: { status } });
    await notify({ userId: group.ownerId, type: 'GAMING_SESSION', title: `${status === 'SUSPENDED' ? 'Suspended' : 'Restored'} by the Enhakkore team · ${group.name}`, body: reason ?? 'Your group is active again.', link: '/account/gaming?tab=friends' });
    await audit(req, { action: 'update', entityType: 'gaming_groups', entityId: group.id, summary: `${group.kind} “${group.name}”: ${status}${reason ? ` — ${reason}` : ''}`, sensitive: true });
    res.json({ ok: true });
  }),
);

r8AdminRouter.get(
  '/gaming/disputes',
  route(async (req, res) => {
    assertPermission(req, 'gaming.view');
    const reports = await prisma.report.findMany({ where: { targetType: 'TOURNAMENT_MATCH' }, orderBy: { createdAt: 'desc' }, take: 200 });
    const matches = new Map((await prisma.tournamentMatch.findMany({ where: { id: { in: reports.map((r) => r.targetId) } }, include: { tournament: { select: { title: true, slug: true, id: true } } } })).map((m) => [m.id, m]));
    res.json({ items: reports.map((r) => ({ id: r.id, status: r.status, reason: r.details, createdAt: r.createdAt, resolution: r.resolution, match: matches.get(r.targetId) ? { id: r.targetId, round: matches.get(r.targetId)!.round, stage: matches.get(r.targetId)!.stage, homeScore: matches.get(r.targetId)!.homeScore, awayScore: matches.get(r.targetId)!.awayScore, tournament: matches.get(r.targetId)!.tournament } : null })) });
  }),
);

/** Live gaming invitations — counts and kinds only. No locations are stored beyond a rounded grid, and none are shown. */
r8AdminRouter.get(
  '/gaming/invites',
  route(async (req, res) => {
    assertPermission(req, 'gaming.view');
    const rows = await prisma.gameInvite.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { _count: { select: { responses: { where: { status: 'ACCEPTED' } }, recipients: true } } } });
    res.json({ items: rows.map((i) => ({ id: i.id, kind: i.kind, game: i.game, platform: i.platform, slotsNeeded: i.slotsNeeded, accepted: i._count.responses, notified: i._count.recipients, status: i.status, createdAt: i.createdAt, expiresAt: i.expiresAt })) });
  }),
);

/* ------------------------- Private messages (restricted) ------------------------ */

/**
 * Reported private messages. The team never browses inboxes: they open a
 * reported message, with a reason, and see only that message and a few around
 * it for context. Every opening is in the audit log.
 */
r8AdminRouter.get(
  '/messages/reports',
  route(async (req, res) => {
    assertPermission(req, 'messages.view');
    const reports = await prisma.report.findMany({ where: { targetType: { in: ['DIRECT_MESSAGE', 'DIRECT_CONVERSATION', 'MESSAGE'] } }, orderBy: { createdAt: 'desc' }, take: 200 });
    const reporters = new Map((await prisma.user.findMany({ where: { id: { in: reports.map((r) => r.reporterId).filter((id): id is string => !!id) } }, select: { id: true, name: true, username: true } })).map((u) => [u.id, u]));
    res.json({ items: reports.map((r) => ({ id: r.id, targetType: r.targetType, reason: r.reason, status: r.status, createdAt: r.createdAt, resolution: r.resolution, reporter: r.reporterId ? reporters.get(r.reporterId) ?? null : null })) });
  }),
);

r8AdminRouter.post(
  '/messages/reports/:id/open',
  route(async (req, res) => {
    assertPermission(req, 'messages.view');
    const { reason } = z.object({ reason: z.string().trim().min(10, 'Say why you need to open it (at least a sentence).').max(500) }).parse(req.body);
    const report = await prisma.report.findUniqueOrThrow({ where: { id: req.params.id } });
    let conversationId: string | null = null;
    let anchor: Date | null = null;
    if (report.targetType === 'DIRECT_CONVERSATION') conversationId = report.targetId;
    else {
      const message = await prisma.message.findUnique({ where: { id: report.targetId } });
      if (!message) throw ApiError.notFound('The reported message no longer exists.');
      conversationId = message.conversationId;
      anchor = message.createdAt;
    }
    const conversation = await prisma.conversation.findUniqueOrThrow({ where: { id: conversationId }, include: { members: { include: { user: { select: { id: true, name: true, username: true, status: true } } } } } });
    const around = anchor
      ? [
          ...(await prisma.message.findMany({ where: { conversationId, createdAt: { lt: anchor } }, orderBy: { createdAt: 'desc' }, take: 5 })).reverse(),
          ...(await prisma.message.findMany({ where: { conversationId, createdAt: { gte: anchor } }, orderBy: { createdAt: 'asc' }, take: 6 })),
        ]
      : (await prisma.message.findMany({ where: { conversationId }, orderBy: { createdAt: 'desc' }, take: 15 })).reverse();
    await audit(req, { action: 'view', entityType: 'private_messages', entityId: report.id, summary: `Opened reported ${conversation.kind === 'DIRECT' ? 'private conversation' : 'group chat'} messages. Reason: ${reason}`, sensitive: true });
    if (report.status === 'OPEN') await prisma.report.update({ where: { id: report.id }, data: { status: 'REVIEWING', handledById: req.auth!.id } });
    const names = new Map(conversation.members.map((m) => [m.userId, m.user]));
    res.json({
      kind: conversation.kind,
      members: conversation.members.map((m) => ({ id: m.user.id, name: m.user.name, username: m.user.username, status: m.user.status })),
      messages: around.map((m) => ({
        id: m.id,
        reported: m.id === report.targetId,
        author: names.get(m.userId)?.username ? `@${names.get(m.userId)!.username}` : names.get(m.userId)?.name ?? 'Member',
        authorId: m.userId,
        body: m.deletedAt ? '[unsent by the author]' : m.encrypted ? decryptText(m.body) : m.body,
        kind: m.kind,
        createdAt: m.createdAt,
      })),
    });
  }),
);

r8AdminRouter.post(
  '/messages/reports/:id/resolve',
  route(async (req, res) => {
    assertPermission(req, 'messages.edit');
    const input = z.object({ status: z.enum(['RESOLVED', 'DISMISSED']), resolution: z.string().trim().min(3).max(1000), removeMessage: z.boolean().default(false), suspendUserId: z.string().optional() }).parse(req.body);
    const report = await prisma.report.findUniqueOrThrow({ where: { id: req.params.id } });
    if (input.removeMessage && report.targetType !== 'DIRECT_CONVERSATION') {
      await prisma.message.update({ where: { id: report.targetId }, data: { deletedAt: new Date(), body: '', attachments: '[]' } }).catch(() => undefined);
    }
    if (input.suspendUserId) {
      assertPermission(req, 'members.edit');
      const target = await prisma.user.findUniqueOrThrow({ where: { id: input.suspendUserId } });
      if (target.role === 'ADMIN') throw ApiError.forbidden('The owner account cannot be suspended.');
      await prisma.user.update({ where: { id: target.id }, data: { status: 'SUSPENDED', statusReason: input.resolution } });
      await prisma.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date(), revokedBy: req.auth!.id } });
    }
    await prisma.report.update({ where: { id: report.id }, data: { status: input.status, resolution: input.resolution, handledById: req.auth!.id } });
    if (report.reporterId) await notify({ userId: report.reporterId, type: 'SYSTEM_ALERT', title: 'Your report was reviewed', body: 'Thank you. The safety team reviewed your report and took the action they judged appropriate.', link: '/account/notifications', dedupeKey: `report-closed:${report.id}` });
    await audit(req, { action: 'update', entityType: 'reports', entityId: report.id, summary: `Message report ${input.status.toLowerCase()}: ${input.resolution.slice(0, 120)}${input.removeMessage ? ' (message removed)' : ''}${input.suspendUserId ? ' (member suspended)' : ''}`, sensitive: true });
    res.json({ ok: true });
  }),
);

r8AdminRouter.get(
  '/messages/settings',
  route(async (req, res) => {
    assertPermission(req, 'messages.view');
    res.json(await readJsonSetting('messaging', MESSAGING_DEFAULTS));
  }),
);

r8AdminRouter.put(
  '/messages/settings',
  route(async (req, res) => {
    assertPermission(req, 'messages.edit');
    const input = z.object({ unsendMinutes: z.number().int().min(0).max(1440), pendingLimit: z.number().int().min(1).max(20) }).parse(req.body);
    await writeJsonSetting('messaging', input);
    await audit(req, { action: 'update', entityType: 'settings', entityId: 'messaging', summary: `Messaging settings: unsend within ${input.unsendMinutes} min, ${input.pendingLimit} messages before a request is accepted` });
    res.json({ ok: true });
  }),
);

/* -------------------------- Community / study group moderation ----------------------- */

r8AdminRouter.post(
  '/groups/:id/moderate',
  route(async (req, res) => {
    assertPermission(req, 'communities.edit');
    const input = z.object({ action: z.enum(['restrict', 'suspend', 'restore']), reason: z.string().trim().max(2000).optional() }).parse(req.body);
    if (input.action !== 'restore' && !input.reason) throw ApiError.badRequest('Give a reason (the group admins will see it).');
    const group = await prisma.community.findUniqueOrThrow({ where: { id: req.params.id } });
    const status = input.action === 'restrict' ? 'RESTRICTED' : input.action === 'suspend' ? 'SUSPENDED' : 'PUBLISHED';
    await prisma.community.update({ where: { id: group.id }, data: { status, moderationReason: input.action === 'restore' ? null : input.reason } });
    const admins = await prisma.communityMember.findMany({ where: { communityId: group.id, status: 'ACTIVE', role: { in: ['ADMIN', 'MODERATOR'] } }, select: { userId: true } });
    const words = { restrict: 'restricted (no new members for now)', suspend: 'suspended while the team looks into it', restore: 'restored' };
    await notifyMany(admins.map((a) => a.userId), { type: 'COMMUNITY_ANNOUNCEMENT', title: `${group.name} was ${words[input.action]}`, body: input.reason ?? 'It is active again.', link: `/experiences/communities/${group.slug}` });
    await audit(req, { action: 'update', entityType: 'communities', entityId: group.id, summary: `${group.kind === 'STUDY_GROUP' ? 'Study group' : 'Community'} “${group.name}” ${status.toLowerCase()}${input.reason ? ` — ${input.reason}` : ''}`, sensitive: true });
    res.json({ ok: true, status });
  }),
);

/** Creator contact of a member-created group (team only; audited). */
r8AdminRouter.get(
  '/groups/:id/contact',
  route(async (req, res) => {
    assertPermission(req, 'communities.view');
    const group = await prisma.community.findUniqueOrThrow({ where: { id: req.params.id } });
    const creator = group.createdById ? await prisma.user.findUnique({ where: { id: group.createdById }, select: { id: true, name: true, email: true, username: true } }) : null;
    await audit(req, { action: 'view', entityType: 'communities', entityId: group.id, summary: `Viewed the creator contact of “${group.name}”`, sensitive: true });
    res.json({ name: group.contactName, phone: group.contactPhone, creator, hasPassword: !!group.passwordHash });
  }),
);
