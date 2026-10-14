import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, beforeEach, describe, test } from 'node:test';
import { type Api, prisma, startApi, waitFor } from './helpers';
import { testOutbox } from '../src/services/email';

/**
 * Password reset. The rules here are what stop a reset link becoming a way
 * into someone's account, so each one is pinned down by a test.
 *
 * In test mode emails go to an in-memory outbox instead of being sent, so the
 * link can be read exactly as the recipient would.
 */
describe('password reset', () => {
  let api: Api;
  before(async () => {
    api = await startApi();
  });
  after(async () => {
    await api.close();
  });
  beforeEach(() => {
    testOutbox.length = 0;
  });

  /** Registers someone and asks for a reset, returning the emailed link. */
  async function requestReset() {
    const user = await api.register('resetter');
    const response = await api.request('POST', '/auth/forgot-password', { body: { email: user.email } });
    assert.equal(response.status, 200);
    const email = await waitFor(() => testOutbox.find((m) => m.to === user.email));
    const token = email.text.match(/reset-password\?token=([^\s]+)/)?.[1];
    assert.ok(token, 'the email must contain a reset link');
    return { user, token: decodeURIComponent(token), email };
  }

  test('the reply is identical whether or not the address has an account', async () => {
    const real = await api.register('known');
    const a = await api.request('POST', '/auth/forgot-password', { body: { email: real.email } });
    const b = await api.request('POST', '/auth/forgot-password', { body: { email: 'nobody@test.local' } });

    assert.equal(a.status, b.status);
    assert.equal(a.body.message.replace(real.email, 'X'), b.body.message.replace('nobody@test.local', 'X'));

    // Only the real account is emailed.
    await waitFor(() => testOutbox.find((m) => m.to === real.email));
    assert.equal(testOutbox.filter((m) => m.to === 'nobody@test.local').length, 0);
  });

  test('only a hash of the link is stored, never the link itself', async () => {
    const { user, token } = await requestReset();
    const stored = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });

    assert.equal(stored.tokenHash, crypto.createHash('sha256').update(token).digest('hex'));
    assert.ok(!JSON.stringify(stored).includes(token), 'the raw link must not be in the database');
  });

  test('the link expires after 30 minutes', async () => {
    const { user } = await requestReset();
    const stored = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });
    const minutes = Math.round((stored.expiresAt.getTime() - stored.createdAt.getTime()) / 60_000);
    assert.equal(minutes, 30);
  });

  test('asking again within a minute does not send a second email', async () => {
    const { user } = await requestReset();
    const sentFirst = testOutbox.length;
    await api.request('POST', '/auth/forgot-password', { body: { email: user.email } });
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(testOutbox.length, sentFirst, 'the form cannot be used to flood an inbox');
  });

  test('a new password signs you in, and signs every other device out', async () => {
    const { user, token } = await requestReset();
    const oldSession = user.token;
    assert.equal((await api.request('GET', '/auth/session', { token: oldSession })).status, 200);

    // Tokens carry whole-second timestamps; wait so "before" and "after" differ.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const reset = await api.request('POST', '/auth/reset-password', {
      body: { token, password: 'BrandNewPass-99' },
    });

    assert.equal(reset.status, 200);
    assert.ok(reset.body.token, 'the reset signs you in on this device');
    assert.equal((await api.request('GET', '/auth/session', { token: reset.body.token })).status, 200);
    assert.equal(
      (await api.request('GET', '/auth/session', { token: oldSession })).status,
      401,
      'sessions from before the change must stop working',
    );
  });

  test('the old password stops working and the new one works', async () => {
    const { user, token } = await requestReset();
    await api.request('POST', '/auth/reset-password', { body: { token, password: 'SecondPass-77' } });

    const oldLogin = await api.request('POST', '/auth/login', {
      body: { email: user.email, password: 'TestPass-123' },
    });
    assert.equal(oldLogin.status, 401);

    const newLogin = await api.request('POST', '/auth/login', {
      body: { email: user.email, password: 'SecondPass-77' },
    });
    assert.equal(newLogin.status, 200);
  });

  test('a link works once only', async () => {
    const { token } = await requestReset();
    assert.equal((await api.request('POST', '/auth/reset-password', { body: { token, password: 'FirstUse-11' } })).status, 200);

    const second = await api.request('POST', '/auth/reset-password', { body: { token, password: 'SecondUse-22' } });
    assert.equal(second.status, 422);
    assert.equal(second.body.error.code, 'reset_used');
  });

  test('a too-short password is refused without using up the link', async () => {
    const { token } = await requestReset();
    const refused = await api.request('POST', '/auth/reset-password', { body: { token, password: 'short' } });
    assert.equal(refused.status, 422);

    const check = await api.request('POST', '/auth/reset-password/check', { body: { token } });
    assert.equal(check.body.valid, true, 'the link survives a rejected attempt');
  });

  test('an expired link is refused and says so', async () => {
    const { user } = await requestReset();
    const expired = crypto.randomBytes(32).toString('base64url');
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: crypto.createHash('sha256').update(expired).digest('hex'),
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const result = await api.request('POST', '/auth/reset-password', {
      body: { token: expired, password: 'TooLate-123' },
    });
    assert.equal(result.status, 422);
    assert.equal(result.body.error.code, 'reset_expired');
  });

  test('a made-up link is refused', async () => {
    const check = await api.request('POST', '/auth/reset-password/check', { body: { token: 'x'.repeat(43) } });
    assert.equal(check.body.valid, false);
    assert.equal(check.body.reason, 'invalid');
  });

  test('the owner is told their password changed', async () => {
    const { user, token } = await requestReset();
    testOutbox.length = 0;
    await api.request('POST', '/auth/reset-password', { body: { token, password: 'Notified-123' } });

    const notice = await waitFor(() =>
      testOutbox.find((m) => m.to === user.email && /password was changed/i.test(m.subject)),
    );
    assert.match(notice.text, /was just changed/);
  });

  test('issuing a new link retires the previous one', async () => {
    const first = await requestReset();
    // Step past the one-minute cooldown.
    await prisma.passwordResetToken.updateMany({
      where: { userId: first.user.id },
      data: { createdAt: new Date(Date.now() - 120_000) },
    });
    testOutbox.length = 0;

    await api.request('POST', '/auth/forgot-password', { body: { email: first.user.email } });
    await waitFor(() => testOutbox.find((m) => m.to === first.user.email));

    const check = await api.request('POST', '/auth/reset-password/check', { body: { token: first.token } });
    assert.equal(check.body.valid, false, 'only the newest link works');
  });
});
