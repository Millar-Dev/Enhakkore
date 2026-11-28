import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { ACCOUNTS, prisma, startApi, type Api } from './helpers';

/**
 * R6: usernames, profile privacy, notification preferences, invitations,
 * organiser applications, Enhakkore Pass with the scanner and offline mode,
 * group chats for listings, community access types and duplicate-safe
 * reservation requests.
 */

let api: Api;
let owner: string;
const stamp = Date.now().toString(36).slice(-5);

before(async () => {
  api = await startApi();
  owner = await api.login(ACCOUNTS.admin);
});
after(async () => {
  await api.close();
});

async function member(prefix: string, username?: string) {
  const email = `${prefix}-${stamp}-${Math.random().toString(36).slice(2, 6)}@test.local`;
  const result = await api.request('POST', '/auth/register', {
    body: { name: `Test ${prefix} Person`, email, password: 'TestPass-123', accountType: 'TRAVELER', acceptedTerms: true, username, country: 'Tanzania', city: 'Dar es Salaam', dateOfBirth: '1996-01-15' },
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return { token: result.body.token as string, id: result.body.user.id as string, email, username };
}

async function activity(data: Record<string, unknown> = {}) {
  return prisma.activity.create({
    data: { slug: `r6-${stamp}-${Math.random().toString(36).slice(2, 7)}`, title: 'R6 test run', description: 'A test activity for the R6 suite.', organiserName: 'Tester', status: 'PUBLISHED', startsAt: new Date(Date.now() + 3 * 86400000), ...data },
  });
}

describe('usernames and registration', () => {
  test('registration saves username, country and city; usernames are unique and some are reserved', async () => {
    const first = await member('uname', `amina_${stamp}`);
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: first.id } });
    assert.equal(saved.username, `amina_${stamp}`);
    assert.equal(saved.city, 'Dar es Salaam');

    const taken = await api.request('POST', '/auth/register', {
      body: { name: 'Another One', email: `other-${stamp}@test.local`, password: 'TestPass-123', acceptedTerms: true, username: `AMINA_${stamp}`, dateOfBirth: '1996-01-15' },
    });
    assert.equal(taken.status, 409);
    assert.match(taken.body.error.message, /taken/);

    const reserved = await api.request('GET', '/me/username-available?u=admin', { token: first.token });
    assert.equal(reserved.body.available, false);
    const bad = await api.request('GET', '/me/username-available?u=a', { token: first.token });
    assert.equal(bad.body.available, false);
    const free = await api.request('GET', `/me/username-available?u=free_${stamp}`, { token: first.token });
    assert.equal(free.body.available, true);
  });

  test('a member can change their username, but not to one already used', async () => {
    const a = await member('chg', `chg_a_${stamp}`);
    const b = await member('chg', `chg_b_${stamp}`);
    const clash = await api.request('PATCH', '/me', { token: b.token, body: { username: a.username } });
    assert.equal(clash.status, 409);
    const ok = await api.request('PATCH', '/me', { token: b.token, body: { username: `chg_c_${stamp}` } });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.username ?? ok.body.user?.username, `chg_c_${stamp}`);
  });
});

describe('profile privacy', () => {
  test('fields set to Private are never shown; Public fields appear on the public card; no email or phone anywhere', async () => {
    const owner = await member('priv', `priv_${stamp}`);
    const viewer = await member('view');
    await api.request('PATCH', '/me', { token: owner.token, body: { bio: 'I love long runs.', interests: ['Running'], profileFields: { bio: 'PRIVATE', interests: 'PUBLIC', location: 'MEMBERS' } } });

    const seen = await api.request('GET', `/community/members/${owner.id}`, { token: viewer.token });
    assert.equal(seen.status, 200);
    assert.equal(seen.body.bio, null);
    assert.deepEqual(seen.body.interests, ['Running']);
    assert.equal(seen.body.city, 'Dar es Salaam');
    assert.equal(JSON.stringify(seen.body).includes(owner.email), false);

    const self = await api.request('GET', `/community/members/${owner.id}`, { token: owner.token });
    assert.equal(self.body.bio, 'I love long runs.');

    const card = await api.request('GET', `/public/u/priv_${stamp}`);
    assert.equal(card.status, 200);
    assert.equal(card.body.bio, null);
    assert.equal(card.body.city, null, 'location is members-only');
    assert.deepEqual(card.body.interests, ['Running']);
    assert.equal(card.body.name, `@priv_${stamp}`);
    assert.equal(JSON.stringify(card.body).includes(owner.email), false);
  });

  test('Nearby is off by default and the website says plainly that detection needs the app', async () => {
    const m = await member('near');
    const session = await api.request('GET', '/auth/session', { token: m.token });
    assert.equal(session.body.user.nearbyMode, 'OFF');
    const set = await api.request('PUT', '/me/nearby', { token: m.token, body: { mode: 'M10' } });
    assert.equal(set.status, 200);
    assert.equal(set.body.active, false);
    assert.match(set.body.reason, /mobile app/);
  });
});

