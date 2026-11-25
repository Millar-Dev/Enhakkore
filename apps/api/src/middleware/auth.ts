import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { hasPermission, type Role } from '@enhakkore/shared';
import { env } from '../env';
import { ApiError } from '../lib/http';
import { parseList } from '../lib/json';
import { prisma } from '../lib/prisma';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: string;
  organizerId: string | null;
  /** The session this request belongs to. */
  sessionId: string;
  /** Control-centre permissions: `*` for the owner, the assigned role's for staff, none for members. */
  permissions: string[];
  /** ALL, or OWN for partner roles limited to their assigned listings. */
  scope: 'ALL' | 'OWN';
  adminRoleName: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

interface TokenPayload {
  sub: string;
  role: Role;
  /** Session id. Every token names one, so it can be revoked. */
  sid: string;
  /** Issued-at, in whole seconds. Added by jsonwebtoken on sign. */
  iat?: number;
}

/** Session lifetime, matching the token's own expiry. */
export function sessionLifetimeMs(): number {
  const raw = env.jwtExpiresIn;
  const match = /^(\d+)\s*([smhd])?$/.exec(String(raw));
  if (!match) return 7 * 86400000;
  const n = Number(match[1]);
  const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[(match[2] ?? 's') as 's' | 'm' | 'h' | 'd'];
  return n * unit;
}

export function signToken(userId: string, role: Role, sessionId: string): string {
  return jwt.sign({ sub: userId, role, sid: sessionId } satisfies TokenPayload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions);
}

/**
 * Starts a session and returns its token. Called on sign-in, sign-up and
 * password resets — never anywhere a token could be minted without a row.
 */
export async function issueSession(
  user: { id: string; role: string },
  req?: Pick<Request, 'ip' | 'headers'>,
): Promise<string> {
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      ip: req?.ip ?? null,
      userAgent: String(req?.headers?.['user-agent'] ?? '').slice(0, 300) || null,
      expiresAt: new Date(Date.now() + sessionLifetimeMs()),
    },
  });
  return signToken(user.id, user.role as Role, session.id);
}

/**
 * True when a session token predates the account's last password change.
 *
 * `iat` is whole seconds, so the change time is floored to match: a token
 * issued in the same second as the change (the new session handed back by a
 * reset) stays valid.
 */
export function isTokenStale(iat: number | undefined, passwordChangedAt: Date | null): boolean {
  if (!passwordChangedAt) return false;
  if (typeof iat !== 'number') return true;
  return iat < Math.floor(passwordChangedAt.getTime() / 1000);
}

/** `lastSeenAt` is written at most this often, so reads stay cheap. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

async function resolveUser(token: string): Promise<AuthUser | null> {
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, env.jwtSecret) as TokenPayload;
  } catch {
    return null;
  }
  if (!payload.sid) return null;

  // The token carries a role claim, but permissions are always decided from the
  // live records — a suspended account, a revoked session or a changed role
  // takes effect on the very next request.
  const session = await prisma.session.findUnique({
    where: { id: payload.sid },
    select: {
      id: true,
      userId: true,
      revokedAt: true,
      expiresAt: true,
      lastSeenAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          passwordChangedAt: true,
          organizer: { select: { id: true } },
          adminRole: { select: { name: true, permissions: true, scope: true } },
        },
      },
    },
  });

  if (!session || session.userId !== payload.sub) return null;
  if (session.revokedAt || session.expiresAt.getTime() < Date.now()) return null;
  const user = session.user;
  if (isTokenStale(payload.iat, user.passwordChangedAt)) return null;

  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    void prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }

  const role = user.role as Role;
  const permissions =
    role === 'ADMIN' ? ['*'] : role === 'STAFF' && user.adminRole ? parseList(user.adminRole.permissions) : [];

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role,
    status: user.status,
    organizerId: user.organizer?.id ?? null,
    sessionId: session.id,
    permissions,
    scope: role === 'STAFF' && user.adminRole?.scope === 'OWN' ? 'OWN' : 'ALL',
    adminRoleName: role === 'ADMIN' ? 'Owner' : (user.adminRole?.name ?? null),
  };
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/** Attaches `req.auth` when a valid token is present, but never rejects. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const user = await resolveUser(token);
    if (user && user.status === 'ACTIVE') req.auth = user;
    next();
  } catch (error) {
    next(error);
  }
}

/** Requires a signed-in, active account. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(ApiError.unauthorized());
  if (req.auth.status !== 'ACTIVE') {
    return next(ApiError.forbidden('This account is suspended.'));
  }
  next();
}

/** Requires one of the listed roles. Admins are never implicitly included. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(ApiError.unauthorized());
    if (!roles.includes(req.auth.role)) {
      return next(ApiError.forbidden('Your account type cannot access this area.'));
    }
    next();
  };
}

/**
 * Requires an organizer account with a linked organizer record. Verification is
 * checked separately — an unverified organizer can build drafts but cannot
 * publish, which is enforced at the route level.
 */
export function requireOrganizer(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(ApiError.unauthorized());
  if (req.auth.role !== 'ORGANIZER' || !req.auth.organizerId) {
    return next(ApiError.forbidden('This area is for tour operators on Enhakkore.'));
  }
  next();
}

/** The owner only. */
export const requireAdmin = requireRole('ADMIN');

/** Anyone who works in the control centre: the owner, or staff with a role. */
export function requireStaff(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(ApiError.unauthorized());
  if (req.auth.role !== 'ADMIN' && !(req.auth.role === 'STAFF' && req.auth.permissions.length > 0)) {
    return next(ApiError.forbidden('This area is for the Enhakkore team.'));
  }
  next();
}

/**
 * Requires a control-centre permission, e.g. `finance.view`. Checked on the
 * server for every request — the dashboard hiding a button is never the
 * protection.
 */
export function requirePermission(...wanted: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(ApiError.unauthorized());
    const missing = wanted.find((permission) => !hasPermission(req.auth!.permissions, permission));
    if (missing) {
      return next(ApiError.forbidden(`You do not have permission for this (${missing}). Ask the owner to change your role.`));
    }
    next();
  };
}

/** Throws unless the viewer has the permission. For checks inside a handler. */
export function assertPermission(req: Request, permission: string): void {
  if (!req.auth) throw ApiError.unauthorized();
  if (!hasPermission(req.auth.permissions, permission)) {
    throw ApiError.forbidden(`You do not have permission for this (${permission}). Ask the owner to change your role.`);
  }
}

export function can(req: Request, permission: string): boolean {
  return !!req.auth && hasPermission(req.auth.permissions, permission);
}
