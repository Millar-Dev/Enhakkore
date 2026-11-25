import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from '@enhakkore/shared';
import { ApiError, pageParams, paginated, route } from '../../lib/http';
import { parseList } from '../../lib/json';
import { prisma } from '../../lib/prisma';
import { textContains } from '../../lib/search';
import { assertPermission, can, requireAdmin } from '../../middleware/auth';
import { audit } from '../../services/audit';
import { sendCsv } from './finance';

/**
 * Customers, members, staff, roles and the security centre.
 *
 * Member details are shown only to people whose role covers members, and
 * opening one person's full record is itself written to the audit trail.
 * Passwords, session tokens and payment credentials are never returned.
 */
export const peopleRouter = Router();

const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

const MEMBER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  statusReason: true,
  country: true,
  city: true,
  avatarUrl: true,
  headline: true,
  createdAt: true,
  lastLoginAt: true,
  isDemo: true,
  adminRole: { select: { id: true, name: true } },
} as const;

/* --------------------------------- Members -------------------------------- */

peopleRouter.get(
  '/members',
  route(async (req, res) => {
    assertPermission(req, 'members.view');
    const page = pageParams(req.query as Record<string, unknown>, 25, 100);
    const where: Record<string, unknown> = { isDemo: req.query.demo === 'true' };
    const status = str(req.query.status);
    if (status && status !== 'all') where.status = status;
    const role = str(req.query.role);
    if (role && role !== 'all') where.role = role;
    const q = str(req.query.q);
    if (q) where.OR = [{ name: textContains(q) }, { email: textContains(q) }, { phone: textContains(q) }, { city: textContains(q) }];
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { ...MEMBER_SELECT, _count: { select: { bookings: true, activityRequests: true } } },
        orderBy: { createdAt: 'desc' },
        skip: page.skip,
        take: page.take,
      }),
      prisma.user.count({ where }),
    ]);
    res.json(paginated(items, total, page));
  }),
);

