import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { totpCode } from '../src/lib/totp';
import { whatsappTestOutbox } from '../src/services/whatsapp';
import { ACCOUNTS, prisma, startApi, type Api } from './helpers';

/**
 * The rebuild's additions: hotel and restaurant requests with the team's
 * WhatsApp notice, partnerships, communities, gaming tournaments with teams,
 * recurring sessions, member submissions, two-factor sign-in, the popularity
 * engine and archived trip groups.
 */

let api: Api;
let owner: string;

before(async () => {
  api = await startApi();
  owner = await api.login(ACCOUNTS.admin);
});
after(async () => {
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  await api.close();
});

async function tanzania() {
  const country = await prisma.country.findUniqueOrThrow({ where: { code: 'TZ' } });
  const city = await prisma.city.findFirstOrThrow({ where: { countryId: country.id, slug: 'dar-es-salaam' } });
  return { country, city };
}

describe('hotel enquiries and restaurant reservations', () => {
  const hotel = {
    type: 'ROOM',
    subjectType: 'PLACE',
    subjectTitle: 'Test Hotel',
    name: 'Asha Mwinyi',
    phone: '+255 700 000 001',
    startDate: '2027-01-10',
    endDate: '2027-01-12',
    people: 2,
    message: 'Two adults, one room, sea view if possible.',
    details: { adults: '2', children: '0', rooms: '1', roomType: 'Double' },
  };

  test('a hotel enquiry needs its dates and a phone number', async () => {
    const missing = await api.request('POST', '/community/enquiries', { body: { ...hotel, startDate: '', phone: '', email: 'a@b.co' } });
    assert.equal(missing.status, 422);
    const backwards = await api.request('POST', '/community/enquiries', { body: { ...hotel, endDate: '2027-01-09' } });
    assert.equal(backwards.status, 422);
  });

  test('without WhatsApp credentials the enquiry is kept and its notice marked “not configured” — nothing is pretended', async () => {
    const result = await api.request('POST', '/community/enquiries', { body: hotel });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    assert.equal(result.body.notice, 'NOT_CONFIGURED');
    assert.match(result.body.message, /not a booking/);
    const saved = await prisma.enquiry.findUniqueOrThrow({ where: { reference: result.body.reference } });
    assert.equal(saved.notifyStatus, 'NOT_CONFIGURED');
    const delivery = await prisma.notificationDelivery.findFirst({ where: { subjectId: saved.id } });
    assert.equal(delivery?.status, 'NOT_CONFIGURED');
  });

  test('with the WhatsApp Business Platform configured, both team numbers get the notice', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '1234';
    const before = whatsappTestOutbox.length;
    const result = await api.request('POST', '/community/enquiries', {
      body: { type: 'TABLE', subjectTitle: 'Test Restaurant', name: 'Juma', phone: '+255 700 000 002', startDate: '2027-02-01', people: 4, message: 'Table for four, please.', details: { time: '19:30' } },
    });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    assert.equal(result.body.notice, 'SENT');
    const sent = whatsappTestOutbox.slice(before);
    assert.deepEqual(sent.map((item) => item.to).sort(), ['255745341440', '255794279089']);
    assert.match(sent[0]!.text, /Restaurant reservation/);
    assert.match(sent[0]!.text, /19:30/);
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  });

  test('a reservation needs a time and a number of guests', async () => {
    const result = await api.request('POST', '/community/enquiries', { body: { type: 'TABLE', name: 'Juma', phone: '+255 700 000 002', startDate: '2027-02-01', message: 'Table please.' } });
    assert.equal(result.status, 422);
  });

  test('the customer follows the status in their account', async () => {
    const member = await api.register('hotelguest');
    const sent = await api.request('POST', '/community/enquiries', { token: member.token, body: hotel });
    const enquiry = await prisma.enquiry.findUniqueOrThrow({ where: { reference: sent.body.reference } });
    const updated = await api.request('PATCH', `/cc/enquiries/${enquiry.id}`, { token: owner, body: { status: 'AWAITING_BUSINESS' } });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    const mine = await api.request('GET', '/community/my-enquiries', { token: member.token });
    assert.equal(mine.body.items[0].status, 'AWAITING_BUSINESS');
    const notices = await prisma.notification.findMany({ where: { userId: member.id, type: 'ENQUIRY_UPDATE' } });
    assert.equal(notices.length, 1);
  });

  test('a business partnership application needs a business name and never publishes anything', async () => {
    const before = await prisma.place.count();
    const missing = await api.request('POST', '/community/enquiries', { body: { type: 'PARTNERSHIP', name: 'Owner', phone: '+255 700 000 003', message: 'We would like to be listed.' } });
    assert.equal(missing.status, 422);
    const ok = await api.request('POST', '/community/enquiries', { body: { type: 'PARTNERSHIP', name: 'Owner', phone: '+255 700 000 003', message: 'We would like to be listed.', details: { businessName: 'Sea Breeze Café', category: 'Restaurants & cafes' } } });
    assert.equal(ok.status, 201);
    assert.equal(await prisma.place.count(), before, 'no listing is created by an application');
  });
});

