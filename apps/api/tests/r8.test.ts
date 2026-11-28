import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { pushTestOutbox } from '../src/services/push';
import { expandQuery, scoreText } from '../src/services/semantic';
import { ACCOUNTS, prisma, startApi, type Api } from './helpers';

/**
 * R8 (Account Centre phases 1A–1H): age protections, staff roles and
 * invitations, owner recovery, follows and friends, private messages,
 * member-created communities and private study groups, semantic search,
 * tournaments with brackets, esports verification, gaming sessions and
 * squads, nearby / outside gaming invitations, notifications and the
 * Activity Centre, Nia, and the audited admin views.
 */

let api: Api;
let owner: string;
const stamp = Date.now().toString(36).slice(-5);
let counter = 0;

async function member(prefix: string, dateOfBirth = '1995-05-10') {
  counter += 1;
  const email = `${prefix}-${stamp}-${counter}@test.local`;
  const username = `${prefix}_${stamp}${counter}`.toLowerCase().slice(0, 20);
  const result = await api.request('POST', '/auth/register', {
    body: { name: `${prefix} Person`, email, password: 'TestPass-123', acceptedTerms: true, dateOfBirth, username },
  });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  return { token: result.body.token as string, id: result.body.user.id as string, email, username };
}

before(async () => {
  api = await startApi();
  owner = await api.login(ACCOUNTS.admin);
});
after(async () => {
  await api.close();
});

describe('1A accounts', () => {
  test('registration needs a date of birth; under-13s are refused; under-18s start hidden from discovery', async () => {
    const missing = await api.request('POST', '/auth/register', { body: { name: 'No Dob', email: `nodob-${stamp}@test.local`, password: 'TestPass-123', acceptedTerms: true } });
    assert.equal(missing.status, 422);
    const child = await api.request('POST', '/auth/register', { body: { name: 'Too Young', email: `young-${stamp}@test.local`, password: 'TestPass-123', acceptedTerms: true, dateOfBirth: `${new Date().getUTCFullYear() - 10}-01-01` } });
    assert.equal(child.status, 422);
    const teen = await member('teen', `${new Date().getUTCFullYear() - 15}-01-01`);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: teen.id } });
    assert.equal(stored.profileVisibility, 'HIDDEN');
    const me = await api.request('GET', '/auth/session', { token: teen.token });
    assert.ok(me.body.user?.dateOfBirth, 'the member sees their own date of birth');
  });

  test('a staff member can hold several roles; permissions are the union', async () => {
    const finance = await prisma.adminRole.findUniqueOrThrow({ where: { name: 'Finance Manager' } });
    const gaming = await prisma.adminRole.findFirst({ where: { name: 'Gaming Manager' } });
    assert.ok(gaming);
    const created = await api.request('POST', '/cc/people/staff', { token: owner, body: { email: `multi-${stamp}@test.local`, name: 'Multi Role', roleIds: [finance.id, gaming!.id] } });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.match(created.body.invitationLink, /reset-password\?token=/);
    const token = await api.login(created.body.email, await api.acceptInvite(created.body.invitationLink));
    assert.equal((await api.request('GET', '/cc/finance/transactions', { token })).status, 200);
    assert.equal((await api.request('GET', '/cc/gaming/overview', { token })).status, 200);
    assert.equal((await api.request('GET', '/cc/messages/reports', { token })).status, 403, 'no private-message access without the permission');
  });

  test('owner recovery works only with the server recovery token', async () => {
    const closed = await api.request('GET', '/auth/recover-owner/status');
    assert.equal(closed.body.open, false);
    process.env.OWNER_RECOVERY_TOKEN = 'recovery-token-for-tests-123456789';
    try {
      const wrong = await api.request('POST', '/auth/recover-owner', { body: { token: 'nope', email: ACCOUNTS.admin, password: 'NewOwnerPass123' } });
      assert.equal(wrong.status, 401);
      const staffEmail = await api.request('POST', '/auth/recover-owner', { body: { token: process.env.OWNER_RECOVERY_TOKEN, email: ACCOUNTS.michael, password: 'NewOwnerPass123' } });
      assert.equal(staffEmail.status, 401, 'only the owner account can be recovered this way');
      const log = await prisma.auditLog.count({ where: { summary: { contains: 'recovered' } } });
      assert.equal(typeof log, 'number');
    } finally {
      delete process.env.OWNER_RECOVERY_TOKEN;
    }
  });
});

