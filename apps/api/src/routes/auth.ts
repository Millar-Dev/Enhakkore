import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { DEFAULT_COMMISSION_RATE, type Role } from '@enhakkore/shared';
import { ApiError, route } from '../lib/http';
import { uniqueSlug } from '../lib/ids';
import { prisma } from '../lib/prisma';
import { requireAuth, signToken } from '../middleware/auth';
import { toOrganizerSummary, toPublicUser } from '../serializers';
import { env } from '../env';
import {
  RESET_TTL_MINUTES,
  checkPasswordReset,
  completePasswordReset,
  issuePasswordReset,
  recordPasswordChange,
} from '../services/passwordReset';

export const authRouter = Router();

// Credential endpoints are the obvious brute-force target, so they get a
// tighter budget than the rest of the API.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many attempts. Try again in a few minutes.' } },
});

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Tell us your name.').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.').max(200),
  accountType: z.enum(['TRAVELER', 'ORGANIZER']).default('TRAVELER'),
  country: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
  /** Required when accountType is ORGANIZER. */
  companyName: z.string().trim().min(2).max(120).optional(),
});

authRouter.post(
  '/register',
  credentialLimiter,
  route(async (req, res) => {
    const input = registerSchema.parse(req.body);

    if (input.accountType === 'ORGANIZER' && !input.companyName) {
      throw ApiError.badRequest('Enter your company or operating name.');
    }

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw ApiError.conflict('An account with that email already exists.', 'email_taken');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.accountType,
        country: input.country ?? null,
        phone: input.phone ?? null,
        ...(input.accountType === 'ORGANIZER'
          ? {
              organizer: {
                create: {
                  companyName: input.companyName!,
                  slug: uniqueSlug(input.companyName!),
                  country: input.country ?? null,
                  // New operators start unverified. No badge, no publishing
                  // until an admin reviews their submission.
                  verificationStatus: 'UNSUBMITTED',
                  commissionRate: DEFAULT_COMMISSION_RATE,
                },
              },
            }
          : {}),
      },
      include: { organizer: true },
    });

    res.status(201).json({
      token: signToken(user.id, user.role as 'TRAVELER' | 'ORGANIZER'),
      user: toPublicUser(user),
      organizer: user.organizer ? toOrganizerSummary(user.organizer) : null,
    });
  }),
);

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

authRouter.post(
  '/login',
  credentialLimiter,
  route(async (req, res) => {
    const input = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: { organizer: true },
    });

    // Same message and roughly the same work whether the email exists or not,
    // so the response cannot be used to enumerate accounts.
    const hash = user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
    const valid = await bcrypt.compare(input.password, hash);

    if (!user || !valid) {
      throw ApiError.unauthorized('That email and password do not match.');
    }
    if (user.status === 'SUSPENDED') {
      throw ApiError.forbidden('This account is suspended. Contact support@enhakkore.com.');
    }

    res.json({
      token: signToken(user.id, user.role as 'TRAVELER' | 'ORGANIZER' | 'ADMIN'),
      user: toPublicUser(user),
      organizer: user.organizer ? toOrganizerSummary(user.organizer) : null,
    });
  }),
);

authRouter.get(
  '/session',
  requireAuth,
  route(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.auth!.id },
      include: { organizer: true },
    });
    res.json({
      user: toPublicUser(user),
      organizer: user.organizer ? toOrganizerSummary(user.organizer) : null,
    });
  }),
);

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Use at least 8 characters.').max(200),
});

/**
 * Change password while signed in. Every other session is signed out, so the
 * caller gets a fresh token back to stay signed in on this device.
 */
authRouter.post(
  '/password',
  requireAuth,
  credentialLimiter,
  route(async (req, res) => {
    const input = passwordSchema.parse(req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.id } });

    if (!(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
      throw ApiError.badRequest('Your current password is not correct.');
    }

    const updated = await recordPasswordChange(user.id, input.newPassword);
    res.json({ ok: true, token: signToken(updated.id, updated.role as Role) });
  }),
);

/* -------------------------------------------------------------------------- */
/* Forgot password                                                              */
/* -------------------------------------------------------------------------- */

// Separate budgets per route: requesting a link can send an email, so it is the
// tightest; checking and using a link get more room so a mistyped password does
// not lock someone out. Limits are relaxed only in local development.
function resetBudget(productionLimit: number) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: env.isProduction ? productionLimit : productionLimit * 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'rate_limited', message: 'Too many requests. Try again in a few minutes.' } },
  });
}

const forgotLimiter = resetBudget(5);
const resetLimiter = resetBudget(15);

const forgotSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
});

/**
 * Always answers the same way, whether or not the address has an account, and
 * does the work without awaiting it — so neither the message nor the response
 * time tells a stranger who is registered.
 */
authRouter.post(
  '/forgot-password',
  forgotLimiter,
  route(async (req, res) => {
    const { email } = forgotSchema.parse(req.body);

    void issuePasswordReset(email).catch((error) =>
      console.error('[auth] password reset issue failed:', error instanceof Error ? error.message : error),
    );

    res.json({
      ok: true,
      message: `If an account exists for ${email}, we've sent a link to reset the password. It expires in ${RESET_TTL_MINUTES} minutes.`,
    });
  }),
);

const tokenSchema = z.object({ token: z.string().min(10).max(200) });

authRouter.post(
  '/reset-password/check',
  resetLimiter,
  route(async (req, res) => {
    const { token } = tokenSchema.parse(req.body);
    res.json(await checkPasswordReset(token));
  }),
);

const resetSchema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(8, 'Use at least 8 characters.').max(200),
});

const RESET_FAILURE: Record<'invalid' | 'used' | 'expired', string> = {
  invalid: 'This reset link is not valid. Request a new one.',
  used: 'This reset link has already been used. Request a new one if you still need it.',
  expired: 'This reset link has expired. Request a new one — they last 30 minutes.',
};

/** Sets the new password and signs the user straight in on this device. */
authRouter.post(
  '/reset-password',
  resetLimiter,
  route(async (req, res) => {
    const input = resetSchema.parse(req.body);
    const result = await completePasswordReset(input.token, input.password);

    if (!result.ok) {
      throw ApiError.unprocessable(RESET_FAILURE[result.reason], `reset_${result.reason}`);
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: result.userId },
      include: { organizer: true },
    });

    res.json({
      token: signToken(user.id, user.role as Role),
      user: toPublicUser(user),
      organizer: user.organizer ? toOrganizerSummary(user.organizer) : null,
    });
  }),
);
