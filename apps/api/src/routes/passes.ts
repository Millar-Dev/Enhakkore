import { Router } from 'express';
import { z } from 'zod';
import { ApiError, route } from '../lib/http';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import {
  QR_PREFIX,
  canScan,
  effectiveStatus,
  hashToken,
  listingSummary,
  parseScanned,
  randomBytes,
  shortName,
  signBundle,
  syncPassesForListing,
  syncPassesForUser,
  type ListingType,
} from '../services/passes';

/**
 * Enhakkore Pass — the member's own passes, and the scanner used at the door
 * by staff and by approved organisers for their own listings.
 */
export const passesRouter = Router();
passesRouter.use(requireAuth);

const LISTING_TYPES = ['EVENT', 'ACTIVITY', 'TRIP', 'PLACE'] as const;
const listingParams = z.object({ type: z.enum(LISTING_TYPES), id: z.string().min(5).max(60) });

type PassRow = Awaited<ReturnType<typeof prisma.pass.findFirst>> & {};

function memberView(pass: PassRow) {
  return {
    id: pass.id,
    reference: pass.reference,
    title: pass.title,
    holderName: pass.holderName,
    startsAt: pass.startsAt,
    location: pass.location,
    listingType: pass.listingType,
    status: effectiveStatus(pass),
    checkedInAt: pass.checkedInAt,
    // Only the random token is encoded. The page draws the QR from this.
    qrValue: pass.qr && pass.status === 'VALID' ? `${QR_PREFIX}${pass.token}` : null,
    verification: pass.qr ? 'QR' : 'MANUAL',
  };
}

/* ------------------------------ Member passes ------------------------------ */

passesRouter.get(
  '/mine',
  route(async (req, res) => {
    await syncPassesForUser(req.auth!.id);
    const passes = await prisma.pass.findMany({ where: { userId: req.auth!.id }, orderBy: [{ startsAt: 'asc' }] });
    const items = passes.map(memberView);
    const active = items.filter((pass) => pass.status === 'VALID' || pass.status === 'CHECKED_IN');
    res.json({ items: [...active, ...items.filter((pass) => !active.includes(pass))] });
  }),
);

passesRouter.get(
  '/mine/:reference',
  route(async (req, res) => {
    await syncPassesForUser(req.auth!.id);
    const pass = await prisma.pass.findFirst({ where: { userId: req.auth!.id, reference: req.params.reference.toUpperCase() } });
    if (!pass) throw ApiError.notFound('Pass not found.');
    res.json(memberView(pass));
  }),
);

/* --------------------------------- Scanner --------------------------------- */

/** Listings this person may scan for — upcoming, with entry control switched on. */
passesRouter.get(
  '/scannable',
  route(async (req, res) => {
    const auth = req.auth!;
    const soon = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const [activities, events, departures] = await Promise.all([
      prisma.activity.findMany({ where: { verification: { not: 'NONE' }, status: { in: ['PUBLISHED', 'FULL'] }, OR: [{ startsAt: null }, { startsAt: { gte: soon } }] }, select: { id: true, title: true, startsAt: true, verification: true }, take: 100 }),
      prisma.event.findMany({ where: { status: 'PUBLISHED', startsAt: { gte: soon } }, select: { id: true, title: true, startsAt: true, verification: true }, take: 100 }),
      prisma.tripDate.findMany({ where: { startDate: { gte: soon }, trip: { stage: { in: ['TRIP_CONFIRMED', 'DEPARTURE_READY'] } } }, include: { trip: { select: { title: true } } }, take: 100 }),
    ]);
    const rows: { type: ListingType; id: string; title: string; startsAt: Date | null; verification: string }[] = [
      ...activities.map((row) => ({ type: 'ACTIVITY' as const, ...row })),
      ...events.map((row) => ({ type: 'EVENT' as const, ...row })),
      ...departures.map((row) => ({ type: 'TRIP' as const, id: row.id, title: row.trip.title, startsAt: row.startDate, verification: 'QR' })),
    ];
    const allowed = [];
    for (const row of rows) if (await canScan(auth, row.type, row.id)) allowed.push(row);
    allowed.sort((a, b) => (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0));
    res.json({ items: allowed });
  }),
);

async function assertScanner(req: Parameters<Parameters<typeof route>[0]>[0], type: ListingType, id: string) {
  if (!(await canScan(req.auth!, type, id))) throw ApiError.forbidden('You cannot check people in for this listing.');
}

/** What the scanner may see about a pass: no phone, email or identity details. */
function scannerView(pass: PassRow, username?: string | null) {
  return {
    id: pass.id,
    reference: pass.reference,
    holderName: pass.holderName,
    username: username ?? null,
    title: pass.title,
    startsAt: pass.startsAt,
    status: effectiveStatus(pass),
    checkedInAt: pass.checkedInAt,
  };
}