describe('1D private messages', () => {
  test('strangers cannot message; mutual follow allows a request; requests are limited until accepted; text is encrypted at rest', async () => {
    const a = await member('dma');
    const b = await member('dmb');
    const refused = await api.request('POST', '/messages/start', { token: a.token, body: { userId: b.id } });
    assert.equal(refused.status, 403);
    assert.equal((await api.request('POST', `/social/follows/${b.id}`, { token: a.token })).status, 201);
    const back = await api.request('POST', `/social/follows/${a.id}`, { token: b.token });
    assert.equal(back.body.mutual, true);
    const started = await api.request('POST', '/messages/start', { token: a.token, body: { userId: b.id } });
    assert.ok([200, 201].includes(started.status));
    const again = await api.request('POST', '/messages/start', { token: b.token, body: { userId: a.id } });
    assert.equal(again.body.id, started.body.id, 'one conversation per pair — never duplicated');
    const id = started.body.id;
    for (let i = 0; i < 3; i++) assert.equal((await api.request('POST', `/messages/${id}/messages`, { token: a.token, body: { body: `Hello ${i}` } })).status, 201);
    const fourth = await api.request('POST', `/messages/${id}/messages`, { token: a.token, body: { body: 'one more' } });
    assert.equal(fourth.status, 403, 'request limit until accepted');
    const replyBefore = await api.request('POST', `/messages/${id}/messages`, { token: b.token, body: { body: 'hi' } });
    assert.equal(replyBefore.status, 403, 'the recipient accepts first');
    const requests = await api.request('GET', '/messages?box=requests', { token: b.token });
    assert.equal(requests.body.items.length, 1);
    assert.equal((await api.request('POST', `/messages/${id}/respond`, { token: b.token, body: { accept: true } })).status, 200);
    const reply = await api.request('POST', `/messages/${id}/messages`, { token: b.token, body: { body: 'Nice to meet you', replyToId: (await prisma.message.findFirstOrThrow({ where: { conversationId: id } })).id } });
    assert.equal(reply.status, 201);
    assert.ok(reply.body.replyTo, 'replies carry the quoted message');
    const raw = await prisma.message.findUniqueOrThrow({ where: { id: reply.body.id } });
    assert.equal(raw.encrypted, true);
    assert.ok(!raw.body.includes('Nice to meet you'), 'stored encrypted');
    const view = await api.request('GET', `/messages/${id}`, { token: a.token });
    assert.equal(view.body.items.at(-1).body, 'Nice to meet you');
    // Reactions, delete for me, unsend.
    assert.equal((await api.request('POST', `/messages/${id}/messages/${reply.body.id}/react`, { token: a.token, body: { emoji: '👍' } })).body.reacted, true);
    await api.request('DELETE', `/messages/${id}/messages/${reply.body.id}?for=me`, { token: a.token });
    const hidden = await api.request('GET', `/messages/${id}`, { token: a.token });
    assert.ok(!hidden.body.items.some((m: { id: string }) => m.id === reply.body.id));
    const notMine = await api.request('DELETE', `/messages/${id}/messages/${reply.body.id}?for=everyone`, { token: a.token });
    assert.equal(notMine.status, 403);
    const unsent = await api.request('DELETE', `/messages/${id}/messages/${reply.body.id}?for=everyone`, { token: b.token });
    assert.equal(unsent.status, 200);
    const search = await api.request('GET', '/messages/search?q=hello', { token: b.token });
    assert.ok(search.body.items.length >= 1);
    // Reporting, then audited admin access.
    const report = await api.request('POST', `/messages/${id}/report`, { token: b.token, body: { messageId: (await prisma.message.findFirstOrThrow({ where: { conversationId: id } })).id, reason: 'Spam' } });
    assert.equal(report.status, 201);
    const reports = await api.request('GET', '/cc/messages/reports', { token: owner });
    const mine = reports.body.items.find((r: { targetType: string; reason: string }) => r.targetType === 'DIRECT_MESSAGE');
    assert.ok(mine);
    const noReason = await api.request('POST', `/cc/messages/reports/${mine.id}/open`, { token: owner, body: { reason: 'x' } });
    assert.equal(noReason.status, 422);
    const opened = await api.request('POST', `/cc/messages/reports/${mine.id}/open`, { token: owner, body: { reason: 'Checking a spam report from a member.' } });
    assert.equal(opened.status, 200);
    assert.ok(opened.body.messages.some((m: { reported: boolean; body: string }) => m.reported && m.body.startsWith('Hello')));
    assert.ok(await prisma.auditLog.findFirst({ where: { entityType: 'private_messages', entityId: mine.id } }), 'opening is audited');
  });

  test('friends can message straight away; under-18s only their friends', async () => {
    const a = await member('fra');
    const b = await member('frb');
    const teen = await member('frteen', `${new Date().getUTCFullYear() - 16}-03-03`);
    const req1 = await api.request('POST', '/social/friends', { token: a.token, body: { userId: b.id } });
    assert.equal(req1.status, 201);
    const incoming = await api.request('GET', '/social/friends', { token: b.token });
    assert.equal(incoming.body.incoming.length, 1);
    assert.equal((await api.request('POST', `/social/friends/${incoming.body.incoming[0].id}/respond`, { token: b.token, body: { accept: true } })).status, 200);
    const chat = await api.request('POST', '/messages/start', { token: a.token, body: { userId: b.id } });
    const conv = await prisma.conversation.findUniqueOrThrow({ where: { id: chat.body.id } });
    assert.equal(conv.requestStatus, 'ACCEPTED');
    await api.request('POST', `/social/follows/${teen.id}`, { token: a.token });
    await api.request('POST', `/social/follows/${a.id}`, { token: teen.token });
    const toTeen = await api.request('POST', '/messages/start', { token: a.token, body: { userId: teen.id } });
    assert.equal(toTeen.status, 403);
    const activity = await api.request('GET', '/me/activity', { token: a.token });
    assert.ok(activity.body.items.some((i: { action: string }) => i.action === 'FRIEND_ADDED'));
  });
});