describe('notification preferences and invitations', () => {
  test('an invitation notifies by username, registers nobody, and respects “invitations off”', async () => {
    const host = await member('inv', `inv_host_${stamp}`);
    const friend = await member('inv', `inv_friend_${stamp}`);
    const row = await activity();

    const sent = await api.request('POST', '/community/invites', { token: host.token, body: { subjectType: 'ACTIVITY', subjectId: row.id, usernames: [`@inv_friend_${stamp}`, 'nobody_here_xyz'] } });
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    assert.equal(sent.body.sent, 1);
    assert.deepEqual(sent.body.notFound, ['nobody_here_xyz']);
    const notes = await prisma.notification.findMany({ where: { userId: friend.id, type: 'INVITATION' } });
    assert.equal(notes.length, 1);
    assert.equal(notes[0].link, `/activities/${row.slug}`);
    assert.equal(await prisma.activityParticipant.count({ where: { activityId: row.id } }), 0, 'an invitation is not a registration');

    await api.request('PUT', '/me/notification-prefs', { token: friend.token, body: { off: ['invites'] } });
    await api.request('POST', '/community/invites', { token: host.token, body: { subjectType: 'ACTIVITY', subjectId: row.id, usernames: [`inv_friend_${stamp}`] } });
    assert.equal(await prisma.notification.count({ where: { userId: friend.id, type: 'INVITATION' } }), 1);

    // Essential notices are never filtered.
    const lookup = await api.request('GET', `/community/usernames?q=inv_fr`, { token: host.token });
    assert.equal(lookup.body.items[0].username, `inv_friend_${stamp}`);
    assert.equal(JSON.stringify(lookup.body).includes(friend.email), false);
  });
});

describe('organiser applications', () => {
  test('apply → more information → approve per category with a recorded identity check', async () => {
    const m = await member('org');
    const body = { legalName: 'Test Organiser Person', phone: '+255700000123', email: m.email, country: 'Tanzania', city: 'Dar es Salaam', categories: ['SPORTS', 'GAMING'], hasExperience: true, description: 'I run weekend jogging groups and small football meetups for friends.', agreedRules: true };
    const applied = await api.request('POST', '/community/organiser-application', { token: m.token, body });
    assert.equal(applied.status, 201, JSON.stringify(applied.body));
    assert.equal(applied.body.application.status, 'SUBMITTED');
    const id = applied.body.application.id;

    const noNote = await api.request('PATCH', `/cc/organiser-applications/${id}`, { token: owner, body: { status: 'MORE_INFO' } });
    assert.equal(noNote.status, 400);
    await api.request('PATCH', `/cc/organiser-applications/${id}`, { token: owner, body: { status: 'MORE_INFO', reviewNotes: 'Please add a link to past events.' } });
    const resubmitted = await api.request('POST', '/community/organiser-application', { token: m.token, body: { ...body, links: 'https://example.org/runs' } });
    assert.equal(resubmitted.body.application.status, 'UNDER_REVIEW');

    const noCheck = await api.request('PATCH', `/cc/organiser-applications/${id}`, { token: owner, body: { status: 'APPROVED', approvedCategories: ['SPORTS'] } });
    assert.equal(noCheck.status, 400);
    const approved = await api.request('PATCH', `/cc/organiser-applications/${id}`, { token: owner, body: { status: 'APPROVED', approvedCategories: ['SPORTS'], identityCheck: 'Video call, national ID seen' } });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));

    const session = await api.request('GET', '/auth/session', { token: m.token });
    assert.deepEqual(session.body.user.organiserSections, ['SPORTS']);
    const mine = await api.request('GET', '/community/organiser-application', { token: m.token });
    assert.equal(mine.body.application.identityCheck, undefined, 'members do not see the staff note');

    const other = await member('org2');
    const denied = await api.request('GET', '/cc/organiser-applications', { token: other.token });
    assert.ok([401, 403].includes(denied.status));
  });
});

