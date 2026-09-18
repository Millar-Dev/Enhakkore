import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../env';
import { prisma } from '../lib/prisma';
import { sendEmail } from './email';
import { passwordChangedEmail, passwordResetEmail } from './email/templates';

/**
 * Password reset.
 *
 * The rules, and why:
 * - The link carries 32 random bytes. Only their SHA-256 hash is stored, so the
 *   database alone cannot be used to reset anyone's password.
 * - Links expire after 30 minutes and work once. Issuing a new link retires any
 *   earlier unused ones, so only the most recent email ever works.
 * - At most one email per account per minute, so the form cannot be used to
 *   flood someone's inbox.
 * - Completing a reset stamps `passwordChangedAt`, which invalidates every
 *   session issued before it (see isTokenStale), and emails the owner.
 */

export const RESET_TTL_MINUTES = 30;
const RESEND_COOLDOWN_MS = 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Starts a reset for an email address, if an eligible account exists.
 *
 * Deliberately returns nothing: the route responds identically whether or not
 * the account exists, and the caller does not await this, so response timing
 * does not reveal it either.
 */
export async function issuePasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== 'ACTIVE') return;

  const recent = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) } },
  });
  if (recent) return;

  const token = crypto.randomBytes(32).toString('base64url');

  await prisma.$transaction([
    // Retire every earlier unused link for this account.
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000),
      },
    }),
  ]);

  await sendEmail(
    passwordResetEmail({
      to: user.email,
      name: user.name,
      link: `${env.appUrl}/reset-password?token=${encodeURIComponent(token)}`,
      expiresInMinutes: RESET_TTL_MINUTES,
    }),
  );
}

type Lookup =
  | { ok: true; tokenId: string; userId: string }
  | { ok: false; reason: 'invalid' | 'used' | 'expired' };

async function lookup(token: string): Promise<Lookup> {
  if (!token || token.length > 200) return { ok: false, reason: 'invalid' };

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { status: true } } },
  });

  if (!record || record.user.status !== 'ACTIVE') return { ok: false, reason: 'invalid' };
  if (record.usedAt) return { ok: false, reason: 'used' };
  if (record.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' };
  return { ok: true, tokenId: record.id, userId: record.userId };
}

/** Lets the reset page say "this link has expired" before anyone types a password. */
export async function checkPasswordReset(token: string) {
  const result = await lookup(token);
  return result.ok ? { valid: true as const } : { valid: false as const, reason: result.reason };
}

/**
 * Sets the new password and consumes the link. Returns the user id on success.
 *
 * The consume step is a conditional update (`usedAt: null`), so two requests
 * racing with the same link cannot both succeed.
 */
export async function completePasswordReset(
  token: string,
  newPassword: string,
): Promise<{ ok: true; userId: string } | { ok: false; reason: 'invalid' | 'used' | 'expired' }> {
  const found = await lookup(token);
  if (!found.ok) return found;

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const now = new Date();

  const consumed = await prisma.passwordResetToken.updateMany({
    where: { id: found.tokenId, usedAt: null },
    data: { usedAt: now },
  });
  if (consumed.count === 0) return { ok: false, reason: 'used' };

  const user = await prisma.user.update({
    where: { id: found.userId },
    data: { passwordHash, passwordChangedAt: now },
  });

  // Any other outstanding links for this account are now pointless.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: now },
  });

  void sendEmail(
    passwordChangedEmail({ to: user.email, name: user.name, resetUrl: `${env.appUrl}/forgot-password` }),
  );

  return { ok: true, userId: user.id };
}

/** Used by the signed-in "change password" route, which has the same effects. */
export async function recordPasswordChange(userId: string, newPassword: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(newPassword, 12), passwordChangedAt: new Date() },
  });
  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });
  void sendEmail(
    passwordChangedEmail({ to: user.email, name: user.name, resetUrl: `${env.appUrl}/forgot-password` }),
  );
  return user;
}