describe('communities', () => {
  test('a member applies, the team approves, others join', async () => {
    const founder = await api.register('founder');
    const applied = await api.request('POST', '/community/communities/apply', { token: founder.token, body: { name: `Dar Jogging ${Date.now()}`, summary: 'Saturday runners in Dar es Salaam.' } });
    assert.equal(applied.status, 201, JSON.stringify(applied.body));
    assert.equal(applied.body.status, 'PENDING_REVIEW');
    const community = await prisma.community.findUniqueOrThrow({ where: { id: applied.body.id } });
    assert.equal((await api.request('GET', `/public/communities/${community.slug}`)).status, 404, 'hidden until approved');
    const published = await api.request('POST', `/cc/r/communities/${community.id}/status`, { token: owner, body: { status: 'PUBLISHED' } });
    assert.equal(published.status, 200, JSON.stringify(published.body));
    const joiner = await api.register('joiner');
    assert.equal((await api.request('POST', `/community/communities/${community.slug}/join`, { token: joiner.token })).status, 200);
    const page = await api.request('GET', `/public/communities/${community.slug}`, { token: joiner.token });
    assert.equal(page.body.community.memberCount, 1);
    assert.equal(page.body.viewer.isMember, true);
    assert.ok(!JSON.stringify(page.body.members).includes('@'), 'no email addresses are listed');
    const anonymous = await api.request('GET', `/public/communities/${community.slug}`);
    assert.deepEqual(anonymous.body.members, [], 'the member list is for signed-in members');
    const announced = await api.request('POST', `/cc/communities/${community.id}/announcements`, { token: owner, body: { title: 'This Saturday', body: 'We meet at 06:30.' } });
    assert.equal(announced.status, 201);
    assert.equal(await prisma.notification.count({ where: { userId: joiner.id, type: 'COMMUNITY_ANNOUNCEMENT' } }), 1);
  });
});

