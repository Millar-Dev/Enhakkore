import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { ApiError, route } from '../lib/http';
import { prisma } from '../lib/prisma';
import { textContains } from '../lib/search';
import { requireAuth } from '../middleware/auth';
import { recordActivity } from '../services/activity';
import { notify } from '../services/notifications';
import {
  LOCATION_FRESH_MS,
  PUBLIC_MEMBER,
  blockedEither,
  blockedSet,
  distanceBand,
  distanceKm,
  isAdult,
  toGrid,
} from '../services/social';

/**
 * Friends (Game Friends), follows, player discovery and the member's
 * approximate location.
 *
 * Friendship needs the other person's acceptance. Following is one-way;
 * follows in both directions let either person send a message request.
 * Location: a member may share an approximate position (rounded to about
 * 500 m) for nearby features. It is never shown to anyone; friends only see a
 * distance band, and only when the friend switched "show friends my
 * approximate distance" on.
 */
export const socialRouter = Router();
socialRouter.use(requireAuth);

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 10_000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many requests. Try again later.' } },
});

const card = (user: { id: string; name: string; username: string | null; avatarUrl: string | null; city: string | null; country: string | null; headline: string | null; gamingProfile?: string }) => {
  let gaming: { games?: string[]; platforms?: string[] } = {};
  try {
    gaming = JSON.parse(user.gamingProfile || '{}');
  } catch {
    /* ignore */
  }
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    avatarUrl: user.avatarUrl,
    city: user.city,
    country: user.country,
    headline: user.headline,
    games: Array.isArray(gaming.games) ? gaming.games.slice(0, 6) : [],
    platforms: Array.isArray(gaming.platforms) ? gaming.platforms.slice(0, 4) : [],
  };
};

async function findTarget(input: { userId?: string; username?: string }) {
  const user = input.userId
    ? await prisma.user.findUnique({ where: { id: input.userId } })
    : input.username
      ? await prisma.user.findUnique({ where: { username: input.username.replace(/^@/, '').toLowerCase() } })
      : null;
  if (!user || user.status !== 'ACTIVE') throw ApiError.notFound('That member is not available.');
  return user;
}

/* ---------------------------------- Friends --------------------------------- */