const verifySchema = z.object({
  listingType: z.enum(LISTING_TYPES),
  listingId: z.string().min(5).max(60),
  code: z.string().trim().min(4).max(200),
  /** false only looks the pass up without checking the person in. */
  checkIn: z.boolean().default(true),
});

/**
 * Checks a scanned QR or a typed pass reference. Every attempt is logged.
 * Results: VALID, ALREADY_CHECKED_IN, CANCELLED, EXPIRED, NOT_FOUND, REVIEW.
 */
passesRouter.post(
  '/verify',
  route(async (req, res) => {
    const input = verifySchema.parse(req.body);
    await assertScanner(req, input.listingType, input.listingId);
    const result = await verifyOne(req.auth!.id, input.listingType, input.listingId, input.code, input.checkIn, false);
    res.json(result);
  }),
);

async function verifyOne(scannerId: string, listingType: ListingType, listingId: string, code: string, checkIn: boolean, offline: boolean, scannedAt?: Date) {
  const lookup = parseScanned(code);
  const pass = await prisma.pass.findFirst({ where: lookup.token ? { token: lookup.token } : { reference: lookup.reference } });
  const log = (result: string, passId: string | null) =>
    prisma.passScan.create({ data: { passId, attempted: lookup.reference ?? `token:${(lookup.token ?? '').slice(0, 6)}…`, result, scannedById: scannerId, offline, ...(scannedAt ? { scannedAt } : {}) } });

  // A pass for a different listing is not revealed: it reads as "not found" here.
  if (!pass || pass.listingType !== listingType || pass.listingId !== listingId) {
    await log('NOT_FOUND', null);
    return { result: 'NOT_FOUND' as const, pass: null };
  }
  const username = pass.userId ? (await prisma.user.findUnique({ where: { id: pass.userId }, select: { username: true } }))?.username : null;
  const status = effectiveStatus(pass);
  let result: string;
  if (status === 'CANCELLED') result = 'CANCELLED';
  else if (status === 'EXPIRED') result = 'EXPIRED';
  else if (status === 'CHECKED_IN') result = 'ALREADY_CHECKED_IN';
  else if (lookup.reference && pass.qr) result = 'REVIEW'; // typed reference for a QR pass: staff confirm identity
  else result = 'VALID';

  let current = pass;
  if (result === 'VALID' && checkIn) {
    const updated = await prisma.pass.updateMany({ where: { id: pass.id, status: 'VALID' }, data: { status: 'CHECKED_IN', checkedInAt: scannedAt ?? new Date(), checkedInById: scannerId } });
    if (updated.count === 0) result = 'ALREADY_CHECKED_IN';
    current = (await prisma.pass.findUnique({ where: { id: pass.id } }))!;
    if (updated.count) await markAttendance(current);
  }
  await log(result, pass.id);
  return { result, pass: scannerView(current, username) };
}

/** Keeps the existing attendance records in step with a check-in. */
async function markAttendance(pass: PassRow) {
  if (pass.subjectType === 'SESSION_REGISTRATION') await prisma.sessionRegistration.updateMany({ where: { id: pass.subjectId }, data: { attended: true } });
  if (pass.subjectType === 'EVENT_REGISTRATION')
    await prisma.eventRegistration.updateMany({ where: { id: pass.subjectId, checkedInAt: null }, data: { checkedInAt: pass.checkedInAt ?? new Date(), checkedInCount: { increment: 1 } } });
}

/** Manual check-in after staff confirm identity (for REVIEW results or manual-only listings). */
passesRouter.post(
  '/:id/check-in',
  route(async (req, res) => {
    const pass = await prisma.pass.findUnique({ where: { id: req.params.id } });
    if (!pass) throw ApiError.notFound('Pass not found.');
    await assertScanner(req, pass.listingType as ListingType, pass.listingId);
    const status = effectiveStatus(pass);
    let result = status === 'VALID' ? 'VALID' : status === 'CHECKED_IN' ? 'ALREADY_CHECKED_IN' : status;
    if (status === 'VALID') {
      const updated = await prisma.pass.updateMany({ where: { id: pass.id, status: 'VALID' }, data: { status: 'CHECKED_IN', checkedInAt: new Date(), checkedInById: req.auth!.id } });
      if (!updated.count) result = 'ALREADY_CHECKED_IN';
    }
    const current = (await prisma.pass.findUnique({ where: { id: pass.id } }))!;
    if (result === 'VALID') await markAttendance(current);
    await prisma.passScan.create({ data: { passId: pass.id, attempted: `MANUAL:${pass.reference}`, result, scannedById: req.auth!.id } });
    res.json({ result, pass: scannerView(current) });
  }),
);