describe('Enhakkore Pass and the scanner', () => {
  test('no pass for an ordinary free activity; a QR activity issues a pass whose code holds only a token', async () => {
    const m = await member('pass');
    const open = await activity();
    const controlled = await activity({ verification: 'QR' });
    await prisma.activityParticipant.create({ data: { activityId: open.id, userId: m.id, status: 'APPROVED' } });
    await prisma.activityParticipant.create({ data: { activityId: controlled.id, userId: m.id, status: 'APPROVED' } });

    const passes = await api.request('GET', '/passes/mine', { token: m.token });
    assert.equal(passes.status, 200);
    assert.equal(passes.body.items.length, 1);
    const pass = passes.body.items[0];
    assert.equal(pass.title, controlled.title);
    assert.equal(pass.status, 'VALID');
    assert.match(pass.qrValue, /^ENH1\.[A-Za-z0-9_-]{20,}$/);
    assert.equal(pass.qrValue.includes(m.email), false);
  });

  test('scanner: only the organiser or staff; Valid → Already checked in; Not found; Cancelled after the booking is cancelled', async () => {
    const organiser = await member('scan-org');
    const guest = await member('scan-guest');
    const stranger = await member('scan-x');
    const row = await activity({ verification: 'QR', organiserUserId: organiser.id });
    const participant = await prisma.activityParticipant.create({ data: { activityId: row.id, userId: guest.id, status: 'APPROVED' } });
    const code = (await api.request('GET', '/passes/mine', { token: guest.token })).body.items[0].qrValue;

    const forbidden = await api.request('POST', '/passes/verify', { token: stranger.token, body: { listingType: 'ACTIVITY', listingId: row.id, code } });
    assert.equal(forbidden.status, 403);

    const first = await api.request('POST', '/passes/verify', { token: organiser.token, body: { listingType: 'ACTIVITY', listingId: row.id, code } });
    assert.equal(first.body.result, 'VALID', JSON.stringify(first.body));
    assert.equal(first.body.pass.holderName, 'Test scan-guest Person');
    assert.equal(JSON.stringify(first.body).includes(guest.email), false);
    const second = await api.request('POST', '/passes/verify', { token: organiser.token, body: { listingType: 'ACTIVITY', listingId: row.id, code } });
    assert.equal(second.body.result, 'ALREADY_CHECKED_IN');
    const unknown = await api.request('POST', '/passes/verify', { token: organiser.token, body: { listingType: 'ACTIVITY', listingId: row.id, code: 'ENH1.not-a-real-token-at-all' } });
    assert.equal(unknown.body.result, 'NOT_FOUND');

    const list = await api.request('GET', `/passes/listing/ACTIVITY/${row.id}`, { token: organiser.token });
    assert.equal(list.body.counts.checkedIn, 1);
    const scans = await api.request('GET', `/passes/listing/ACTIVITY/${row.id}/scans`, { token: organiser.token });
    assert.equal(scans.body.items.length, 2, 'scans with a known pass are in the audit trail');

    // A second guest whose place is then cancelled.
    const late = await member('scan-late');
    const lateRow = await prisma.activityParticipant.create({ data: { activityId: row.id, userId: late.id, status: 'APPROVED' } });
    const lateCode = (await api.request('GET', '/passes/mine', { token: late.token })).body.items[0].qrValue;
    await prisma.activityParticipant.update({ where: { id: lateRow.id }, data: { status: 'CANCELLED' } });
    await api.request('GET', '/passes/mine', { token: late.token });
    const cancelled = await api.request('POST', '/passes/verify', { token: organiser.token, body: { listingType: 'ACTIVITY', listingId: row.id, code: lateCode } });
    assert.equal(cancelled.body.result, 'CANCELLED');
    assert.ok(participant.id);
  });

  test('a typed reference for a QR pass asks for review, then staff check in manually', async () => {
    const guest = await member('ref');
    const row = await activity({ verification: 'QR' });
    await prisma.activityParticipant.create({ data: { activityId: row.id, userId: guest.id, status: 'APPROVED' } });
    const pass = (await api.request('GET', '/passes/mine', { token: guest.token })).body.items[0];
    const typed = await api.request('POST', '/passes/verify', { token: owner, body: { listingType: 'ACTIVITY', listingId: row.id, code: pass.reference } });
    assert.equal(typed.body.result, 'REVIEW');
    const manual = await api.request('POST', `/passes/${typed.body.pass.id}/check-in`, { token: owner });
    assert.equal(manual.body.result, 'VALID');
  });

  test('a changed date re-issues the pass, so the old QR no longer works', async () => {
    const guest = await member('chgdate');
    const row = await activity({ verification: 'QR' });
    await prisma.activityParticipant.create({ data: { activityId: row.id, userId: guest.id, status: 'APPROVED' } });
    const before = (await api.request('GET', '/passes/mine', { token: guest.token })).body.items[0].qrValue;
    await prisma.activity.update({ where: { id: row.id }, data: { startsAt: new Date(Date.now() + 9 * 86400000) } });
    const afterPass = (await api.request('GET', '/passes/mine', { token: guest.token })).body.items[0].qrValue;
    assert.notEqual(before, afterPass);
    const old = await api.request('POST', '/passes/verify', { token: owner, body: { listingType: 'ACTIVITY', listingId: row.id, code: before } });
    assert.equal(old.body.result, 'NOT_FOUND');
  });

  test('a trip pass exists only once the trip is confirmed', async () => {
    const booking = await prisma.booking.findFirst({ where: { status: 'CONFIRMED' }, include: { trip: true, user: true } });
    if (!booking) return; // the seed has no confirmed booking in this database
    const trip = booking.trip;
    const stage = trip.stage;
    await prisma.trip.update({ where: { id: trip.id }, data: { stage: 'REGISTRATION_OPEN' } });
    const token = await api.login(booking.user.email);
    const none = (await api.request('GET', '/passes/mine', { token })).body.items.filter((p: { listingType: string; status: string }) => p.listingType === 'TRIP' && p.status === 'VALID');
    assert.equal(none.length, 0);
    await prisma.trip.update({ where: { id: trip.id }, data: { stage: 'TRIP_CONFIRMED' } });
    const some = (await api.request('GET', '/passes/mine', { token })).body.items.filter((p: { listingType: string; status: string }) => p.listingType === 'TRIP' && p.status === 'VALID');
    assert.ok(some.length >= 1);
    await prisma.trip.update({ where: { id: trip.id }, data: { stage } });
  });

  test('offline bundle: hashed tokens, short names, signed and time-limited; synced scans return the real result', async () => {
    const guest = await member('off');
    const row = await activity({ verification: 'QR' });
    await prisma.activityParticipant.create({ data: { activityId: row.id, userId: guest.id, status: 'APPROVED' } });
    const code: string = (await api.request('GET', '/passes/mine', { token: guest.token })).body.items[0].qrValue;
    const bundle = await api.request('GET', `/passes/listing/ACTIVITY/${row.id}/offline`, { token: owner });
    assert.equal(bundle.status, 200);
    assert.ok(bundle.body.signature);
    assert.ok(new Date(bundle.body.expiresAt).getTime() > Date.now());
    const text = JSON.stringify(bundle.body);
    assert.equal(text.includes(code.slice(5)), false, 'raw tokens are not in the bundle');
    assert.equal(bundle.body.entries[0].name, 'Test P.');

    const sync = await api.request('POST', '/passes/offline-sync', { token: owner, body: { listingType: 'ACTIVITY', listingId: row.id, scans: [{ code, scannedAt: new Date().toISOString() }, { code, scannedAt: new Date().toISOString() }] } });
    assert.deepEqual(sync.body.results.map((r: { result: string }) => r.result), ['VALID', 'ALREADY_CHECKED_IN']);
    const logged = await prisma.passScan.findMany({ where: { pass: { listingId: row.id } } });
    assert.ok(logged.every((scan) => scan.offline));
  });
});

