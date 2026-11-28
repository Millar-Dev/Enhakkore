import { createHash, createHmac, randomBytes } from 'node:crypto';
import { hasPermission } from '@enhakkore/shared';
import { env } from '../env';
import { prisma } from '../lib/prisma';
import { shortCode } from '../lib/ids';
import type { AuthUser } from '../middleware/auth';

/**
 * Enhakkore Pass.
 *
 * A pass is issued only where entry is controlled: paid or verified events,
 * activities whose organiser chose QR or manual check-in, confirmed trips and
 * hotel or restaurant reservations the business has accepted. Ordinary free
 * activities get no pass.
 *
 * The QR code carries only a random token ("ENH1.<token>"). No name, phone,
 * email, identity number or password is ever inside it; the scanner looks the
 * token up on the server.
 */

export type ListingType = 'EVENT' | 'ACTIVITY' | 'TRIP' | 'PLACE';
export const QR_PREFIX = 'ENH1.';
/** A pass stops working this long after its start time. */
const GRACE_MS = 36 * 60 * 60 * 1000;

interface Candidate {
  subjectType: string;
  subjectId: string;
  listingType: ListingType;
  listingId: string;
  title: string;
  startsAt: Date | null;
  location: string | null;
  qr: boolean;
}

const newToken = () => randomBytes(18).toString('base64url');
const newReference = () => `PASS-${shortCode(8)}`;

async function candidatesFor(userId: string): Promise<Candidate[]> {
  const [eventRegs, participants, sessionRegs, bookings, reservations] = await Promise.all([
    prisma.eventRegistration.findMany({ where: { userId, status: 'CONFIRMED' }, include: { event: true } }),
    prisma.activityParticipant.findMany({ where: { userId, status: 'APPROVED' }, include: { activity: true } }),
    prisma.sessionRegistration.findMany({ where: { userId, status: 'REGISTERED' }, include: { session: { include: { activity: true } } } }),
    prisma.booking.findMany({ where: { userId, status: 'CONFIRMED' }, include: { trip: true, departure: true } }),
    prisma.enquiry.findMany({ where: { userId, type: { in: ['TABLE', 'ROOM', 'VENUE'] }, status: 'CONFIRMED' } }),
  ]);
  const out: Candidate[] = [];
  for (const row of eventRegs) {
    const paid = row.amountDue > 0;
    if (row.event.verification === 'NONE' && !paid) continue;
    out.push({
      subjectType: 'EVENT_REGISTRATION',
      subjectId: row.id,
      listingType: 'EVENT',
      listingId: row.eventId,
      title: row.event.title,
      startsAt: row.event.startsAt,
      location: row.event.venue ?? null,
      qr: row.event.verification !== 'MANUAL',
    });
  }
  for (const row of participants) {
    if (row.activity.verification === 'NONE') continue;
    out.push({
      subjectType: 'ACTIVITY_PARTICIPANT',
      subjectId: row.id,
      listingType: 'ACTIVITY',
      listingId: row.activityId,
      title: row.activity.title,
      startsAt: row.activity.startsAt,
      location: row.activity.mode === 'ONLINE' ? 'Online' : row.activity.meetingPoint,
      qr: row.activity.verification === 'QR',
    });
  }
  for (const row of sessionRegs) {
    const activity = row.session.activity;
    if (activity.verification === 'NONE' || row.session.status === 'CANCELLED') continue;
    out.push({
      subjectType: 'SESSION_REGISTRATION',
      subjectId: row.id,
      listingType: 'ACTIVITY',
      listingId: activity.id,
      title: activity.title,
      startsAt: row.session.startsAt,
      location: row.session.meetingPoint ?? activity.meetingPoint,
      qr: activity.verification === 'QR',
    });
  }
  for (const row of bookings) {
    // A trip pass exists only once the trip itself is confirmed.
    if (!['TRIP_CONFIRMED', 'DEPARTURE_READY'].includes(row.trip.stage)) continue;
    out.push({
      subjectType: 'BOOKING',
      subjectId: row.id,
      listingType: 'TRIP',
      listingId: row.tripDateId,
      title: row.trip.title,
      startsAt: row.departure.startDate,
      location: row.trip.meetingPoint ?? row.trip.departureCity ?? null,
      qr: true,
    });
  }
  for (const row of reservations) {
    if (!row.subjectId) continue;
    out.push({
      subjectType: 'ENQUIRY',
      subjectId: row.id,
      listingType: 'PLACE',
      listingId: row.subjectId,
      title: row.subjectTitle ?? (row.type === 'ROOM' ? 'Room reservation' : row.type === 'VENUE' ? 'Venue booking' : 'Table reservation'),
      startsAt: row.startDate,
      location: row.subjectTitle,
      qr: true,
    });
  }
  return out;
}

/**
 * Brings a member's passes in line with their confirmed bookings: issues new
 * passes, cancels passes whose booking was cancelled, and re-issues a pass
 * (new token, so the old QR stops working) when the date or place changed.
 */