/** Attendee list for one listing, searchable by reference, name or username. */
passesRouter.get(
  '/listing/:type/:id',
  route(async (req, res) => {
    const { type, id } = listingParams.parse(req.params);
    await assertScanner(req, type, id);
    await syncPassesForListing(type, id);
    const q = String(req.query.q ?? '').trim();
    const passes = await prisma.pass.findMany({ where: { listingType: type, listingId: id }, orderBy: { holderName: 'asc' }, take: 1000 });
    const users = await prisma.user.findMany({ where: { id: { in: passes.map((p) => p.userId).filter((v): v is string => !!v) } }, select: { id: true, username: true } });
    const names = new Map(users.map((u) => [u.id, u.username]));
    const needle = q.toLowerCase();
    const items = passes
      .map((pass) => scannerView(pass, pass.userId ? names.get(pass.userId) : null))
      .filter((pass) => !needle || pass.reference.toLowerCase().includes(needle) || pass.holderName.toLowerCase().includes(needle) || (pass.username ?? '').includes(needle));
    const counts = {
      total: passes.length,
      checkedIn: passes.filter((p) => p.status === 'CHECKED_IN').length,
      cancelled: passes.filter((p) => p.status === 'CANCELLED').length,
    };
    res.json({ listing: await listingSummary(type, id), counts, items: items.slice(0, 200) });
  }),
);

/** Scan history for a listing — the audit trail. */
passesRouter.get(
  '/listing/:type/:id/scans',
  route(async (req, res) => {
    const { type, id } = listingParams.parse(req.params);
    await assertScanner(req, type, id);
    const scans = await prisma.passScan.findMany({
      where: { pass: { listingType: type, listingId: id } },
      include: { pass: { select: { reference: true, holderName: true } } },
      orderBy: { scannedAt: 'desc' },
      take: 300,
    });
    const scanners = await prisma.user.findMany({ where: { id: { in: [...new Set(scans.map((s) => s.scannedById))] } }, select: { id: true, name: true } });
    const who = new Map(scanners.map((u) => [u.id, u.name]));
    res.json({
      items: scans.map((scan) => ({ id: scan.id, result: scan.result, offline: scan.offline, scannedAt: scan.scannedAt, reference: scan.pass?.reference ?? null, holderName: scan.pass?.holderName ?? null, scannedBy: who.get(scan.scannedById) ?? '—' })),
    });
  }),
);

/* ------------------------------- Offline mode ------------------------------ */

const OFFLINE_HOURS = 12;

/**
 * A signed, time-limited list for checking people in without a connection.
 * Tokens are stored only as salted hashes, so the list cannot be turned back
 * into working QR codes, and holders appear as "First L." only. Results while
 * offline are provisional until synced.
 */
passesRouter.get(
  '/listing/:type/:id/offline',
  route(async (req, res) => {
    const { type, id } = listingParams.parse(req.params);
    await assertScanner(req, type, id);
    await syncPassesForListing(type, id);
    const passes = await prisma.pass.findMany({ where: { listingType: type, listingId: id } });
    const salt = randomBytes(12).toString('base64url');
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + OFFLINE_HOURS * 60 * 60 * 1000);
    const entries = passes.map((pass) => ({ h: hashToken(pass.token, salt), ref: pass.reference, name: shortName(pass.holderName), status: effectiveStatus(pass) }));
    const body = { listingType: type, listingId: id, salt, issuedAt: issuedAt.toISOString(), expiresAt: expiresAt.toISOString(), entries };
    res.json({ ...body, signature: signBundle(JSON.stringify(body)) });
  }),
);

const syncSchema = z.object({
  listingType: z.enum(LISTING_TYPES),
  listingId: z.string().min(5).max(60),
  scans: z.array(z.object({ code: z.string().trim().min(4).max(200), scannedAt: z.string().datetime() })).max(2000),
});

/** Uploads offline scans. Each is checked against the server and the true result returned. */
passesRouter.post(
  '/offline-sync',
  route(async (req, res) => {
    const input = syncSchema.parse(req.body);
    await assertScanner(req, input.listingType, input.listingId);
    const results = [];
    for (const scan of input.scans) {
      const when = new Date(scan.scannedAt);
      const scannedAt = when.getTime() > Date.now() ? new Date() : when;
      const outcome = await verifyOne(req.auth!.id, input.listingType, input.listingId, scan.code, true, true, scannedAt);
      results.push({ code: scan.code.startsWith(QR_PREFIX) ? 'QR' : scan.code, scannedAt: scan.scannedAt, ...outcome });
    }
    res.json({ results });
  }),
);