describe('gaming', () => {
  async function tournament(format: 'SOLO' | 'SQUAD', teamSize: number, slots = 10) {
    const game = await prisma.category.findUniqueOrThrow({ where: { kind_slug: { kind: 'GAME', slug: 'free-fire' } } });
    const created = await api.request('POST', '/cc/r/tournaments', {
      token: owner,
      body: { values: { title: `Free Fire ${format} Cup ${Date.now()}`, gameId: game.id, kind: 'ONLINE', format, teamSize, slots, server: 'Africa', startsAt: '2027-03-01T18:00', timezone: 'Africa/Dar_es_Salaam', status: 'REGISTRATION_OPEN' } },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    return prisma.tournament.findUniqueOrThrow({ where: { id: created.body.id } });
  }

  test('searching “Free Fire” finds Free Fire tournaments only', async () => {
    const cup = await tournament('SOLO', 1);
    const found = await api.request('GET', '/public/tournaments?q=Free%20Fire');
    assert.ok(found.body.items.some((item: { slug: string }) => item.slug === cup.slug));
    assert.ok(found.body.items.every((item: { game: { name: string } }) => item.game.name === 'Free Fire'));
  });

  test('a squad registers, members join with the captain’s code, and the team cannot overfill', async () => {
    const cup = await tournament('SQUAD', 2);
    const captain = await api.register('captain');
    const noRules = await api.request('POST', `/community/tournaments/${cup.slug}/register`, { token: captain.token, body: { playerName: 'Cap', gameUid: '12345678', teamName: 'Lions' } });
    assert.equal(noRules.status, 422, 'the rules must be agreed');
    const entry = await api.request('POST', `/community/tournaments/${cup.slug}/register`, { token: captain.token, body: { playerName: 'Cap', gameUid: '12345678', teamName: 'Lions', agreedRules: true } });
    assert.equal(entry.status, 201, JSON.stringify(entry.body));
    assert.ok(entry.body.inviteCode);
    const mate = await api.register('mate');
    const joined = await api.request('POST', `/community/tournaments/${cup.slug}/join-team`, { token: mate.token, body: { inviteCode: entry.body.inviteCode, playerName: 'Mate', gameUid: '87654321', agreedRules: true } });
    assert.equal(joined.status, 201, JSON.stringify(joined.body));
    const extra = await api.register('extra');
    const full = await api.request('POST', `/community/tournaments/${cup.slug}/join-team`, { token: extra.token, body: { inviteCode: entry.body.inviteCode, playerName: 'Extra', gameUid: '11112222', agreedRules: true } });
    assert.equal(full.status, 409);
    const page = await api.request('GET', `/public/tournaments/${cup.slug}`);
    assert.equal(page.body.lineup[0].name, 'Lions');
    assert.ok(!JSON.stringify(page.body).includes('12345678'), 'game IDs are never public');
    assert.equal(page.body.tournament.free, true);
  });

  test('registration stops when the slots are taken', async () => {
    const cup = await tournament('SOLO', 1, 1);
    const first = await api.register('p1');
    const second = await api.register('p2');
    assert.equal((await api.request('POST', `/community/tournaments/${cup.slug}/register`, { token: first.token, body: { playerName: 'One', gameUid: '1111', agreedRules: true } })).status, 201);
    assert.equal((await api.request('POST', `/community/tournaments/${cup.slug}/register`, { token: second.token, body: { playerName: 'Two', gameUid: '2222', agreedRules: true } })).status, 409);
  });
});

describe('recurring activities and member submissions', () => {
  test('each Saturday session has its own registration list and capacity; changes are announced', async () => {
    const { country, city } = await tanzania();
    const running = await prisma.category.findUniqueOrThrow({ where: { kind_slug: { kind: 'ACTIVITY', slug: 'jogging' } } });
    const activity = await prisma.activity.create({
      data: { slug: `weekly-jog-${Date.now()}`, title: 'Weekly jog', description: 'Every Saturday.', categoryId: running.id, countryId: country.id, cityId: city.id, organiserName: 'Enhakkore', status: 'PUBLISHED', recurrence: 'Every Saturday, 06:30' },
    });
    const added = await api.request('POST', `/cc/activities/${activity.id}/sessions`, { token: owner, body: { startsAt: '2027-01-02T06:30', capacity: 1, repeatWeeks: 3 } });
    assert.equal(added.status, 201, JSON.stringify(added.body));
    assert.equal(added.body.items.length, 3);
    assert.equal(new Date(added.body.items[0].startsAt).toISOString(), '2027-01-02T03:30:00.000Z', '06:30 in Dar es Salaam');
    const sessionId = added.body.items[0].id;
    const a = await api.register('jogA');
    const b = await api.register('jogB');
    assert.equal((await api.request('POST', `/community/sessions/${sessionId}/register`, { token: a.token })).status, 201);
    assert.equal((await api.request('POST', `/community/sessions/${sessionId}/register`, { token: b.token })).status, 409, 'that session is full');
    assert.equal((await api.request('POST', `/community/sessions/${added.body.items[1].id}/register`, { token: b.token })).status, 201, 'the next Saturday has its own list');
    const list = await api.request('GET', `/public/activities/${activity.slug}/sessions`, { token: a.token });
    assert.equal(list.body.upcoming.length, 3);
    assert.equal(list.body.upcoming[0].viewerRegistered, true);
    await api.request('PATCH', `/cc/sessions/${sessionId}`, { token: owner, body: { status: 'CANCELLED', notice: 'Heavy rain — see you next week.' } });
    const notice = await prisma.notification.findFirst({ where: { userId: a.id, type: 'EVENT_CHANGE' } });
    assert.match(notice?.body ?? '', /Heavy rain/);
  });

  test('a member’s submission waits for review, and a paid one needs enhanced review', async () => {
    const { country, city } = await tanzania();
    const category = await prisma.category.findUniqueOrThrow({ where: { kind_slug: { kind: 'ACTIVITY', slug: 'basketball' } } });
    const member = await api.register('host');
    const body = {
      title: 'Sunday pickup basketball',
      description: 'Friendly games for all levels at a public court.',
      categoryId: category.id,
      countryId: country.id,
      cityId: city.id,
      meetingPoint: 'Public court',
      startsAt: '2027-01-03T07:00:00.000Z',
      organiserPhone: '+255 700 000 009',
      acceptedRules: true,
    };
    const small = await api.request('POST', '/community/activities/submit', { token: member.token, body });
    assert.equal(small.status, 201, JSON.stringify(small.body));
    assert.equal(small.body.status, 'PENDING_REVIEW');
    assert.equal(small.body.reviewLevel, 'STANDARD');
    const paid = await api.request('POST', '/community/activities/submit', { token: member.token, body: { ...body, title: 'Paid tournament night', paid: true } });
    assert.equal(paid.body.reviewLevel, 'ENHANCED');
    const created = await prisma.activity.findUniqueOrThrow({ where: { id: small.body.id } });
    assert.equal((await api.request('GET', `/public/activities/${created.slug}`)).status, 404, 'not public until approved');
    assert.equal((await api.request('POST', '/community/activities/submit', { body })).status, 401, 'members only');
  });
});

describe('two-factor sign-in for team accounts', () => {
  test('once on, the password alone is not enough', async () => {
    const email = `twofactor-${Date.now()}@test.local`;
    const role = await prisma.adminRole.findUniqueOrThrow({ where: { name: 'Content Manager' } });
    const invited = await api.request('POST', '/cc/people/staff', { token: owner, body: { email, name: 'Two Factor', roleId: role.id } });
    assert.ok([200, 201].includes(invited.status), JSON.stringify(invited.body));
    const password = invited.body.temporaryPassword as string;
    const token = await api.login(email, password);
    const setup = await api.request('POST', '/auth/2fa/setup', { token });
    assert.equal(setup.status, 200);
    assert.match(setup.body.otpauthUrl, /^otpauth:\/\/totp\//);
    const wrong = await api.request('POST', '/auth/2fa/enable', { token, body: { code: '000000' } });
    assert.equal(wrong.status, 422);
    const enabled = await api.request('POST', '/auth/2fa/enable', { token, body: { code: totpCode(setup.body.secret) } });
    assert.equal(enabled.status, 200);
    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    assert.ok(stored.totpSecret && !stored.totpSecret.includes(setup.body.secret), 'the secret is stored encrypted');
    const noCode = await api.request('POST', '/auth/login', { body: { email, password } });
    assert.equal(noCode.status, 401);
    assert.equal((noCode.body as any).error.code, 'two_factor_required');
    const badCode = await api.request('POST', '/auth/login', { body: { email, password, code: '123456' } });
    assert.equal(badCode.status, 401);
    const ok = await api.request('POST', '/auth/login', { body: { email, password, code: totpCode(setup.body.secret) } });
    assert.equal(ok.status, 200);
  });
});

describe('popularity engine', () => {
  test('a visitor refreshing a page counts once a day; drafts never trend', async () => {
    const place = await prisma.place.create({ data: { slug: `trend-test-${Date.now()}`, name: 'Trend test place', status: 'PUBLISHED', publishedAt: new Date() } });
    const first = await api.request('POST', '/public/track', { body: { subjectType: 'PLACE', subjectId: place.id, kind: 'VIEW' } });
    const second = await api.request('POST', '/public/track', { body: { subjectType: 'PLACE', subjectId: place.id, kind: 'VIEW' } });
    assert.equal(first.body.counted, true);
    assert.equal(second.body.counted, false, 'the refresh is not counted');
    const bogus = await api.request('POST', '/public/track', { body: { subjectType: 'PLACE', subjectId: place.id, kind: 'REGISTER' } });
    assert.equal(bogus.status, 422, 'registrations cannot be faked from the browser');
    const draft = await prisma.activity.findFirstOrThrow({ where: { status: 'DRAFT' } });
    await api.request('POST', '/public/track', { body: { subjectType: 'ACTIVITY', subjectId: draft.id, kind: 'VIEW' } });
    const trending = await api.request('GET', '/public/trending');
    assert.ok(trending.body.items.some((item: { subjectId: string }) => item.subjectId === place.id), 'the viewed, new place trends');
    assert.ok(!trending.body.items.some((item: { subjectId: string }) => item.subjectId === draft.id));
  });
});

describe('trip groups after the trip', () => {
  test('an archived group keeps its history but takes no new messages', async () => {
    const group = await prisma.conversation.findFirstOrThrow({ where: { members: { some: { role: 'TRAVELER' } } }, include: { members: { include: { user: true } } } });
    const traveller = group.members.find((member) => member.role === 'TRAVELER')!;
    const token = await api.login(traveller.user.email);
    assert.equal((await api.request('POST', `/conversations/${group.id}/archive`, { token })).status, 403, 'a traveller cannot archive');
    assert.equal((await api.request('POST', `/conversations/${group.id}/archive`, { token: owner })).status, 200);
    const view = await api.request('GET', `/conversations/${group.id}`, { token });
    assert.equal(view.body.readOnly, true);
    assert.equal(view.body.canPost, false);
    assert.equal((await api.request('POST', `/conversations/${group.id}/messages`, { token, body: { body: 'Hello?' } })).status, 403);
    assert.equal((await api.request('GET', `/conversations/${group.id}/messages`, { token })).status, 200, 'history is still readable');
    await api.request('POST', `/conversations/${group.id}/archive`, { token: owner, body: { archive: false } });
  });

  test('a participant can report a message to the moderators', async () => {
    const group = await prisma.conversation.findFirstOrThrow({ where: { messages: { some: {} }, members: { some: { role: 'TRAVELER' } } }, include: { members: { include: { user: true } }, messages: true } });
    const traveller = group.members.find((member) => member.role === 'TRAVELER')!;
    const token = await api.login(traveller.user.email);
    const reported = await api.request('POST', `/conversations/${group.id}/messages/${group.messages[0]!.id}/report`, { token, body: { reason: 'Spam' } });
    assert.equal(reported.status, 201);
    assert.ok(await prisma.report.findFirst({ where: { targetType: 'MESSAGE', targetId: group.messages[0]!.id } }));
  });
});

describe('round 3: trips visible, demo content, search, locations, bulk', () => {
  test('the Arusha Escape is published and appears in upcoming trips and search', async () => {
    const trips = await api.request('GET', '/public/trips');
    assert.ok(trips.body.items.some((trip: { slug: string }) => trip.slug === 'arusha-escape'), 'Arusha is listed');
    const found = await api.request('GET', '/public/search?q=Arusha');
    assert.ok(found.body.results.some((item: { href: string }) => item.href === '/travel/arusha-escape'));
  });

  test('a trip request is saved with a reference and sent to the routed number', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 't';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '1';
    const before = whatsappTestOutbox.length;
    const settings = await api.request('GET', '/cc/settings', { token: owner });
    const contact = settings.body.settings.contact;
    await api.request('PUT', '/cc/settings/contact', { token: owner, body: { value: { ...contact, routing: { ...contact.routing, TRIP: '2' } }, confirm: true } });
    const sent = await api.request('POST', '/community/enquiries', { body: { type: 'TRIP', subjectType: 'TRIP', subjectTitle: 'Arusha Escape', name: 'Neema', phone: '+255 700 000 010', people: 3, message: 'Three of us for December.', details: { preferredDate: '18 Dec 2026' } } });
    assert.equal(sent.status, 201, JSON.stringify(sent.body));
    assert.match(sent.body.reference, /^ENQ-/);
    const delivered = whatsappTestOutbox.slice(before);
    assert.deepEqual(delivered.map((item) => item.to), ['255794279089'], 'only the second number, as routed');
    assert.match(delivered[0]!.text, /Arusha Escape/);
    await api.request('PUT', '/cc/settings/contact', { token: owner, body: { value: contact, confirm: true } });
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  });

  test('demo listings are labelled and cannot be signed up for', async () => {
    const list = await api.request('GET', '/public/tournaments?q=Free%20Fire');
    const demo = list.body.items.find((item: { isDemo: boolean }) => item.isDemo);
    assert.ok(demo, 'a DEMO Free Fire tournament exists');
    const member = await api.register('demoplayer');
    const tried = await api.request('POST', `/community/tournaments/${demo.slug}/register`, { token: member.token, body: { playerName: 'Xavier', gameUid: '123456', teamName: 'Tigers', agreedRules: true } });
    assert.equal(tried.status, 409);
    const trending = await api.request('GET', '/public/trending');
    assert.ok(!trending.body.items.some((item: { title: string }) => /demo/i.test(item.title)));
  });

  test('search understands “restaurants in Zanzibar” and “hotels in Dar es Salaam”', async () => {
    const restaurants = await api.request('GET', `/public/search?q=${encodeURIComponent('restaurants in Zanzibar')}`);
    assert.equal(restaurants.body.interpreted.city, 'Zanzibar');
    assert.ok(restaurants.body.results.some((item: { title: string }) => item.title === 'The Rock Restaurant'));
    assert.ok(restaurants.body.results.every((item: { type: string }) => item.type === 'place' || item.type === 'city' || item.type === 'country'));
    const hotels = await api.request('GET', `/public/search?q=${encodeURIComponent('hotels in Dar es Salaam')}`);
    const titles = hotels.body.results.map((item: { title: string }) => item.title);
    assert.ok(titles.includes('Dar es Salaam Serena Hotel'));
    assert.ok(!titles.includes('Elewana Arusha Coffee Lodge'), 'Arusha lodges are not in Dar es Salaam');
    const suggest = await api.request('GET', '/public/suggest?q=free');
    assert.ok(suggest.body.items.some((item: { label: string }) => /Free Fire/.test(item.label)));
  });

  test('worldwide cities: search a country, pick one, it becomes a stored city', async () => {
    const found = await api.request('GET', '/public/geo/cities?country=TZ&q=moshi');
    assert.equal(found.status, 200);
    const moshi = found.body.items.find((item: { name: string }) => item.name === 'Moshi');
    assert.ok(moshi, 'Moshi is in the dataset');
    const lagos = await api.request('GET', '/public/geo/cities?country=NG&q=ibad');
    assert.ok(lagos.body.items.some((item: { name: string }) => item.name === 'Ibadan'));
    const member = await api.register('geo');
    const city = await api.request('POST', '/community/geo/city', { token: member.token, body: { country: 'TZ', geonameId: moshi.geonameId } });
    assert.equal(city.status, 200, JSON.stringify(city.body));
    const again = await api.request('POST', '/community/geo/city', { token: member.token, body: { country: 'TZ', geonameId: moshi.geonameId } });
    assert.equal(again.body.id, city.body.id, 'chosen twice, stored once');
  });

  test('bulk: the owner removes every DEMO community at once', async () => {
    const before = await prisma.community.count({ where: { isDemo: true } });
    assert.ok(before > 0);
    const noConfirm = await api.request('POST', '/cc/r/communities/bulk', { token: owner, body: { action: 'delete', allDemo: true } });
    assert.equal(noConfirm.status, 428);
    const archived = await api.request('POST', '/cc/r/communities/bulk', { token: owner, body: { action: 'archive', allDemo: true } });
    assert.equal(archived.body.done, before);
    assert.equal(await prisma.community.count({ where: { isDemo: true, status: { not: 'ARCHIVED' } } }), 0);
  });

  test('new members record which terms they accepted', async () => {
    const refused = await api.request('POST', '/auth/register', { body: { name: 'No Terms', email: `noterms-${Date.now()}@test.local`, password: 'TestPass-123' } });
    assert.equal(refused.status, 422);
    const member = await api.register('terms');
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
    assert.ok(stored.termsVersion && stored.termsAcceptedAt);
  });
});

describe('one-time founder setup', () => {
  test('closed without a token, refuses a wrong token, and closes for good after use', async () => {
    delete process.env.SETUP_TOKEN;
    assert.equal((await api.request('GET', '/auth/setup/status')).body.open, false);
    // The demo database already has an admin; set it aside to simulate a fresh launch.
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isDemo: false } });
    await prisma.user.updateMany({ where: { id: { in: admins.map((a) => a.id) } }, data: { isDemo: true } });
    await prisma.platformSetting.deleteMany({ where: { key: 'setup.completed' } });
    process.env.SETUP_TOKEN = 'a-very-long-setup-token-for-tests-123456';
    assert.equal((await api.request('GET', '/auth/setup/status')).body.open, true);
    const body = { name: 'Founder', email: `founder-${Date.now()}@test.local`, password: 'FounderPass-2026' };
    const wrong = await api.request('POST', '/auth/setup', { body: { ...body, token: 'nope' } });
    assert.equal(wrong.status, 401);
    const weak = await api.request('POST', '/auth/setup', { body: { ...body, password: 'short', token: process.env.SETUP_TOKEN } });
    assert.equal(weak.status, 422);
    const ok = await api.request('POST', '/auth/setup', { body: { ...body, token: process.env.SETUP_TOKEN } });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    assert.equal(ok.body.user.role, 'ADMIN');
    assert.equal((await api.request('GET', '/auth/setup/status')).body.open, false, 'closed after use');
    const again = await api.request('POST', '/auth/setup', { body: { ...body, email: `second-${Date.now()}@test.local`, token: process.env.SETUP_TOKEN } });
    assert.equal(again.status, 403, 'a second setup is refused even with the token');
    const login = await api.request('POST', '/auth/login', { body: { email: body.email, password: body.password } });
    assert.equal(login.status, 200);
    delete process.env.SETUP_TOKEN;
    await prisma.user.updateMany({ where: { id: { in: admins.map((a) => a.id) } }, data: { isDemo: false } });
  });
});
