import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { DEFAULT_COMMISSION_RATE } from '@enhakkore/shared';
import { ApiError, route } from '../lib/http';
import { uniqueSlug } from '../lib/ids';
import { prisma } from '../lib/prisma';
import { requireAuth, signToken } from '../middleware/auth';
import { toOrganizerSummary, toPublicUser } from '../serializers';

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

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(input.newPassword, 12) },
    });

    res.json({ ok: true });
  }),
);