socialRouter.get(
  '/friends',
  route(async (req, res) => {
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.id }, select: { approxLat: true, approxLng: true, approxLocatedAt: true } });
    const rows = await prisma.connection.findMany({
      where: { OR: [{ requesterId: req.auth!.id }, { addresseeId: req.auth!.id }], status: { in: ['PENDING', 'ACCEPTED'] } },
      include: {
        requester: { select: { ...PUBLIC_MEMBER, gamingProfile: true, friendLocation: true, approxLat: true, approxLng: true, approxLocatedAt: true } },
        addressee: { select: { ...PUBLIC_MEMBER, gamingProfile: true, friendLocation: true, approxLat: true, approxLng: true, approxLocatedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const fresh = (at: Date | null) => !!at && Date.now() - at.getTime() < LOCATION_FRESH_MS;
    const view = (row: (typeof rows)[number]) => {
      const other = row.requesterId === req.auth!.id ? row.addressee : row.requester;
      // A distance band only when the friend allowed it and both positions are recent.
      const distance =
        row.status === 'ACCEPTED' && other.friendLocation && fresh(other.approxLocatedAt) && fresh(me.approxLocatedAt) && other.approxLat !== null && me.approxLat !== null
          ? distanceBand(distanceKm(me.approxLat!, me.approxLng!, other.approxLat!, other.approxLng!))
          : null;
      return { id: row.id, status: row.status, since: row.respondedAt ?? row.createdAt, member: card(other), distance };
    };
    res.json({
      friends: rows.filter((row) => row.status === 'ACCEPTED').map(view),
      incoming: rows.filter((row) => row.status === 'PENDING' && row.addresseeId === req.auth!.id).map(view),
      outgoing: rows.filter((row) => row.status === 'PENDING' && row.requesterId === req.auth!.id).map(view),
    });
  }),
);

socialRouter.post(
  '/friends',
  limiter,
  route(async (req, res) => {
    const input = z.object({ userId: z.string().min(5).optional(), username: z.string().min(2).max(30).optional(), context: z.string().max(80).optional() }).parse(req.body);
    const target = await findTarget(input);
    if (target.id === req.auth!.id) throw ApiError.badRequest('That is you.');
    if (await blockedEither(req.auth!.id, target.id)) throw ApiError.notFound('That member is not available.');
    const reverse = await prisma.connection.findUnique({ where: { requesterId_addresseeId: { requesterId: target.id, addresseeId: req.auth!.id } } });
    if (reverse?.status === 'ACCEPTED') return res.json({ id: reverse.id, status: 'ACCEPTED' });
    if (reverse?.status === 'PENDING') {
      // They already asked: sending one back accepts it.
      const accepted = await prisma.connection.update({ where: { id: reverse.id }, data: { status: 'ACCEPTED', respondedAt: new Date() } });
      await afterAccepted(req.auth!.id, req.auth!.name, target.id, target.name);
      return res.json({ id: accepted.id, status: accepted.status });
    }
    const existing = await prisma.connection.findUnique({ where: { requesterId_addresseeId: { requesterId: req.auth!.id, addresseeId: target.id } } });
    const connection = existing
      ? existing.status === 'DECLINED' && existing.respondedAt && Date.now() - existing.respondedAt.getTime() > 30 * 24 * 3600 * 1000
        ? await prisma.connection.update({ where: { id: existing.id }, data: { status: 'PENDING', respondedAt: null, createdAt: new Date() } })
        : existing
      : await prisma.connection.create({ data: { requesterId: req.auth!.id, addresseeId: target.id } });
    if (connection.status === 'PENDING') {
      await notify({
        userId: target.id,
        type: 'FRIEND_REQUEST',
        title: 'New friend request',
        body: `${req.auth!.name} sent you a friend request${input.context ? ` after ${input.context}` : ''}.`,
        link: '/account/gaming?tab=friends&view=requests',
        dedupeKey: `friend-request:${connection.id}:${connection.createdAt.getTime()}`,
      });
    }
    // A declined request stays declined for 30 days; the sender is not told it was declined.
    res.status(201).json({ id: connection.id, status: connection.status === 'DECLINED' ? 'PENDING' : connection.status });
  }),
);

async function afterAccepted(meId: string, meName: string, otherId: string, otherName: string) {
  await notify({ userId: otherId, type: 'FRIEND_ACCEPTED', title: 'Friend request accepted', body: `${meName} accepted your friend request. You can now message each other.`, link: '/account/gaming?tab=friends', dedupeKey: `friend-accepted:${[meId, otherId].sort().join(':')}` });
  await recordActivity({ userId: meId, action: 'FRIEND_ADDED', title: `Became friends with ${otherName}`, link: '/account/gaming?tab=friends', subjectType: 'USER', subjectId: otherId });
  await recordActivity({ userId: otherId, action: 'FRIEND_ADDED', title: `Became friends with ${meName}`, link: '/account/gaming?tab=friends', subjectType: 'USER', subjectId: meId });
}

socialRouter.post(
  '/friends/:id/respond',
  route(async (req, res) => {
    const { accept } = z.object({ accept: z.boolean() }).parse(req.body);
    const connection = await prisma.connection.findUnique({ where: { id: req.params.id }, include: { requester: { select: { name: true } } } });
    if (!connection || connection.addresseeId !== req.auth!.id || connection.status !== 'PENDING') throw ApiError.notFound('That request is no longer open.');
    await prisma.connection.update({ where: { id: connection.id }, data: { status: accept ? 'ACCEPTED' : 'DECLINED', respondedAt: new Date() } });
    if (accept) await afterAccepted(req.auth!.id, req.auth!.name, connection.requesterId, connection.requester.name);
    res.json({ ok: true, status: accept ? 'ACCEPTED' : 'DECLINED' });
  }),
);

/** Remove a friend or cancel a request you sent. */
socialRouter.delete(
  '/friends/:id',
  route(async (req, res) => {
    const connection = await prisma.connection.findUnique({ where: { id: req.params.id } });
    if (!connection || (connection.requesterId !== req.auth!.id && connection.addresseeId !== req.auth!.id)) throw ApiError.notFound();
    await prisma.connection.delete({ where: { id: connection.id } });
    res.json({ ok: true });
  }),
);

/* ---------------------------------- Follows --------------------------------- */

socialRouter.get(
  '/follows',
  route(async (req, res) => {
    const [following, followers] = await Promise.all([
      prisma.follow.findMany({ where: { followerId: req.auth!.id }, include: { following: { select: PUBLIC_MEMBER } }, orderBy: { createdAt: 'desc' }, take: 500 }),
      prisma.follow.findMany({ where: { followingId: req.auth!.id }, include: { follower: { select: PUBLIC_MEMBER } }, orderBy: { createdAt: 'desc' }, take: 500 }),
    ]);
    const followingIds = new Set(following.map((row) => row.followingId));
    const followerIds = new Set(followers.map((row) => row.followerId));
    res.json({
      following: following.map((row) => ({ ...card(row.following), mutual: followerIds.has(row.followingId) })),
      followers: followers.map((row) => ({ ...card(row.follower), mutual: followingIds.has(row.followerId) })),
    });
  }),
);

socialRouter.post(
  '/follows/:userId',
  limiter,
  route(async (req, res) => {
    const target = await findTarget({ userId: req.params.userId });
    if (target.id === req.auth!.id) throw ApiError.badRequest('That is you.');
    if (await blockedEither(req.auth!.id, target.id)) throw ApiError.notFound('That member is not available.');
    const existing = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: req.auth!.id, followingId: target.id } } });
    if (!existing) {
      await prisma.follow.create({ data: { followerId: req.auth!.id, followingId: target.id } });
      await notify({ userId: target.id, type: 'NEW_FOLLOWER', title: 'New follower', body: `${req.auth!.name} started following you.`, link: req.auth!.id ? `/members/${req.auth!.id}` : null, dedupeKey: `follow:${req.auth!.id}` });
    }
    const back = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: target.id, followingId: req.auth!.id } } });
    res.status(201).json({ following: true, mutual: !!back });
  }),
);

