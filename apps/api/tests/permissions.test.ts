import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { ACCOUNTS, type Api, prisma, startApi } from './helpers';

/**
 * Who can see and do what.
 *
 * These are the rules that keep one traveller's booking private, one
 * operator's trips their own, and the admin console out of reach. A failure
 * here is a data leak, so each rule gets a test that would catch it.
 */
describe('permissions', () => {
  let api: Api;
  before(async () => {
    api = await startApi();
  });
  after(async () => {
    await api.close();
  });

  describe('the admin console', () => {
    test('is closed to visitors who are not signed in', async () => {
      assert.equal((await api.request('GET', '/admin/stats')).status, 401);
    });

    test('is closed to travellers', async () => {
      const token = await api.login(ACCOUNTS.michael);
      assert.equal((await api.request('GET', '/admin/stats', { token })).status, 403);
    });

    test('is closed to tour operators', async () => {
      const token = await api.login(ACCOUNTS.organizer);
      assert.equal((await api.request('GET', '/admin/stats', { token })).status, 403);
    });

    test('opens for an admin', async () => {
      const token = await api.login(ACCOUNTS.admin);
      assert.equal((await api.request('GET', '/admin/stats', { token })).status, 200);
    });

    test('a made-up token is rejected', async () => {
      const result = await api.request('GET', '/admin/stats', { token: 'not.a.real.token' });
      assert.equal(result.status, 401);
    });
  });

  describe('someone else’s booking', () => {
    test('cannot be read by another traveller, even with the reference', async () => {
      const booking = await prisma.booking.findFirstOrThrow({
        where: { user: { email: ACCOUNTS.michael } },
      });
      const intruder = await api.register('nosy');
      const result = await api.request('GET', `/bookings/${booking.reference}`, { token: intruder.token });
      assert.equal(result.status, 403);
    });

    test('is readable by the traveller who made it', async () => {
      const booking = await prisma.booking.findFirstOrThrow({
        where: { user: { email: ACCOUNTS.michael } },
      });
      const token = await api.login(ACCOUNTS.michael);
      const result = await api.request('GET', `/bookings/${booking.reference}`, { token });
      assert.equal(result.status, 200);
      assert.equal(result.body.reference, booking.reference);
    });
  });

  describe('a trip’s private group', () => {
    async function mikumiGroup() {
      return prisma.conversation.findFirstOrThrow({
        where: { departure: { trip: { slug: 'mikumi-adventure' } }, members: { some: {} } },
        include: { members: true },
      });
    }

    test('is invisible to a traveller without a booking on that departure — 404, not 403', async () => {
      const group = await mikumiGroup();
      const outsider = await api.register('outsider');
      const result = await api.request('GET', `/conversations/${group.id}`, { token: outsider.token });
      // 404 on purpose: a 403 would confirm the group exists.
      assert.equal(result.status, 404);
    });

    test('cannot be posted to by an outsider', async () => {
      const group = await mikumiGroup();
      const outsider = await api.register('poster');
      const result = await api.request('POST', `/conversations/${group.id}/messages`, {
        token: outsider.token,
        body: { body: 'Let me in' },
      });
      assert.equal(result.status, 404);
    });

    test('opens for a traveller on that departure', async () => {
      const group = await mikumiGroup();
      const member = await prisma.conversationMember.findFirstOrThrow({
        where: { conversationId: group.id, role: 'TRAVELER' },
        include: { user: true },
      });
      const token = await api.login(member.user.email);
      const result = await api.request('GET', `/conversations/${group.id}`, { token });
      assert.equal(result.status, 200);
      assert.equal(result.body.canPost, true);
    });

    test('announcements are the organizer’s alone', async () => {
      const group = await mikumiGroup();
      const member = await prisma.conversationMember.findFirstOrThrow({
        where: { conversationId: group.id, role: 'TRAVELER' },
        include: { user: true },
      });
      const travellerToken = await api.login(member.user.email);

      const asTraveller = await api.request('POST', `/conversations/${group.id}/messages`, {
        token: travellerToken,
        body: { body: 'Departure is cancelled, everyone go home', kind: 'ANNOUNCEMENT' },
      });
      assert.equal(asTraveller.status, 403);

      const asOrganizer = await api.request('POST', `/conversations/${group.id}/messages`, {
        token: await api.login(ACCOUNTS.organizer),
        body: { body: 'Pickup is at 6am sharp.', kind: 'ANNOUNCEMENT' },
      });
      assert.equal(asOrganizer.status, 201);
      assert.equal(asOrganizer.body.kind, 'ANNOUNCEMENT');
      assert.equal(asOrganizer.body.author.isOrganizer, true);
    });

    test('an ordinary message from a member is accepted', async () => {
      const group = await mikumiGroup();
      const member = await prisma.conversationMember.findFirstOrThrow({
        where: { conversationId: group.id, role: 'TRAVELER' },
        include: { user: true },
      });
      const result = await api.request('POST', `/conversations/${group.id}/messages`, {
        token: await api.login(member.user.email),
        body: { body: 'What time do we meet?' },
      });
      assert.equal(result.status, 201);
      assert.equal(result.body.author.isOrganizer, false);
    });
  });

  describe('one operator’s trips', () => {
    test('cannot be opened by a different operator', async () => {
      const trip = await prisma.trip.findFirstOrThrow({
        where: { organizer: { user: { email: ACCOUNTS.organizer } } },
      });
      const token = await api.login(ACCOUNTS.otherOrganizer);
      const result = await api.request('GET', `/organizers/me/trips/${trip.id}`, { token });
      assert.equal(result.status, 404);
    });

    test('open for the operator who owns them', async () => {
      const trip = await prisma.trip.findFirstOrThrow({
        where: { organizer: { user: { email: ACCOUNTS.organizer } } },
      });
      const token = await api.login(ACCOUNTS.organizer);
      const result = await api.request('GET', `/organizers/me/trips/${trip.id}`, { token });
      assert.equal(result.status, 200);
    });

    test('the operator workspace is closed to travellers', async () => {
      const token = await api.login(ACCOUNTS.michael);
      assert.equal((await api.request('GET', '/organizers/me/stats', { token })).status, 403);
    });
  });

  describe('unpublished trips', () => {
    test('are hidden from the public', async () => {
      const draft = await prisma.trip.findFirstOrThrow({ where: { status: 'PENDING_REVIEW' } });
      assert.equal((await api.request('GET', `/trips/${draft.slug}`)).status, 404);
    });

    test('are visible to the operator who owns them, and to an admin', async () => {
      const draft = await prisma.trip.findFirstOrThrow({
        where: { status: 'PENDING_REVIEW' },
        include: { organizer: { include: { user: true } } },
      });
      const owner = await api.login(draft.organizer.user.email);
      assert.equal((await api.request('GET', `/trips/${draft.slug}`, { token: owner })).status, 200);
      const admin = await api.login(ACCOUNTS.admin);
      assert.equal((await api.request('GET', `/trips/${draft.slug}`, { token: admin })).status, 200);
    });

    test('cannot be published while their operator is unverified', async () => {
      const draft = await prisma.trip.findFirstOrThrow({
        where: { status: 'PENDING_REVIEW' },
        include: { organizer: true },
      });
      assert.notEqual(draft.organizer.verificationStatus, 'VERIFIED', 'fixture assumption');

      const admin = await api.login(ACCOUNTS.admin);
      const result = await api.request('POST', `/admin/trips/${draft.id}/review`, {
        token: admin,
        body: { decision: 'PUBLISHED' },
      });
      assert.equal(result.status, 422);
      assert.equal(result.body.error.code, 'organizer_unverified');
    });
  });

  describe('a suspended account', () => {
    test('loses access immediately, without waiting for its session to expire', async () => {
      const victim = await api.register('suspendme');
      assert.equal((await api.request('GET', '/auth/session', { token: victim.token })).status, 200);

      const admin = await api.login(ACCOUNTS.admin);
      const suspended = await api.request('POST', `/admin/users/${victim.id}/status`, {
        token: admin,
        body: { status: 'SUSPENDED' },
      });
      assert.equal(suspended.status, 200);

      const after = await api.request('GET', '/auth/session', { token: victim.token });
      assert.equal(after.status, 401, 'the token issued before suspension must stop working');
    });
  });
});
