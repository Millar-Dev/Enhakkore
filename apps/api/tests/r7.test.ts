import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { Request } from 'express';
import { modeFor } from '../src/routes/assistant';
import { runTool, toolsFor } from '../src/services/assistant';
import { ACCOUNTS, prisma, startApi, type Api } from './helpers';

/**
 * R7: account-required reservations and venue enquiries, the trip deposit with
 * receipt verification, official communities and the jogging timetable, study
 * groups and their moderation, and the Bethany / Ariel assistant's safeguards.
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

describe('reservations', () => {
  test('a venue enquiry needs the event type, is saved with a reference, notifies the team, and the customer can cancel it', async () => {
    const { token } = await api.register('venue');
    const body = { type: 'VENUE', subjectType: 'PLACE', subjectTitle: 'Test Garden Venue', name: 'Neema Test', phone: '+255 700 000 777', email: 'neema@test.local', startDate: '2027-03-20', people: 120, message: 'Wedding reception, garden setting.', details: { location: 'Dar es Salaam', budget: 'TZS 8,000,000' } };
    const missing = await api.request('POST', '/community/enquiries', { token, body });
    assert.equal(missing.status, 422);
    const sent = await api.request('POST', '/community/enquiries', { token, body: { ...body, details: { ...body.details, eventType: 'Wedding' } } });
    assert.equal(sent.status, 201, JSON.stringify(sent.body));
    assert.match(sent.body.reference, /^ENQ-/);
    assert.match(sent.body.message, /not a booking/);
    const ownerUser = await prisma.user.findFirstOrThrow({ where: { email: ACCOUNTS.admin } });
    const notice = await prisma.notification.findFirst({ where: { userId: ownerUser.id, title: { contains: sent.body.reference } } });
    assert.ok(notice, 'the responsible team sees it in the control centre');

    const cancelled = await api.request('POST', `/community/enquiries/${sent.body.reference}/cancel`, { token });
    assert.equal(cancelled.body.status, 'CANCELLED');
    const other = await api.register('venue-x');
    const notMine = await api.request('POST', `/community/enquiries/${sent.body.reference}/cancel`, { token: other.token });
    assert.equal(notMine.status, 404);
  });
});

describe('Arusha Escape deposit and receipts', () => {
  test('deposit is part of the price; a receipt is verified by the team before the place is confirmed', async () => {
    const page = await api.request('GET', '/public/trips/arusha-escape');
    assert.equal(page.body.depositAmount, 5_000);
    const departure = page.body.departures.find((item: { bookable: boolean }) => item.bookable);
    const traveller = await api.register('deposit');
    const applied = await api.request('POST', '/community/trips/apply', { token: traveller.token, body: { departureId: departure.id, travellers: [{ fullName: 'Deposit Traveller' }], contactPhone: '+255 700 222 333' } });
    assert.equal(applied.status, 201, JSON.stringify(applied.body));
    const ref = applied.body.reference;

    const payment = await api.request('GET', `/community/applications/${ref}/payment`, { token: traveller.token });
    assert.equal(payment.body.summary.total, 270_000);
    assert.equal(payment.body.summary.deposit, 5_000);
    assert.equal(payment.body.summary.balanceAfterDeposit, 265_000, 'the deposit is deducted, not added');
    assert.equal(payment.body.paymentStatus, 'AWAITING_PAYMENT');
    assert.equal(payment.body.mobileMoney.available, false, 'no gateway is connected, and the page says so');
    assert.ok(payment.body.currencies.filter((item: { available: boolean }) => !item.available).every((item: { rate: number }) => item.rate === 0), 'no invented exchange rates');

    const mobile = await api.request('POST', `/community/applications/${ref}/mobile-money`, { token: traveller.token, body: { provider: 'M-PESA', phone: '0712345678', amount: 5000 } });
    assert.equal(mobile.status, 503);
    assert.equal(mobile.body.error.code, 'payments_not_configured');

    const noEvidence = await api.request('POST', `/community/applications/${ref}/receipts`, { token: traveller.token, body: { amount: 5000, methodName: 'M-Pesa', acceptedTerms: true } });
    assert.equal(noEvidence.status, 400);
    const stranger = await api.register('deposit-x');
    const otherBooking = await api.request('POST', `/community/applications/${ref}/receipts`, { token: stranger.token, body: { amount: 5000, methodName: 'M-Pesa', transactionRef: 'X1', acceptedTerms: true } });
    assert.equal(otherBooking.status, 404);

    const receipt = await api.request('POST', `/community/applications/${ref}/receipts`, { token: traveller.token, body: { amount: 5000, methodName: 'M-Pesa', transactionRef: 'QK12AB34', payerPhone: '0712345678', acceptedTerms: true } });
    assert.equal(receipt.status, 201, JSON.stringify(receipt.body));
    let booking = await prisma.booking.findUniqueOrThrow({ where: { reference: ref } });
    assert.equal(booking.paymentStatus, 'RECEIPT_SUBMITTED');
    assert.equal(booking.status, 'APPLIED', 'a receipt alone confirms nothing');

    const row = await prisma.paymentReceipt.findUniqueOrThrow({ where: { reference: receipt.body.reference } });
    const member = await api.request('POST', `/cc/receipts/${row.id}/decision`, { token: traveller.token, body: { action: 'approve' } });
    assert.ok([401, 403].includes(member.status), 'members cannot approve payments');
    const rejectNoNote = await api.request('POST', `/cc/receipts/${row.id}/decision`, { token: owner, body: { action: 'reject' } });
    assert.equal(rejectNoNote.status, 400);
    const approved = await api.request('POST', `/cc/receipts/${row.id}/decision`, { token: owner, body: { action: 'approve', amount: 5000 } });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    booking = await prisma.booking.findUniqueOrThrow({ where: { reference: ref } });
    assert.equal(booking.status, 'CONFIRMED');
    assert.equal(booking.paymentStatus, 'APPROVED');
    assert.equal(booking.amountPaid, 5_000);
    const detail = await api.request('GET', `/community/applications/${ref}`, { token: traveller.token });
    assert.ok(detail.body.groupId, 'the trip group chat opens');
    assert.equal(detail.body.paymentSummary.outstanding, 265_000);
    const ledger = await prisma.financeTransaction.findFirst({ where: { bookingId: booking.id } });
    assert.ok(ledger, 'approved money is in the books');
    const logged = await prisma.auditLog.findFirst({ where: { entityType: 'receipts', entityId: row.id } });
    assert.ok(logged, 'the decision is audited');
  });
});

describe('official communities and study groups', () => {
  test('starter communities exist; the jogging community shows its timetable with the route still to be confirmed', async () => {
    const list = await api.request('GET', '/public/communities');
    const slugs = list.body.items.map((item: { slug: string }) => item.slug);
    for (const slug of ['enhakkore-jogging-running', 'enhakkore-football', 'enhakkore-study-groups']) assert.ok(slugs.includes(slug), slug);
    const jog = await api.request('GET', '/public/communities/enhakkore-jogging-running');
    assert.equal(jog.body.community.official, true);
    assert.equal(jog.body.community.schedule, 'Every Saturday · 06:30');
    assert.equal(jog.body.community.meetingVerified, false);
    const activity = await prisma.activity.findUniqueOrThrow({ where: { slug: 'saturday-community-jog' } });
    assert.equal(activity.status, 'DRAFT', 'stays a draft until the team verifies the route');
    assert.ok((await prisma.activitySession.count({ where: { activityId: activity.id } })) >= 8);
    assert.equal(jog.body.sessions.length, 0, 'draft sessions are not public');
  });

  test('communities matching a member’s interests come first', async () => {
    const { token } = await api.register('interests');
    await api.request('PATCH', '/me', { token, body: { interests: ['Football'] } });
    const list = await api.request('GET', '/public/communities', { token });
    assert.equal(list.body.items[0].slug, 'enhakkore-football');
    assert.equal(list.body.items[0].recommended, true);
  });

  test('a member starts a private study group without approval and moderates it', async () => {
    const creator = await api.register('study-admin');
    const learner = await api.register('study-member');
    const outsider = await api.register('study-out');
    const created = await api.request('POST', '/community/study-groups', { token: creator.token, body: { name: `Pharmacology ${stamp}`, subject: 'Clinical Medicine', topic: 'Pharmacology', description: 'Weekly revision of drug classes and mechanisms.', mode: 'ONLINE', visibility: 'PRIVATE' } });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const group = await prisma.community.findUniqueOrThrow({ where: { slug: created.body.slug } });
    assert.equal(group.kind, 'STUDY_GROUP');
    assert.equal(group.status, 'PUBLISHED');

    const ask = await api.request('POST', `/community/communities/${group.slug}/join`, { token: learner.token, body: { message: 'Second-year student.' } });
    assert.equal(ask.body.status, 'PENDING');
    const notAdmin = await api.request('POST', `/community/study-groups/${group.slug}/members/${learner.id}`, { token: outsider.token, body: { action: 'approve' } });
    assert.equal(notAdmin.status, 403);
    const ok = await api.request('POST', `/community/study-groups/${group.slug}/members/${learner.id}`, { token: creator.token, body: { action: 'approve' } });
    assert.equal(ok.status, 200);

    const chat = await api.request('POST', '/experience-chats/open', { token: learner.token, body: { subjectType: 'COMMUNITY', subjectId: group.id } });
    assert.equal(chat.status, 200, JSON.stringify(chat.body));
    const noFile = await api.request('POST', `/experience-chats/${chat.body.id}/messages`, { token: learner.token, body: { body: 'Voice message', kind: 'VOICE' } });
    assert.equal(noFile.status, 400);
    const voice = await api.request('POST', `/experience-chats/${chat.body.id}/messages`, { token: learner.token, body: { body: 'Voice message', kind: 'VOICE', attachments: ['https://example.org/voice.webm'] } });
    assert.equal(voice.status, 201);
    const resources = await api.request('GET', `/experience-chats/${chat.body.id}/resources`, { token: learner.token });
    assert.equal(resources.body.items.length, 1);

    await api.request('POST', `/community/study-groups/${group.slug}/members/${learner.id}`, { token: creator.token, body: { action: 'mute', hours: 2 } });
    const muted = await api.request('POST', `/experience-chats/${chat.body.id}/messages`, { token: learner.token, body: { body: 'Hello?' } });
    assert.equal(muted.status, 403);
    assert.match(muted.body.error.message, /muted/);

    const mine = await api.request('GET', '/community/study-groups/mine', { token: creator.token });
    assert.equal(mine.body.items[0].role, 'ADMIN');
    const listed = await api.request('GET', '/public/communities?kind=STUDY_GROUP');
    assert.ok(listed.body.items.some((item: { slug: string }) => item.slug === group.slug));
  });
});

describe('assistant (Bethany and Ariel)', () => {
  test('without an API key it records the request, does nothing, and says so; it is for the owner only', async () => {
    const state = await api.request('GET', '/cc/assistant', { token: owner });
    assert.equal(state.status, 200);
    assert.equal(state.body.configured, false);
    const answer = await api.request('POST', '/cc/assistant', { token: owner, body: { prompt: 'Hello Ariel, how are we doing?' } });
    assert.equal(answer.body.status, 'NOT_CONFIGURED');
    assert.equal(answer.body.mode, 'ARIEL');
    const member = await api.register('assistant');
    const denied = await api.request('GET', '/cc/assistant', { token: member.token });
    assert.ok([401, 403].includes(denied.status));
  });

  test('activation phrases pick the mode', () => {
    assert.deepEqual(modeFor('Hey Bethany, add a hotel in Arusha'), { mode: 'BETHANY', text: 'add a hotel in Arusha' });
    assert.deepEqual(modeFor('Hello Ariel. What is waiting?'), { mode: 'ARIEL', text: 'What is waiting?' });
    assert.equal(modeFor('report please', 'BETHANY').mode, 'BETHANY');
  });

  test('Ariel is read-only; sensitive actions wait for confirmation; permissions are checked on the server', async () => {
    const ownerUser = await prisma.user.findFirstOrThrow({ where: { email: ACCOUNTS.admin } });
    const req = { auth: { id: ownerUser.id, name: ownerUser.name, email: ownerUser.email, permissions: ['*'] }, headers: {}, ip: '127.0.0.1' } as unknown as Request;
    assert.ok(toolsFor('ARIEL').every((tool) => tool.readOnly));
    const arielWrite = await runTool('ARIEL', 'create_draft_place', { name: 'X', section: 'STAYS', city: 'Arusha' }, { req, permissions: ['*'] });
    assert.equal(arielWrite.ok, false);

    const overview = await runTool('ARIEL', 'platform_overview', {}, { req, permissions: ['*'] });
    assert.equal(overview.ok, true);
    assert.equal(typeof (overview.result as { members: number }).members, 'number');

    const draft = await runTool('BETHANY', 'create_draft_place', { name: `Assistant Test Lodge ${stamp}`, section: 'STAYS', city: 'Arusha' }, { req, permissions: ['*'] });
    assert.equal(draft.ok, true, draft.error);
    const place = await prisma.place.findUniqueOrThrow({ where: { id: (draft.result as { id: string }).id } });
    assert.equal(place.status, 'DRAFT', 'never published by the assistant on its own');
    assert.equal(place.infoSource, 'UNVERIFIED');

    const hide = await runTool('BETHANY', 'set_visibility', { kind: 'places', id: place.id, action: 'archive' }, { req, permissions: ['*'] });
    assert.ok(hide.pending, 'archiving waits for confirmation');
    assert.equal((await prisma.place.findUniqueOrThrow({ where: { id: place.id } })).status, 'DRAFT');
    const confirmed = await runTool('BETHANY', 'set_visibility', { kind: 'places', id: place.id, action: 'archive' }, { req, permissions: ['*'] }, true);
    assert.equal(confirmed.ok, true, confirmed.error);

    const noPermission = await runTool('BETHANY', 'create_draft_place', { name: 'Y', section: 'FOOD', city: 'Moshi' }, { req, permissions: ['enquiries.view'] });
    assert.equal(noPermission.ok, false);
    assert.match(noPermission.error ?? '', /permission/);
  });
});