describe('group chats for listings', () => {
  test('participants talk once the organiser switches chat on; outsiders cannot see it; names show as usernames', async () => {
    const organiser = await member('chat-org', `chat_org_${stamp}`);
    const guest = await member('chat-guest', `chat_guest_${stamp}`);
    const outsider = await member('chat-out');
    const row = await activity({ organiserUserId: organiser.id });
    await prisma.activityParticipant.create({ data: { activityId: row.id, userId: guest.id, status: 'APPROVED' } });

    const off = await api.request('POST', '/experience-chats/open', { token: guest.token, body: { subjectType: 'ACTIVITY', subjectId: row.id } });
    assert.equal(off.status, 403);
    const notOrganiser = await api.request('POST', '/experience-chats/settings', { token: guest.token, body: { subjectType: 'ACTIVITY', subjectId: row.id, enabled: true } });
    assert.equal(notOrganiser.status, 403);
    const on = await api.request('POST', '/experience-chats/settings', { token: organiser.token, body: { subjectType: 'ACTIVITY', subjectId: row.id, enabled: true } });
    assert.equal(on.status, 200);

    const opened = await api.request('POST', '/experience-chats/open', { token: guest.token, body: { subjectType: 'ACTIVITY', subjectId: row.id } });
    assert.equal(opened.status, 200);
    const again = await api.request('POST', '/experience-chats/open', { token: organiser.token, body: { subjectType: 'ACTIVITY', subjectId: row.id } });
    assert.equal(again.body.id, opened.body.id, 'one chat per listing');

    const posted = await api.request('POST', `/experience-chats/${opened.body.id}/messages`, { token: guest.token, body: { body: 'See you at the start line!' } });
    assert.equal(posted.status, 201, JSON.stringify(posted.body));
    assert.equal(posted.body.author.name, `@chat_guest_${stamp}`);

    const hidden = await api.request('GET', `/experience-chats/${opened.body.id}`, { token: outsider.token });
    assert.equal(hidden.status, 404);
    const announce = await api.request('POST', `/experience-chats/${opened.body.id}/messages`, { token: guest.token, body: { body: 'Hello all', kind: 'ANNOUNCEMENT' } });
    assert.equal(announce.status, 403);

    const list = await api.request('GET', '/experience-chats', { token: guest.token });
    assert.ok(list.body.items.some((item: { id: string }) => item.id === opened.body.id));

    // Switched off: history stays readable, nobody can post.
    await api.request('POST', '/experience-chats/settings', { token: organiser.token, body: { subjectType: 'ACTIVITY', subjectId: row.id, enabled: false } });
    const read = await api.request('GET', `/experience-chats/${opened.body.id}/messages`, { token: guest.token });
    assert.equal(read.body.items.length, 1);
    const blocked = await api.request('POST', `/experience-chats/${opened.body.id}/messages`, { token: guest.token, body: { body: 'Anyone?' } });
    assert.equal(blocked.status, 403);
  });
});