export async function syncPassesForUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, username: true } });
  if (!user) return;
  const holderName = user.name;
  const candidates = await candidatesFor(userId);
  const existing = await prisma.pass.findMany({ where: { userId } });
  const byKey = new Map(existing.map((pass) => [`${pass.subjectType}:${pass.subjectId}`, pass]));
  const keep = new Set<string>();

  for (const item of candidates) {
    const key = `${item.subjectType}:${item.subjectId}`;
    keep.add(key);
    const current = byKey.get(key);
    if (!current) {
      await prisma.pass
        .create({ data: { ...item, userId, holderName, reference: newReference(), token: newToken() } })
        .catch(() => undefined); // a parallel request created it first
      continue;
    }
    const changed =
      (current.startsAt?.getTime() ?? 0) !== (item.startsAt?.getTime() ?? 0) ||
      (current.location ?? '') !== (item.location ?? '') ||
      current.qr !== item.qr;
    const reopened = current.status === 'CANCELLED';
    if (changed || reopened || current.title !== item.title || current.holderName !== holderName) {
      await prisma.pass.update({
        where: { id: current.id },
        data: {
          title: item.title,
          startsAt: item.startsAt,
          location: item.location,
          qr: item.qr,
          holderName,
          ...(changed || reopened ? { token: newToken(), status: current.status === 'CHECKED_IN' && !changed ? 'CHECKED_IN' : 'VALID', checkedInAt: changed ? null : current.checkedInAt } : {}),
        },
      });
    }
  }
  const stale = existing.filter((pass) => !keep.has(`${pass.subjectType}:${pass.subjectId}`) && pass.status === 'VALID');
  if (stale.length) await prisma.pass.updateMany({ where: { id: { in: stale.map((pass) => pass.id) } }, data: { status: 'CANCELLED' } });
}

/** Members holding a booking on this listing — their passes are synced before scanning. */
async function holdersOf(listingType: ListingType, listingId: string): Promise<string[]> {
  const ids = (rows: { userId: string | null }[]) => rows.map((row) => row.userId).filter((id): id is string => !!id);
  switch (listingType) {
    case 'EVENT':
      return ids(await prisma.eventRegistration.findMany({ where: { eventId: listingId }, select: { userId: true } }));
    case 'ACTIVITY': {
      const [a, b] = await Promise.all([
        prisma.activityParticipant.findMany({ where: { activityId: listingId }, select: { userId: true } }),
        prisma.sessionRegistration.findMany({ where: { session: { activityId: listingId } }, select: { userId: true } }),
      ]);
      return [...new Set([...ids(a), ...ids(b)])];
    }
    case 'TRIP':
      return ids(await prisma.booking.findMany({ where: { tripDateId: listingId }, select: { userId: true } }));
    case 'PLACE':
      return ids(await prisma.enquiry.findMany({ where: { subjectId: listingId, type: { in: ['TABLE', 'ROOM', 'VENUE'] } }, select: { userId: true } }));
  }
}

export async function syncPassesForListing(listingType: ListingType, listingId: string) {
  const users = [...new Set(await holdersOf(listingType, listingId))];
  for (const userId of users) await syncPassesForUser(userId);
}

/** Effective status: a pass past its time reads as expired. */
export function effectiveStatus(pass: { status: string; startsAt: Date | null }) {
  if (pass.status === 'VALID' && pass.startsAt && pass.startsAt.getTime() + GRACE_MS < Date.now()) return 'EXPIRED';
  return pass.status;
}

/** Who may scan for a listing: staff with the module's edit permission, or the listing's own organiser. */
export async function canScan(auth: AuthUser, listingType: ListingType, listingId: string): Promise<boolean> {
  const module = { EVENT: 'events', ACTIVITY: 'activities', TRIP: 'trips', PLACE: 'places' }[listingType];
  if (hasPermission(auth.permissions, `${module}.edit`) && auth.scope !== 'OWN') return true;
  if (listingType === 'ACTIVITY') {
    const activity = await prisma.activity.findUnique({ where: { id: listingId }, select: { organiserUserId: true } });
    return activity?.organiserUserId === auth.id;
  }
  if (listingType === 'EVENT') {
    const event = await prisma.event.findUnique({ where: { id: listingId }, select: { managerId: true } });
    return !!event?.managerId && event.managerId === auth.id;
  }
  return false;
}

export function parseScanned(raw: string) {
  const value = raw.trim();
  if (value.startsWith(QR_PREFIX)) return { token: value.slice(QR_PREFIX.length) };
  if (/^PASS-[A-Z0-9]{8}$/i.test(value)) return { reference: value.toUpperCase() };
  return { token: value };
}

export const hashToken = (token: string, salt: string) => createHash('sha256').update(`${salt}:${token}`).digest('base64url');

export function signBundle(payload: string) {
  return createHmac('sha256', env.jwtSecret).update(`offline-bundle:${payload}`).digest('base64url');
}

/** "Amina K." — enough to match a face, without the full name on a stored list. */
export function shortName(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.pop();
  return last ? `${first} ${last[0]}.` : first;
}

export async function listingSummary(listingType: ListingType, listingId: string) {
  switch (listingType) {
    case 'EVENT': {
      const row = await prisma.event.findUnique({ where: { id: listingId }, select: { title: true, startsAt: true, verification: true } });
      return row ? { title: row.title, startsAt: row.startsAt, verification: row.verification } : null;
    }
    case 'ACTIVITY': {
      const row = await prisma.activity.findUnique({ where: { id: listingId }, select: { title: true, startsAt: true, verification: true } });
      return row ? { title: row.title, startsAt: row.startsAt, verification: row.verification } : null;
    }
    case 'TRIP': {
      const row = await prisma.tripDate.findUnique({ where: { id: listingId }, include: { trip: { select: { title: true } } } });
      return row ? { title: row.trip.title, startsAt: row.startDate, verification: 'QR' } : null;
    }
    case 'PLACE': {
      const row = await prisma.place.findUnique({ where: { id: listingId }, select: { name: true } });
      return row ? { title: row.name, startsAt: null, verification: 'QR' } : null;
    }
  }
}

export { randomBytes };
