import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@enhakkore/shared';
import { env } from '../env';
import { ApiError } from '../lib/http';
import { prisma } from '../lib/prisma';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: string;
  organizerId: string | null;
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
}

export function signToken(userId: string, role: Role): string {
  return jwt.sign({ sub: userId, role } satisfies TokenPayload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions);
}

async function resolveUser(token: string): Promise<AuthUser | null> {
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, env.jwtSecret) as TokenPayload;
  } catch {
    return null;
  }

  // The token carries a role claim, but permissions are always decided from the
  // live record — a suspended or demoted account must lose access immediately,
  // not when its token happens to expire.
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      organizer: { select: { id: true } },
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    status: user.status,
    organizerId: user.organizer?.id ?? null,
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
    return next(ApiError.forbidden('This account is suspended. Contact support@enhakkore.com.'));
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

export const requireAdmin = requireRole('ADMIN');