socialRouter.delete(
  '/follows/:userId',
  route(async (req, res) => {
    await prisma.follow.deleteMany({ where: { followerId: req.auth!.id, followingId: req.params.userId } });
    res.json({ following: false });
  }),
);

/** Relationship with one member: drives the buttons on their profile. */
socialRouter.get(
  '/relationship/:userId',
  route(async (req, res) => {
    const other = req.params.userId;
    const [iFollow, followsMe, friendship, blocked, conversation] = await Promise.all([
      prisma.follow.findUnique({ where: { followerId_followingId: { followerId: req.auth!.id, followingId: other } } }),
      prisma.follow.findUnique({ where: { followerId_followingId: { followerId: other, followingId: req.auth!.id } } }),
      prisma.connection.findFirst({ where: { OR: [{ requesterId: req.auth!.id, addresseeId: other }, { requesterId: other, addresseeId: req.auth!.id }], status: { in: ['PENDING', 'ACCEPTED'] } } }),
      prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: req.auth!.id, blockedId: other } } }),
      prisma.conversation.findUnique({ where: { directKey: [req.auth!.id, other].sort().join(':') }, select: { id: true, requestStatus: true } }),
    ]);
    res.json({
      following: !!iFollow,
      followsYou: !!followsMe,
      friend: friendship?.status === 'ACCEPTED',
      friendRequest: friendship?.status === 'PENDING' ? { id: friendship.id, incoming: friendship.addresseeId === req.auth!.id } : null,
      blocked: !!blocked,
      canMessage: !blocked && (friendship?.status === 'ACCEPTED' || (!!iFollow && !!followsMe)),
      conversation,
    });
  }),
);

/* ------------------------------ Player discovery ----------------------------- */