describe('community access types', () => {
  test('private communities need an invitation or the password (no open requests); paid ones say plainly that online payment is off', async () => {
    const m = await member('comm');
    const privateOne = await prisma.community.create({ data: { slug: `r6-private-${stamp}`, name: 'R6 Private Club', summary: 'Test', status: 'PUBLISHED', accessType: 'PRIVATE' } });
    const paidOne = await prisma.community.create({ data: { slug: `r6-paid-${stamp}`, name: 'R6 Paid Club', summary: 'Test', status: 'PUBLISHED', accessType: 'PAID', membershipPrice: 10000, membershipCurrency: 'TZS' } });

    const asked = await api.request('POST', `/community/communities/${privateOne.slug}/join`, { token: m.token, body: { message: 'I play every Sunday.' } });
    assert.equal(asked.status, 403);
    assert.equal(asked.body.error.code, 'private_group');
    const page = await api.request('GET', `/public/communities/${privateOne.slug}`, { token: m.token });
    assert.equal(page.body.viewer.isMember, false);
    assert.equal(page.body.locked, true);

    // The team can still add someone directly.
    await prisma.communityMember.create({ data: { communityId: privateOne.id, userId: m.id, status: 'PENDING' } });
    await api.request('POST', `/cc/communities/${privateOne.id}/members/${m.id}/role`, { token: owner, body: { role: 'APPROVE' } });
    const after = await api.request('GET', `/public/communities/${privateOne.slug}`, { token: m.token });
    assert.equal(after.body.viewer.isMember, true);

    const paid = await api.request('POST', `/community/communities/${paidOne.slug}/join`, { token: m.token, body: {} });
    assert.equal(paid.body.status, 'PENDING');
    assert.match(paid.body.message, /not switched on/);
  });
});

describe('reservation requests', () => {
  test('sending the same request twice returns the first reference instead of a duplicate', async () => {
    const m = await member('dup');
    const body = { type: 'TABLE', subjectType: 'PLACE', subjectTitle: 'Test Restaurant', name: 'Dup Tester', phone: '+255 700 000 999', startDate: '2027-02-14', people: 2, message: 'Table for two at 8pm please.', details: { time: '20:00' } };
    const first = await api.request('POST', '/community/enquiries', { token: m.token, body });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const second = await api.request('POST', '/community/enquiries', { token: m.token, body });
    assert.equal(second.status, 200);
    assert.equal(second.body.duplicate, true);
    assert.equal(second.body.reference, first.body.reference);
    assert.equal(await prisma.enquiry.count({ where: { reference: first.body.reference } }), 1);
  });
});