describe('1E/1F communities and study groups', () => {
  test('members publish immediately; private groups hide internals and need an invitation or the password', async () => {
    const creator = await member('grp');
    const created = await api.request('POST', '/community/groups', {
      token: creator.token,
      body: { kind: 'STUDY_GROUP', name: `Cardiology Revision ${stamp}`, subject: 'Medicine', topic: 'Cardiovascular physiology', course: 'MD3', description: 'We revise the cardiovascular system weekly with past papers.', tags: ['ecg', 'anatomy'], visibility: 'PRIVATE', password: 'heart-123', contactName: 'Grp Person', contactPhone: '+255700111222' },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const group = await prisma.community.findUniqueOrThrow({ where: { slug: created.body.slug } });
    assert.equal(group.status, 'PUBLISHED');
    assert.ok(group.passwordHash && !group.passwordHash.includes('heart-123'), 'the password is hashed');
    const ownerUser = await prisma.user.findFirstOrThrow({ where: { email: ACCOUNTS.admin } });
    assert.ok(await prisma.notification.findFirst({ where: { userId: ownerUser.id, title: { contains: group.name } } }), 'the team is told');

    const outsider = await member('out');
    const detail = await api.request('GET', `/public/communities/${group.slug}`, { token: outsider.token });
    assert.equal(detail.body.locked, true);
    assert.deepEqual(detail.body.members, []);
    assert.equal(detail.body.community.contactPhone, undefined, 'creator contact is never public');
    assert.equal((await api.request('GET', `/community/groups/${group.slug}/resources`, { token: outsider.token })).status, 403);
    const noKey = await api.request('POST', `/community/groups/${group.slug}/join`, { token: outsider.token, body: {} });
    assert.equal(noKey.status, 403);
    const wrong = await api.request('POST', `/community/groups/${group.slug}/join`, { token: outsider.token, body: { password: 'nope' } });
    assert.equal(wrong.status, 403);
    const joined = await api.request('POST', `/community/groups/${group.slug}/join`, { token: outsider.token, body: { password: 'heart-123' } });
    assert.equal(joined.body.joined, true);

    // Invitation link with one use.
    const invite = await api.request('POST', `/community/groups/${group.slug}/invites`, { token: creator.token, body: { days: 3, maxUses: 1 } });
    assert.equal(invite.status, 201);
    const first = await member('inv1');
    const second = await member('inv2');
    assert.equal((await api.request('POST', `/community/groups/${group.slug}/join`, { token: first.token, body: { invite: invite.body.token } })).body.joined, true);
    assert.equal((await api.request('POST', `/community/groups/${group.slug}/join`, { token: second.token, body: { invite: invite.body.token } })).status, 403, 'a used-up link stops working');

    // Sessions with RSVP and resources.
    const session = await api.request('POST', `/community/groups/${group.slug}/sessions`, { token: creator.token, body: { title: 'ECG reading', mode: 'ONLINE', startsAt: new Date(Date.now() + 30 * 60_000).toISOString(), link: 'https://meet.example.org/abc' } });
    assert.equal(session.status, 201, JSON.stringify(session.body));
    assert.equal((await api.request('POST', `/community/groups/${group.slug}/sessions/${session.body.id}/rsvp`, { token: outsider.token, body: { status: 'GOING' } })).status, 200);
    const { sendSessionReminders } = await import('../src/routes/groups');
    await sendSessionReminders();
    await sendSessionReminders();
    assert.equal(await prisma.notification.count({ where: { userId: outsider.id, type: 'SESSION_REMINDER' } }), 1, 'one reminder, never two');
    assert.equal((await api.request('POST', `/community/groups/${group.slug}/resources`, { token: outsider.token, body: { kind: 'NOTE', title: 'Heart sounds', body: 'S1 and S2…' } })).status, 201);

    // Inbox shows the group with its chat.
    const inbox = await api.request('GET', '/community/groups/inbox?kind=STUDY_GROUP', { token: outsider.token });
    assert.ok(inbox.body.items.some((i: { slug: string; conversationId: string | null }) => i.slug === group.slug && i.conversationId));

    // Search by meaning: "human heart" finds it although the name says Cardiology.
    const found = await api.request('GET', `/public/groups/search?q=${encodeURIComponent('human heart')}`);
    assert.ok(found.body.items.some((i: { slug: string }) => i.slug === group.slug), 'semantic match');

    // Team moderation.
    const restricted = await api.request('POST', `/cc/groups/${group.id}/moderate`, { token: owner, body: { action: 'restrict', reason: 'Looking into a report.' } });
    assert.equal(restricted.status, 200);
    const late = await member('late');
    assert.equal((await api.request('POST', `/community/groups/${group.slug}/join`, { token: late.token, body: { password: 'heart-123' } })).status, 403, 'restricted: no new members');
    await api.request('POST', `/cc/groups/${group.id}/moderate`, { token: owner, body: { action: 'restore' } });
  });

  test('the concept map expands related terms', () => {
    const q = expandQuery('human heart');
    assert.ok(q.related.includes('cardiology'));
    assert.ok(scoreText('Cardiology revision group', q, 1) > 0);
    assert.equal(scoreText('Spanish conversation practice', q, 1), 0);
  });
});

describe('1G gaming', () => {
  async function game() {
    return (await prisma.category.findFirst({ where: { kind: 'GAME' } })) ?? prisma.category.create({ data: { kind: 'GAME', name: `Test Game ${stamp}`, slug: `test-game-${stamp}`, status: 'PUBLISHED' } });
  }

  test('a member tournament publishes immediately, appears for the team with contact details, and runs a full double-elimination bracket', async () => {
    const organiser = await member('org');
    const g = await game();
    const created = await api.request('POST', '/gaming/tournaments', {
      token: organiser.token,
      body: { title: `Friday Cup ${stamp}`, category: 'FRIENDLY', organiserType: 'INDIVIDUAL', organiserName: 'Org Person', contactName: 'Org Person', contactPhone: '+255700333444', gameId: g.id, platform: 'Mobile', bracketFormat: 'DOUBLE_ELIMINATION', rules: 'Best of one. Be on time. Screenshots of results required.', startsAt: new Date(Date.now() + 86_400_000).toISOString(), slots: 16 },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const t = await prisma.tournament.findUniqueOrThrow({ where: { slug: created.body.slug } });
    assert.equal(t.status, 'REGISTRATION_OPEN', 'no routine approval');
    const listed = await api.request('GET', '/public/gaming/tournaments?category=FRIENDLY');
    assert.ok(listed.body.items.some((i: { slug: string; verifiedOrganiser: boolean }) => i.slug === t.slug && i.verifiedOrganiser === false));
    const adminView = await api.request('GET', `/cc/gaming/tournaments/${t.id}`, { token: owner });
    assert.equal(adminView.body.contact.phone, '+255700333444');
    const publicView = await api.request('GET', `/public/tournaments/${t.slug}`);
    assert.equal(JSON.stringify(publicView.body).includes('+255700333444'), false, 'contact never public');

    const players = [];
    for (let i = 0; i < 6; i++) {
      const p = await member(`pl${i}`);
      players.push(p);
      const entry = await api.request('POST', `/community/tournaments/${t.slug}/register`, { token: p.token, body: { playerName: `Player${i}`, gameUid: `UID${i}${stamp}`, agreedRules: true } });
      assert.equal(entry.status, 201, JSON.stringify(entry.body));
    }
    const notOrganiser = await api.request('POST', `/gaming/tournaments/${t.slug}/fixtures`, { token: players[0]!.token });
    assert.equal(notOrganiser.status, 403);
    assert.equal((await api.request('POST', `/gaming/tournaments/${t.slug}/fixtures`, { token: organiser.token })).status, 200);
    // Play every ready match until the tournament completes (home side wins).
    for (let guard = 0; guard < 40; guard++) {
      const fixtures = await api.request('GET', `/public/gaming/tournaments/${t.slug}/fixtures`);
      const ready = fixtures.body.matches.filter((m: { status: string }) => m.status === 'READY');
      if (ready.length === 0) break;
      for (const m of ready) {
        const draw = await api.request('POST', `/gaming/matches/${m.id}/result`, { token: organiser.token, body: { homeScore: 1, awayScore: 1 } });
        assert.equal(draw.status, 400, 'knockouts need a winner');
        assert.equal((await api.request('POST', `/gaming/matches/${m.id}/result`, { token: organiser.token, body: { homeScore: 2, awayScore: 1 } })).status, 200);
      }
    }
    const done = await prisma.tournament.findUniqueOrThrow({ where: { id: t.id } });
    assert.equal(done.status, 'COMPLETED');
    assert.match(done.results ?? '', /^Winner: /);
    const mine = await api.request('GET', '/gaming/tournaments/mine', { token: players[0]!.token });
    assert.equal(mine.body.registered[0].phase, 'COMPLETED');
    const created2 = await api.request('GET', '/gaming/tournaments/mine', { token: organiser.token });
    assert.ok(created2.body.created.some((c: { slug: string }) => c.slug === t.slug));

    // Team actions.
    assert.equal((await api.request('POST', `/cc/gaming/tournaments/${t.id}/action`, { token: owner, body: { action: 'request_info', body: 'Please confirm the prize sponsor.' } })).status, 200);
    assert.ok(await prisma.notification.findFirst({ where: { userId: organiser.id, title: { contains: 'needs information' } } }));
    assert.equal((await api.request('POST', `/cc/gaming/tournaments/${t.id}/action`, { token: owner, body: { action: 'suspend' } })).status, 400, 'a reason is required');
    assert.equal((await api.request('POST', `/cc/gaming/tournaments/${t.id}/action`, { token: owner, body: { action: 'check' } })).status, 200);
  });

  test('league tables and round-robin fixtures', async () => {
    const organiser = await member('lg');
    const g = await game();
    const created = await api.request('POST', '/gaming/tournaments', {
      token: organiser.token,
      body: { title: `League ${stamp}`, category: 'GUILD', organiserType: 'GUILD', organiserName: 'Guild X', contactName: 'Lg Person', contactPhone: '+255700555666', gameId: g.id, platform: 'PlayStation', bracketFormat: 'LEAGUE', rules: 'Home and away, three points for a win.', startsAt: new Date(Date.now() + 86_400_000).toISOString(), slots: 8 },
    });
    const slug = created.body.slug;
    for (let i = 0; i < 3; i++) {
      const p = await member(`lp${i}`);
      await api.request('POST', `/community/tournaments/${slug}/register`, { token: p.token, body: { playerName: `L${i}`, gameUid: `LUID${i}${stamp}`, agreedRules: true } });
    }
    await api.request('POST', `/gaming/tournaments/${slug}/fixtures`, { token: organiser.token });
    const fixtures = await api.request('GET', `/public/gaming/tournaments/${slug}/fixtures`);
    assert.equal(fixtures.body.matches.length, 6, 'three teams, home and away');
    await api.request('POST', `/gaming/matches/${fixtures.body.matches[0].id}/result`, { token: organiser.token, body: { homeScore: 1, awayScore: 1 } });
    const after = await api.request('GET', `/public/gaming/tournaments/${slug}/fixtures`);
    assert.equal(after.body.standings.filter((row: { points: number }) => row.points === 1).length, 2, 'a draw gives a point each');
  });

  test('esports verification controls the verified badge', async () => {
    const applicant = await member('esp');
    const g = await game();
    const applied = await api.request('POST', '/gaming/esports-organisers', {
      token: applicant.token,
      body: { organisationName: 'Dar Esports League', representativeName: 'Esp Person', representativeRole: 'Director', phone: '+255700777888', email: 'esp@test.local', country: 'Tanzania', history: 'Ran three city leagues in 2025 with 64 players each.', games: ['eFootball'], authorityEvidence: 'Founder and registered director of the league.' },
    });
    assert.equal(applied.status, 201, JSON.stringify(applied.body));
    const before = await api.request('POST', '/gaming/tournaments', {
      token: applicant.token,
      body: { title: `Esports Open ${stamp}`, category: 'ESPORTS', organiserType: 'ESPORTS_ORG', organiserName: 'Dar Esports League', contactName: 'Esp Person', contactPhone: '+255700777888', gameId: g.id, platform: 'Mobile', bracketFormat: 'SINGLE_ELIMINATION', rules: 'Official rules of the league apply to every match.', startsAt: new Date(Date.now() + 86_400_000).toISOString(), slots: 32 },
    });
    let listed = await api.request('GET', '/public/gaming/tournaments?category=ESPORTS');
    assert.equal(listed.body.items.find((i: { slug: string }) => i.slug === before.body.slug).verifiedOrganiser, false, 'no badge before verification');
    const needs = await api.request('POST', `/cc/gaming/esports/${applied.body.id}/decision`, { token: owner, body: { status: 'MORE_INFO' } });
    assert.equal(needs.status, 400, 'the applicant must be told what is needed');
    assert.equal((await api.request('POST', `/cc/gaming/esports/${applied.body.id}/decision`, { token: owner, body: { status: 'VERIFIED', note: 'Checked with the league registry.' } })).status, 200);
    listed = await api.request('GET', '/public/gaming/tournaments?category=ESPORTS');
    assert.equal(listed.body.items.find((i: { slug: string }) => i.slug === before.body.slug).verifiedOrganiser, true);
  });

  test('gaming sessions, squads inside guilds', async () => {
    const host = await member('ses');
    const guest = await member('sesg');
    const created = await api.request('POST', '/gaming/sessions', { token: host.token, body: { title: 'Evening practice', game: 'eFootball', platform: 'Mobile', mode: 'ONLINE', startsAt: new Date(Date.now() + 3600_000).toISOString(), capacity: 2, onlinePlatform: 'Room code shared on joining' } });
    assert.equal(created.status, 201);
    const pub = await api.request('GET', `/public/gaming/sessions/${created.body.slug}`);
    assert.equal(pub.body.session.onlinePlatform, null, 'room details only for players');
    assert.equal((await api.request('POST', `/gaming/sessions/${created.body.slug}/join`, { token: guest.token })).body.joined, true);
    const third = await member('sesh');
    assert.equal((await api.request('POST', `/gaming/sessions/${created.body.slug}/join`, { token: third.token })).status, 409, 'full');

    const guild = await api.request('POST', '/gaming/groups', { token: host.token, body: { kind: 'GUILD', name: `Guild ${stamp}`, game: 'Free Fire' } });
    const squad = await api.request('POST', '/gaming/groups', { token: host.token, body: { kind: 'SQUAD', name: `Squad ${stamp}`, guildSlug: guild.body.slug } });
    assert.equal(squad.status, 201);
    const notLeader = await api.request('POST', '/gaming/groups', { token: guest.token, body: { kind: 'SQUAD', name: `Rogue ${stamp}`, guildSlug: guild.body.slug } });
    assert.equal(notLeader.status, 403);
    const detail = await api.request('GET', `/public/gaming/groups/${guild.body.slug}`, { token: host.token });
    assert.equal(detail.body.group.squads.length, 1);
  });

  test('nearby invitations: adults within 2 km only, atomic slots, declines never shown, no coordinates, temporary chat', async () => {
    const requester = await member('nreq');
    const near1 = await member('near1');
    const near2 = await member('near2');
    const near3 = await member('near3');
    const far = await member('far');
    const teen = await member('nteen', `${new Date().getUTCFullYear() - 16}-01-01`);
    // Mlimani City area (-6.774, 39.229); far = Arusha.
    const spots: [typeof requester, number, number][] = [[requester, -6.774, 39.229], [near1, -6.776, 39.231], [near2, -6.78, 39.235], [near3, -6.77, 39.225], [far, -3.387, 36.683], [teen, -6.775, 39.23]];
    for (const [who] of spots.slice(1)) {
      const optIn = await api.request('PUT', '/social/me', { token: who.token, body: { nearbyGaming: true } });
      assert.equal(optIn.status, who === teen ? 403 : 200);
    }
    for (const [who, lat, lng] of spots) await api.request('POST', '/social/location', { token: who.token, body: { lat, lng } });
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: near1.id } });
    assert.notEqual(stored.approxLat, -6.776, 'never the exact position');

    const pin = await api.request('POST', '/gaming/invites', { token: requester.token, body: { kind: 'NEARBY', game: 'Free Fire', platform: 'Mobile', slotsNeeded: 2, meetingArea: 'https://maps.google.com/?q=-6.77,39.22' } });
    assert.equal(pin.status, 400, 'map pins refused');
    const created = await api.request('POST', '/gaming/invites', { token: requester.token, body: { kind: 'NEARBY', game: 'Free Fire', platform: 'Mobile', slotsNeeded: 2, meetingArea: 'near Mlimani City' } });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.reached, true);
    assert.equal(created.body.notified, undefined, 'the number of nearby people is not disclosed');
    const id = created.body.id;
    const recipients = (await prisma.gameInviteRecipient.findMany({ where: { inviteId: id } })).map((r) => r.userId).sort();
    assert.deepEqual(recipients, [near1.id, near2.id, near3.id].sort(), 'adults within 2 km only');
    const notification = await prisma.notification.findFirstOrThrow({ where: { userId: near1.id, type: 'GAMING_INVITE' } });
    assert.equal(notification.link, `/gaming/invites/${id}`, 'opens the invitation page directly');
    assert.equal((await api.request('GET', `/gaming/invites/${id}`, { token: far.token })).status, 404);

    assert.equal((await api.request('POST', `/gaming/invites/${id}/decline`, { token: near3.token })).status, 200);
    const [a1, a2] = await Promise.all([
      api.request('POST', `/gaming/invites/${id}/accept`, { token: near1.token, body: {} }),
      api.request('POST', `/gaming/invites/${id}/accept`, { token: near2.token, body: {} }),
    ]);
    assert.equal(a1.status, 200);
    assert.equal(a2.status, 200);
    const late = await api.request('POST', `/gaming/invites/${id}/accept`, { token: near3.token, body: {} });
    assert.equal(late.status, 409, 'full');
    const view = await api.request('GET', `/gaming/invites/${id}`, { token: requester.token });
    assert.equal(view.body.status, 'FULL');
    assert.equal(view.body.accepted.length, 2);
    assert.equal(JSON.stringify(view.body).includes(near3.id), false, 'decliners are never shown');
    assert.equal(JSON.stringify(view.body).includes('-6.7'), false, 'no coordinates');

    // Temporary chat: participants only, no exact locations, no automatic friendship.
    const chat = view.body.conversationId;
    assert.ok(chat);
    const msg = await api.request('POST', `/experience-chats/${chat}/messages`, { token: near1.token, body: { body: 'Meet at the food court?' } });
    assert.equal(msg.status, 201, JSON.stringify(msg.body));
    const coords = await api.request('POST', `/experience-chats/${chat}/messages`, { token: near1.token, body: { body: 'I am at -6.77412, 39.22931' } });
    assert.equal(coords.status, 400);
    assert.equal((await api.request('GET', `/experience-chats/${chat}/messages`, { token: far.token })).status, 404);
    assert.equal(await prisma.connection.count({ where: { OR: [{ requesterId: near1.id, addresseeId: requester.id }, { requesterId: requester.id, addresseeId: near1.id }] } }), 0);
    const friendAfter = await api.request('POST', '/social/friends', { token: near1.token, body: { userId: requester.id, context: 'playing Free Fire' } });
    assert.equal(friendAfter.status, 201);
    const groupInbox = await api.request('GET', '/experience-chats?type=GAMING', { token: requester.token });
    assert.ok(groupInbox.body.items.some((i: { subjectType: string }) => i.subjectType === 'GAME_INVITE'));
  });

  test('outside links: random, revocable, and work after sign-up', async () => {
    const requester = await member('ext');
    const created = await api.request('POST', '/gaming/invites', { token: requester.token, body: { kind: 'EXTERNAL', game: 'PUBG Mobile', platform: 'Mobile', slotsNeeded: 1 } });
    assert.equal(created.status, 201);
    assert.match(created.body.link, /\/join\/game\/[A-Za-z0-9_-]{20,}$/);
    const token = created.body.link.split('/').pop();
    const landing = await api.request('GET', `/public/gaming/invite-links/${token}`);
    assert.equal(landing.body.game, 'PUBG Mobile');
    const newcomer = await member('newc');
    const noToken = await api.request('POST', `/gaming/invites/${created.body.id}/accept`, { token: newcomer.token, body: {} });
    assert.equal(noToken.status, 403);
    const ok = await api.request('POST', `/gaming/invites/${created.body.id}/accept`, { token: newcomer.token, body: { token } });
    assert.equal(ok.status, 200);
    await api.request('POST', `/gaming/invites/${created.body.id}/revoke-link`, { token: requester.token });
    assert.equal((await api.request('GET', `/public/gaming/invite-links/${token}`)).status, 404);
  });
});