/** One person's full history. Opening it is logged. */
peopleRouter.get(
  '/members/:id',
  route(async (req, res) => {
    assertPermission(req, 'members.view');
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { ...MEMBER_SELECT, bio: true, interests: true } });
    if (!user) throw ApiError.notFound();
    const [bookings, activityRequests, enquiries, sessions, reports] = await Promise.all([
      prisma.booking.findMany({
        where: { userId: user.id },
        select: { id: true, reference: true, status: true, channel: true, totalAmount: true, amountPaid: true, currency: true, createdAt: true, trip: { select: { title: true } }, departure: { select: { startDate: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.activityParticipant.findMany({ where: { userId: user.id }, select: { id: true, status: true, createdAt: true, activity: { select: { title: true, slug: true } } }, orderBy: { createdAt: 'desc' } }),
      prisma.enquiry.findMany({
        where: { OR: [{ userId: user.id }, { email: user.email }, ...(user.phone ? [{ phone: user.phone }] : [])] },
        select: { id: true, reference: true, type: true, subjectTitle: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      can(req, 'security.view')
        ? prisma.session.findMany({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, createdAt: true, lastSeenAt: true, ip: true, userAgent: true } })
        : Promise.resolve([]),
      prisma.report.findMany({ where: { targetType: 'USER', targetId: user.id }, orderBy: { createdAt: 'desc' } }),
    ]);
    const registrations = await prisma.eventRegistration.findMany({
      where: { OR: [{ userId: user.id }, { email: user.email }] },
      select: { id: true, reference: true, status: true, quantity: true, amountDue: true, amountPaid: true, currency: true, event: { select: { title: true, startsAt: true } } },
      orderBy: { createdAt: 'desc' },
    });
    await audit(req, { action: 'view', entityType: 'members', entityId: user.id, summary: `Opened the record of ${user.name}`, sensitive: true });
    res.json({ user: { ...user, interests: parseList(user.interests) }, bookings, registrations, activityRequests, enquiries, sessions, reports });
  }),
);

peopleRouter.post(
  '/members/:id/status',
  route(async (req, res) => {
    assertPermission(req, 'members.edit');
    const { status, reason } = z
      .object({ status: z.enum(['ACTIVE', 'SUSPENDED']), reason: z.string().trim().min(3, 'Give a reason.').max(500) })
      .parse(req.body);
    if (req.params.id === req.auth!.id) throw ApiError.badRequest('You cannot change your own account status.');
    const target = await prisma.user.findUniqueOrThrow({ where: { id: req.params.id } });
    if (target.role === 'ADMIN') throw ApiError.forbidden('The owner account cannot be suspended.');
    if (target.role === 'STAFF') assertPermission(req, 'staff.edit');
    const user = await prisma.user.update({ where: { id: target.id }, data: { status, statusReason: reason } });
    if (status === 'SUSPENDED') {
      await prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date(), revokedBy: req.auth!.id } });
    }
    await audit(req, { action: 'security', entityType: 'members', entityId: user.id, summary: `${status === 'SUSPENDED' ? 'Suspended' : 'Reactivated'} ${user.name}: ${reason}`, before: { status: target.status }, after: { status }, sensitive: true });
    res.json({ id: user.id, status: user.status });
  }),
);

peopleRouter.get(
  '/export/members.csv',
  route(async (req, res) => {
    assertPermission(req, 'members.export');
    const rows = await prisma.user.findMany({ where: { isDemo: false }, select: MEMBER_SELECT, orderBy: { createdAt: 'asc' } });
    await audit(req, { action: 'export', entityType: 'members', summary: `Exported ${rows.length} member records to CSV`, sensitive: true });
    sendCsv(
      res,
      `enhakkore-members-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Name', 'Email', 'Phone', 'Country', 'City', 'Account', 'Status', 'Joined', 'Last sign-in'],
      rows.map((row) => [row.name, row.email, row.phone, row.country, row.city, row.role, row.status, row.createdAt, row.lastLoginAt]),
    );
  }),
);

/* ---------------------------------- Roles --------------------------------- */

const VALID_PERMISSIONS = new Set<string>([
  '*',
  ...PERMISSION_MODULES.flatMap((module) => [`${module.key}.*`, ...PERMISSION_ACTIONS.map((action) => `${module.key}.${action.key}`)]),
]);

peopleRouter.get(
  '/roles',
  route(async (req, res) => {
    assertPermission(req, 'staff.view');
    const roles = await prisma.adminRole.findMany({ include: { _count: { select: { users: true } } }, orderBy: { name: 'asc' } });
    res.json({
      roles: roles.map((role) => ({ ...role, permissions: parseList(role.permissions) })),
      modules: PERMISSION_MODULES,
      actions: PERMISSION_ACTIONS,
    });
  }),
);

const roleSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional().nullable(),
  permissions: z.array(z.string()).max(400),
  scope: z.enum(['ALL', 'OWN']).default('ALL'),
});

/** Only the owner shapes roles: a role that can grant itself more is no boundary at all. */
peopleRouter.post(
  '/roles',
  requireAdmin,
  route(async (req, res) => {
    const input = roleSchema.parse(req.body);
    const bad = input.permissions.find((permission) => !VALID_PERMISSIONS.has(permission));
    if (bad) throw ApiError.badRequest(`Unknown permission: ${bad}`);
    const role = await prisma.adminRole.create({ data: { ...input, permissions: JSON.stringify(input.permissions) } });
    await audit(req, { action: 'permissions', entityType: 'roles', entityId: role.id, summary: `Created role “${role.name}”`, after: input, sensitive: true });
    res.status(201).json({ ...role, permissions: input.permissions });
  }),
);

peopleRouter.patch(
  '/roles/:id',
  requireAdmin,
  route(async (req, res) => {
    const input = roleSchema.partial().parse(req.body);
    const bad = input.permissions?.find((permission) => !VALID_PERMISSIONS.has(permission));
    if (bad) throw ApiError.badRequest(`Unknown permission: ${bad}`);
    const before = await prisma.adminRole.findUniqueOrThrow({ where: { id: req.params.id } });
    const { permissions, ...rest } = input;
    const role = await prisma.adminRole.update({
      where: { id: before.id },
      data: { ...rest, ...(permissions ? { permissions: JSON.stringify(permissions) } : {}) },
    });
    await audit(req, {
      action: 'permissions',
      entityType: 'roles',
      entityId: role.id,
      summary: `Changed role “${role.name}”`,
      before: { ...before, permissions: parseList(before.permissions) },
      after: { ...role, permissions: parseList(role.permissions) },
      sensitive: true,
    });
    res.json({ ...role, permissions: parseList(role.permissions) });
  }),
);

peopleRouter.delete(
  '/roles/:id',
  requireAdmin,
  route(async (req, res) => {
    if (req.query.confirm !== 'yes') throw new ApiError(428, 'Confirm to continue.', 'confirmation_required');
    const role = await prisma.adminRole.findUniqueOrThrow({ where: { id: req.params.id }, include: { _count: { select: { users: true } } } });
    if (role._count.users > 0) throw ApiError.unprocessable('People still have this role. Move them to another role first.');
    await prisma.adminRole.delete({ where: { id: role.id } });
    await audit(req, { action: 'permissions', entityType: 'roles', entityId: role.id, summary: `Deleted role “${role.name}”`, sensitive: true });
    res.json({ ok: true });
  }),
);

/* ---------------------------------- Staff --------------------------------- */

peopleRouter.get(
  '/staff',
  route(async (req, res) => {
    assertPermission(req, 'staff.view');
    const staff = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'STAFF'] } },
      select: { ...MEMBER_SELECT, sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } } },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
    res.json(staff.map(({ sessions, ...user }) => ({ ...user, activeSessions: sessions.length })));
  }),
);

/**
 * Gives a team member access. If no account exists for the email, one is
 * created with a one-time password shown once to the owner, who passes it on;
 * the person should change it after their first sign-in.
 */
peopleRouter.post(
  '/staff',
  requireAdmin,
  route(async (req, res) => {
    const input = z
      .object({ email: z.string().trim().toLowerCase().email(), name: z.string().trim().min(2).max(80).optional(), roleId: z.string().min(5) })
      .parse(req.body);
    const role = await prisma.adminRole.findUnique({ where: { id: input.roleId } });
    if (!role) throw ApiError.badRequest('Choose a role.');
    let user = await prisma.user.findUnique({ where: { email: input.email } });
    let temporaryPassword: string | null = null;
    if (user) {
      if (user.role === 'ADMIN') throw ApiError.badRequest('That is the owner account, which already has every permission.');
      if (user.role === 'ORGANIZER') throw ApiError.badRequest('That email belongs to a tour-operator account. Use a different email for staff access.');
      user = await prisma.user.update({ where: { id: user.id }, data: { role: 'STAFF', adminRoleId: role.id, status: 'ACTIVE' } });
    } else {
      if (!input.name) throw new ApiError(422, 'Please check the highlighted fields.', 'validation_error', { name: 'Give their name, to create the account.' });
      temporaryPassword = `Enh-${crypto.randomBytes(6).toString('base64url')}`;
      user = await prisma.user.create({
        data: { email: input.email, name: input.name, role: 'STAFF', adminRoleId: role.id, passwordHash: await bcrypt.hash(temporaryPassword, 12) },
      });
    }
    // A change of role takes effect on the next request; signing them out makes it obvious.
    await prisma.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date(), revokedBy: req.auth!.id } });
    await audit(req, { action: 'permissions', entityType: 'staff', entityId: user.id, summary: `Gave ${user.name} (${user.email}) the role “${role.name}”`, sensitive: true });
    res.status(201).json({ id: user.id, email: user.email, temporaryPassword });
  }),
);

peopleRouter.patch(
  '/staff/:id',
  requireAdmin,
  route(async (req, res) => {
    const input = z.object({ roleId: z.string().min(5).nullable() }).parse(req.body);
    const target = await prisma.user.findUniqueOrThrow({ where: { id: req.params.id } });
    if (target.role === 'ADMIN') throw ApiError.badRequest('The owner account always has every permission.');
    if (input.roleId === null) {
      // Revoke access: back to an ordinary member account.
      await prisma.user.update({ where: { id: target.id }, data: { role: 'TRAVELER', adminRoleId: null } });
      await prisma.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date(), revokedBy: req.auth!.id } });
      await audit(req, { action: 'permissions', entityType: 'staff', entityId: target.id, summary: `Revoked control-centre access for ${target.name}`, sensitive: true });
      return res.json({ ok: true });
    }
    const role = await prisma.adminRole.findUniqueOrThrow({ where: { id: input.roleId } });
    await prisma.user.update({ where: { id: target.id }, data: { role: 'STAFF', adminRoleId: role.id } });
    await audit(req, { action: 'permissions', entityType: 'staff', entityId: target.id, summary: `Moved ${target.name} to the role “${role.name}”`, sensitive: true });
    res.json({ ok: true });
  }),
);

/* ----------------------------- Security centre ---------------------------- */

peopleRouter.get(
  '/security/sessions',
  route(async (req, res) => {
    assertPermission(req, 'security.view');
    const onlyStaff = req.query.scope !== 'all';
    const sessions = await prisma.session.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() }, ...(onlyStaff ? { user: { role: { in: ['ADMIN', 'STAFF'] } } } : {}) },
      select: { id: true, createdAt: true, lastSeenAt: true, ip: true, userAgent: true, user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { lastSeenAt: 'desc' },
      take: 300,
    });
    res.json(sessions.map((session) => ({ ...session, current: session.id === req.auth!.sessionId })));
  }),
);

peopleRouter.post(
  '/security/sessions/:id/revoke',
  route(async (req, res) => {
    assertPermission(req, 'security.edit');
    const session = await prisma.session.findUniqueOrThrow({ where: { id: req.params.id }, include: { user: { select: { name: true, role: true } } } });
    if (session.user.role === 'ADMIN' && req.auth!.role !== 'ADMIN') throw ApiError.forbidden('Only the owner can sign the owner out.');
    await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date(), revokedBy: req.auth!.id } });
    await audit(req, { action: 'security', entityType: 'sessions', entityId: session.id, summary: `Signed out a session of ${session.user.name}`, sensitive: true });
    res.json({ ok: true });
  }),
);

/** Signs an account out everywhere, e.g. after a lost phone. */
peopleRouter.post(
  '/security/users/:id/revoke-all',
  route(async (req, res) => {
    assertPermission(req, 'security.edit');
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.params.id } });
    if (user.role === 'ADMIN' && req.auth!.role !== 'ADMIN') throw ApiError.forbidden('Only the owner can sign the owner out.');
    const result = await prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null, ...(user.id === req.auth!.id ? { id: { not: req.auth!.sessionId } } : {}) },
      data: { revokedAt: new Date(), revokedBy: req.auth!.id },
    });
    await audit(req, { action: 'security', entityType: 'sessions', entityId: user.id, summary: `Signed ${user.name} out of ${result.count} session(s)`, sensitive: true });
    res.json({ revoked: result.count });
  }),
);

peopleRouter.get(
  '/security/logins',
  route(async (req, res) => {
    assertPermission(req, 'security.view');
    const page = pageParams(req.query as Record<string, unknown>, 50, 200);
    const where: Record<string, unknown> = {};
    if (req.query.failed === 'true') where.success = false;
    const q = str(req.query.q);
    if (q) where.email = textContains(q);
    const [items, total] = await Promise.all([
      prisma.loginEvent.findMany({ where, orderBy: { createdAt: 'desc' }, skip: page.skip, take: page.take }),
      prisma.loginEvent.count({ where }),
    ]);
    res.json(paginated(items, total, page));
  }),
);

peopleRouter.get(
  '/security/audit',
  route(async (req, res) => {
    assertPermission(req, 'security.view');
    const page = pageParams(req.query as Record<string, unknown>, 50, 200);
    const where: Record<string, unknown> = {};
    for (const key of ['action', 'entityType', 'actorId', 'entityId']) {
      const value = str(req.query[key]);
      if (value && value !== 'all') where[key] = value;
    }
    if (req.query.sensitive === 'true') where.sensitive = true;
    const q = str(req.query.q);
    if (q) where.OR = [{ summary: textContains(q) }, { actorName: textContains(q) }];
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: page.skip, take: page.take }),
      prisma.auditLog.count({ where }),
    ]);
    res.json(paginated(items, total, page));
  }),
);

peopleRouter.get(
  '/export/audit.csv',
  route(async (req, res) => {
    assertPermission(req, 'security.export');
    const rows = await prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' }, take: 50000 });
    await audit(req, { action: 'export', entityType: 'audit', summary: `Exported ${rows.length} audit entries to CSV`, sensitive: true });
    sendCsv(
      res,
      `enhakkore-audit-${new Date().toISOString().slice(0, 10)}.csv`,
      ['When', 'Who', 'Action', 'Section', 'Summary', 'Sensitive', 'IP'],
      rows.map((row) => [row.createdAt.toISOString(), row.actorName, row.action, row.entityType, row.summary, row.sensitive ? 'yes' : '', row.ip]),
    );
  }),
);