socialRouter.get(
  '/players',
  route(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
    const game = typeof req.query.game === 'string' ? req.query.game.trim().slice(0, 60) : '';
    const blocked = await blockedSet(req.auth!.id);
    const rows = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        id: { notIn: [req.auth!.id, ...blocked] },
        profileVisibility: { not: 'HIDDEN' },
        role: { in: ['TRAVELER', 'ORGANIZER', 'STAFF', 'ADMIN'] },
        ...(q ? { OR: [{ username: textContains(q.replace(/^@/, '').toLowerCase()) }, { name: textContains(q) }] } : {}),
        ...(game ? { gamingProfile: textContains(game) } : q ? {} : { gamingProfile: { not: '{}' } }),
      },
      select: { ...PUBLIC_MEMBER, gamingProfile: true },
      orderBy: { lastLoginAt: 'desc' },
      take: 40,
    });
    res.json({ items: rows.map(card) });
  }),
);

/* ---------------------------- Gaming profile & place ------------------------- */

socialRouter.get(
  '/me',
  route(async (req, res) => {
    const me = await prisma.user.findUniqueOrThrow({
      where: { id: req.auth!.id },
      select: { gamingProfile: true, nearbyGaming: true, friendLocation: true, readReceipts: true, approxLocatedAt: true, dateOfBirth: true },
    });
    let gaming = {};
    try {
      gaming = JSON.parse(me.gamingProfile || '{}');
    } catch {
      /* ignore */
    }
    res.json({
      gaming,
      nearbyGaming: me.nearbyGaming,
      friendLocation: me.friendLocation,
      readReceipts: me.readReceipts,
      locationRecent: !!me.approxLocatedAt && Date.now() - me.approxLocatedAt.getTime() < LOCATION_FRESH_MS,
      adult: isAdult(me.dateOfBirth),
      hasDateOfBirth: !!me.dateOfBirth,
    });
  }),
);

socialRouter.put(
  '/me',
  route(async (req, res) => {
    const input = z
      .object({
        gaming: z
          .object({
            games: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
            platforms: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
            gamerTags: z.record(z.string().max(40), z.string().max(60)).default({}),
          })
          .optional(),
        nearbyGaming: z.boolean().optional(),
        friendLocation: z.boolean().optional(),
        readReceipts: z.boolean().optional(),
      })
      .parse(req.body);
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.id }, select: { dateOfBirth: true } });
    if (input.nearbyGaming && !isAdult(me.dateOfBirth)) {
      throw ApiError.forbidden(me.dateOfBirth ? 'Nearby gaming invitations are for members aged 18 and over.' : 'Add your date of birth in your profile first — nearby invitations are for members aged 18 and over.');
    }
    await prisma.user.update({
      where: { id: req.auth!.id },
      data: {
        ...(input.gaming ? { gamingProfile: JSON.stringify(input.gaming) } : {}),
        ...(input.nearbyGaming !== undefined ? { nearbyGaming: input.nearbyGaming, ...(input.nearbyGaming ? {} : { approxLat: null, approxLng: null, approxLocatedAt: null }) } : {}),
        ...(input.friendLocation !== undefined ? { friendLocation: input.friendLocation } : {}),
        ...(input.readReceipts !== undefined ? { readReceipts: input.readReceipts } : {}),
      },
    });
    res.json({ ok: true });
  }),
);

/**
 * Updates the member's approximate position (from the browser, with their
 * permission). Stored rounded to about 500 m; exact coordinates are discarded.
 */
socialRouter.post(
  '/location',
  limiter,
  route(async (req, res) => {
    const input = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).parse(req.body);
    const grid = toGrid(input.lat, input.lng);
    await prisma.user.update({ where: { id: req.auth!.id }, data: { approxLat: grid.lat, approxLng: grid.lng, approxLocatedAt: new Date() } });
    res.json({ ok: true });
  }),
);

socialRouter.delete(
  '/location',
  route(async (req, res) => {
    await prisma.user.update({ where: { id: req.auth!.id }, data: { approxLat: null, approxLng: null, approxLocatedAt: null } });
    res.json({ ok: true });
  }),
);