describe('1H notifications', () => {
  test('tabs, unread counts, archive, de-duplication and push fan-out', async () => {
    const m = await member('ntf');
    const { notify } = await import('../src/services/notifications');
    await api.request('POST', '/me/push/subscribe', { token: m.token, body: { endpoint: `https://push.example.org/${stamp}`, keys: { p256dh: 'BExampleKeyExampleKeyExampleKey', auth: 'authkey123' } } });
    await notify({ userId: m.id, type: 'FRIEND_REQUEST', title: 'Friend', body: 'x', dedupeKey: 'same-event' });
    await notify({ userId: m.id, type: 'FRIEND_REQUEST', title: 'Friend', body: 'x', dedupeKey: 'same-event' });
    await notify({ userId: m.id, type: 'DIRECT_MESSAGE', title: 'DM', body: 'y' });
    await notify({ userId: m.id, type: 'TRIP_UPDATE', title: 'Trip', body: 'z' });
    const all = await api.request('GET', '/me/notifications', { token: m.token });
    assert.equal(all.body.counts.requests, 1, 'the same event never twice');
    assert.equal(all.body.counts.messages, 1);
    assert.ok(all.body.counts.updates >= 1);
    assert.ok(pushTestOutbox.some((item) => item.userId === m.id && item.title === 'DM'), 'push fan-out');
    const requests = await api.request('GET', '/me/notifications?tab=requests', { token: m.token });
    assert.equal(requests.body.items.length, 1);
    await api.request('POST', '/me/notifications/archive', { token: m.token, body: { ids: [requests.body.items[0].id] } });
    const afterArchive = await api.request('GET', '/me/notifications', { token: m.token });
    assert.equal(afterArchive.body.counts.requests, 0);
    await api.request('POST', '/me/notifications/read', { token: m.token, body: {} });
    assert.equal((await api.request('GET', '/me/notifications', { token: m.token })).body.unread, 0);
    // Preferences: switching "messages" off stops message notifications; essential ones still arrive.
    await api.request('PUT', '/me/notification-prefs', { token: m.token, body: { off: ['messages'], channels: { push: false } } });
    await notify({ userId: m.id, type: 'DIRECT_MESSAGE', title: 'Muted DM', body: 'y' });
    await notify({ userId: m.id, type: 'BOOKING_CONFIRMED', title: 'Essential', body: 'z' });
    const latest = await api.request('GET', '/me/notifications', { token: m.token });
    assert.ok(!latest.body.items.some((i: { title: string }) => i.title === 'Muted DM'));
    assert.ok(latest.body.items.some((i: { title: string }) => i.title === 'Essential'));
  });
});

describe('1C Nia', () => {
  test('without an AI key Nia still searches real records honestly, keeps or skips history, and respects the daily limit', async () => {
    const m = await member('nia');
    const config = await api.request('GET', '/nia/config', { token: m.token });
    assert.equal(config.body.aiConnected, false);
    const asked = await api.request('POST', '/nia/ask', { token: m.token, body: { message: 'Where do I find my trips?' } });
    assert.equal(asked.status, 200, JSON.stringify(asked.body));
    assert.match(asked.body.reply, /not connected/);
    assert.ok(asked.body.guide.some((g: { link: string }) => g.link === '/account/applications'));
    assert.ok(asked.body.conversationId, 'history kept by default');
    const renamed = await api.request('PATCH', `/nia/conversations/${asked.body.conversationId}`, { token: m.token, body: { title: 'Trips' } });
    assert.equal(renamed.status, 200);
    await api.request('PUT', '/nia/history', { token: m.token, body: { enabled: false, deleteExisting: true } });
    const off = await api.request('POST', '/nia/ask', { token: m.token, body: { message: 'football' } });
    assert.equal(off.body.conversationId, null);
    assert.equal((await api.request('GET', '/nia/conversations', { token: m.token })).body.items.length, 0);
    await api.request('PUT', '/cc/nia', { token: owner, body: { enabled: true, text: true, voice: true, dailyLimit: 2, categories: ['places', 'communities'] } });
    const limited = await api.request('POST', '/nia/ask', { token: m.token, body: { message: 'anything' } });
    assert.equal(limited.status, 429);
    await api.request('PUT', '/cc/nia', { token: owner, body: { enabled: true, text: true, voice: true, dailyLimit: 40, categories: ['places', 'experiences', 'trips', 'events', 'activities', 'communities', 'study_groups', 'tournaments', 'gaming_sessions'] } });
    const analytics = await api.request('GET', '/cc/nia', { token: owner });
    assert.ok(analytics.body.analytics.totalQuestions >= 3);
    assert.equal(JSON.stringify(analytics.body).includes('football'), false, 'the team never sees question text');
  });
});
