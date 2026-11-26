import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { ACCOUNTS, prisma, startApi, type Api } from './helpers';

/**
 * The control centre and the public platform around it: who may do what,
 * listings in more than one country, trip applications through to profit,
 * events and tickets, donations kept apart from income, settings history and
 * sessions that can be revoked.
 */

let api: Api;
let owner: string;

before(async () => {
  api = await startApi();
  owner = await api.login(ACCOUNTS.admin);
});
after(async () => {
  await api.close();
});

async function category(kind: string, slug: string) {
  return prisma.category.findUniqueOrThrow({ where: { kind_slug: { kind, slug } } });
}

describe('who may use the control centre', () => {
  test('an anonymous visitor gets 401, a member 403', async () => {
    assert.equal((await api.request('GET', '/cc/overview')).status, 401);
    const member = await api.register('member');
    assert.equal((await api.request('GET', '/cc/overview', { token: member.token })).status, 403);
    assert.equal((await api.request('GET', '/cc/r/activities', { token: member.token })).status, 403);
  });

  test('a staff member only reaches what their role allows, checked on the server', async () => {
    const role = await prisma.adminRole.findUniqueOrThrow({ where: { name: 'Finance Manager' } });
    const created = await api.request('POST', '/cc/people/staff', {
      token: owner,
      body: { email: `finance-${Date.now()}@test.local`, name: 'Finance Person', roleId: role.id },
    });
    assert.equal(created.status, 201);
    assert.ok(created.body.temporaryPassword, 'a new account gets a one-time password');
    const token = await api.login(created.body.email, created.body.temporaryPassword);

    assert.equal((await api.request('GET', '/cc/finance/transactions', { token })).status, 200);
    assert.equal((await api.request('GET', '/cc/r/activities', { token })).status, 403, 'finance cannot manage activities');
    assert.equal((await api.request('PUT', '/cc/settings/contact', { token, body: { value: {}, confirm: true } })).status, 403);
    assert.equal((await api.request('POST', '/cc/people/roles', { token, body: { name: 'Sneaky', permissions: ['*'] } })).status, 403, 'only the owner shapes roles');
  });
});

describe('activities in more than one country', () => {
  test('basketball is a main activity category', async () => {
    const basketball = await category('ACTIVITY', 'basketball');
    assert.equal(basketball.featured, true);
    assert.equal(basketball.group, 'Sports');
  });

  test('the owner adds an activity in Dar es Salaam and another in Lagos, Nigeria', async () => {
    const tz = await prisma.country.findUniqueOrThrow({ where: { code: 'TZ' } });
    const ng = await prisma.country.findUniqueOrThrow({ where: { code: 'NG' } });
    const dar = await prisma.city.findFirstOrThrow({ where: { countryId: tz.id, slug: 'dar-es-salaam' } });
    const basketball = await category('ACTIVITY', 'basketball');

    // A new city, added from inside the form.
    const lagos = await api.request('POST', '/cc/lookup/cities', { token: owner, body: { countryId: ng.id, name: 'Lagos' } });
    assert.equal(lagos.status, 201);

    const darGame = await api.request('POST', '/cc/r/activities', {
      token: owner,
      body: {
        values: {
          title: 'Saturday pickup basketball',
          categoryId: basketball.id,
          description: 'Friendly 3v3 and 5v5 games, all levels.',
          organiserName: 'Enhakkore',
          organiserPhone: '+255700000000',
          countryId: tz.id,
          cityId: dar.id,
          meetingPoint: 'Public court',
          startsAt: '2027-01-09T07:30',
          capacity: 2,
          status: 'PUBLISHED',
        },
      },
    });
    assert.equal(darGame.status, 201, JSON.stringify(darGame.body));

    const lagosRun = await api.request('POST', '/cc/r/activities', {
      token: owner,
      body: {
        values: {
          title: 'Lagos morning run',
          categoryId: (await category('ACTIVITY', 'running')).id,
          description: 'An easy 5k.',
          organiserName: 'Enhakkore',
          countryId: ng.id,
          cityId: lagos.body.id,
          startsAt: '2027-01-10T06:30',
          status: 'PUBLISHED',
        },
      },
    });
    assert.equal(lagosRun.status, 201, JSON.stringify(lagosRun.body));

    // Times are entered in local time and stored as the right instant.
    const stored = await prisma.activity.findUniqueOrThrow({ where: { id: darGame.body.id } });
    assert.equal(stored.timezone, 'Africa/Dar_es_Salaam');
    assert.equal(stored.startsAt!.toISOString(), '2027-01-09T04:30:00.000Z');
    const lagosStored = await prisma.activity.findUniqueOrThrow({ where: { id: lagosRun.body.id } });
    assert.equal(lagosStored.timezone, 'Africa/Lagos');
    assert.equal(lagosStored.startsAt!.toISOString(), '2027-01-10T05:30:00.000Z');

    const inNigeria = await api.request('GET', '/public/activities?country=NG');
    assert.deepEqual(inNigeria.body.items.map((item: { title: string }) => item.title), ['Lagos morning run']);
    const basketballOnly = await api.request('GET', '/public/activities?category=basketball&city=dar-es-salaam');
    assert.equal(basketballOnly.body.items.length, 1);
    assert.equal(basketballOnly.body.items[0].organiserPhone, undefined, 'private fields never reach the public');

    const catalogue = await api.request('GET', '/public/catalogue');
    assert.ok(catalogue.body.countries.some((country: { code: string }) => country.code === 'NG'), 'Nigeria now has something to show');
  });

  test('a community submission stays hidden until it is published', async () => {
    const tz = await prisma.country.findUniqueOrThrow({ where: { code: 'TZ' } });
    const created = await api.request('POST', '/cc/r/activities', {
      token: owner,
      body: {
        values: {
          title: 'PUBLIC court FC night',
          categoryId: (await category('ACTIVITY', 'ea-sports-fc')).id,
          description: 'Bring a controller.',
          organiserName: 'A community member',
          source: 'COMMUNITY',
          countryId: tz.id,
          status: 'PENDING_REVIEW',
        },
      },
    });
    assert.equal(created.status, 201);
    const slug = created.body.row.slug;
    assert.equal((await api.request('GET', `/public/activities/${slug}`)).status, 404);

    const published = await api.request('POST', `/cc/r/activities/${created.body.id}/status`, { token: owner, body: { status: 'PUBLISHED' } });
    assert.equal(published.status, 200);
    assert.equal((await api.request('GET', `/public/activities/${slug}`)).status, 200);
  });

  test('joining is limited to the spaces available', async () => {
    const activity = await prisma.activity.findFirstOrThrow({ where: { title: 'Saturday pickup basketball' } });
    const people = await Promise.all([api.register('hoop1'), api.register('hoop2'), api.register('hoop3')]);
    for (const person of people) {
      assert.equal((await api.request('POST', `/community/activities/${activity.slug}/join`, { token: person.token, body: {} })).status, 201);
    }
    const requests = await api.request('GET', `/cc/activities/${activity.id}/participants`, { token: owner });
    assert.equal(requests.body.length, 3);
    assert.equal((await api.request('POST', `/cc/participants/${requests.body[0].id}`, { token: owner, body: { status: 'APPROVED' } })).status, 200);
    assert.equal((await api.request('POST', `/cc/participants/${requests.body[1].id}`, { token: owner, body: { status: 'APPROVED' } })).status, 200);
    const third = await api.request('POST', `/cc/participants/${requests.body[2].id}`, { token: owner, body: { status: 'APPROVED' } });
    assert.equal(third.status, 409, 'the third approval would overfill a two-space activity');
    const after = await prisma.activity.findUniqueOrThrow({ where: { id: activity.id } });
    assert.equal(after.spotsTaken, 2);
    assert.equal(after.status, 'FULL');
  });
});

describe('Enhakkore trips: price, applications, payment and profit', () => {
  test('Arusha Escape and Napuru Gateway were moved into the database as they were published', async () => {
    const upcoming = await api.request('GET', '/public/trips');
    const arusha = upcoming.body.items.find((trip: { slug: string }) => trip.slug === 'arusha-escape');
    assert.ok(arusha, 'Arusha Escape is upcoming');
    assert.equal(arusha.basePrice, 270_000);
    assert.equal(arusha.currency, 'TZS');
    assert.deepEqual(arusha.priceTiers.map((tier: { currency: string }) => tier.currency), ['TZS', 'USD']);
    const past = await api.request('GET', '/public/trips?when=past');
    assert.ok(past.body.items.some((trip: { slug: string }) => trip.slug === 'napuru-gateway'), 'Napuru Gateway is a past trip');
    assert.ok(!upcoming.body.items.some((trip: { slug: string }) => trip.slug === 'napuru-gateway'), 'and not bookable');
  });

  test('the owner changes a price without touching code', async () => {
    const trip = await prisma.trip.findUniqueOrThrow({ where: { slug: 'arusha-escape' } });
    const updated = await api.request('PATCH', `/cc/r/trips/${trip.id}`, { token: owner, body: { values: { basePrice: 275000 } } });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    const page = await api.request('GET', '/public/trips/arusha-escape');
    assert.equal(page.body.basePrice, 275_000);
    // Put it back for the rest of the suite.
    await api.request('PATCH', `/cc/r/trips/${trip.id}`, { token: owner, body: { values: { basePrice: 270000 } } });
    const log = await prisma.auditLog.findFirst({ where: { entityType: 'trips', entityId: trip.id, action: 'update' } });
    assert.ok(log, 'the change is in the audit trail');
  });

  test('apply → approve → record payment → confirmed, with the income in the books', async () => {
    const page = await api.request('GET', '/public/trips/arusha-escape');
    const departure = page.body.departures.find((item: { bookable: boolean }) => item.bookable);
    assert.ok(departure, 'there is an open departure');
    const traveller = await api.register('arusha');

    const anonymous = await api.request('POST', '/community/trips/apply', { body: {} });
    assert.equal(anonymous.status, 401);

    const applied = await api.request('POST', '/community/trips/apply', {
      token: traveller.token,
      body: { departureId: departure.id, travellers: [{ fullName: 'Asha Traveller' }, { fullName: 'Baraka Traveller' }], contactPhone: '+255 700 111 222' },
    });
    assert.equal(applied.status, 201, JSON.stringify(applied.body));
    const twice = await api.request('POST', '/community/trips/apply', {
      token: traveller.token,
      body: { departureId: departure.id, travellers: [{ fullName: 'Asha Traveller' }], contactPhone: '+255 700 111 222' },
    });
    assert.equal(twice.status, 409, 'one live application per person per date');

    const seats = await prisma.tripDate.findUniqueOrThrow({ where: { id: departure.id } });
    assert.equal(seats.seatsBooked, 2, 'places are held while the application is reviewed');

    const booking = await prisma.booking.findUniqueOrThrow({ where: { reference: applied.body.reference } });
    assert.equal(booking.totalAmount, 540_000);
    assert.equal((await api.request('POST', `/cc/applications/${booking.id}/decision`, { token: owner, body: { action: 'approve' } })).body.status, 'PENDING_PAYMENT');

    const half = await api.request('POST', `/cc/applications/${booking.id}/payments`, { token: owner, body: { amount: 270000, method: 'MOBILE_MONEY', reference: 'MP-1' } });
    assert.equal(half.status, 200);
    assert.equal(half.body.status, 'PENDING_PAYMENT', 'part-paid is not confirmed');
    const rest = await api.request('POST', `/cc/applications/${booking.id}/payments`, { token: owner, body: { amount: 270000, method: 'MOBILE_MONEY', reference: 'MP-2' } });
    assert.equal(rest.body.status, 'CONFIRMED', 'paid in full confirms the booking');

    const group = await api.request('GET', `/community/applications/${booking.reference}`, { token: traveller.token });
    assert.ok(group.body.groupId, 'the private group for this departure is now open to the traveller');

    const income = await prisma.financeTransaction.findMany({ where: { bookingId: booking.id } });
    assert.equal(income.length, 2);
    assert.ok(income.every((line) => line.type === 'INCOME' && line.status === 'VERIFIED' && line.division === 'TRAVEL'));

    // A cost for the same departure, and the profit that follows from it.
    const cost = await api.request('POST', '/cc/finance/transactions', {
      token: owner,
      body: { type: 'EXPENSE', date: '2026-12-01', amount: 200000, currency: 'TZS', division: 'TRAVEL', category: 'TRANSPORT', relatedType: 'TRIP_DEPARTURE', relatedId: departure.id, status: 'VERIFIED' },
    });
    assert.equal(cost.status, 201, JSON.stringify(cost.body));
    const summary = await api.request('GET', `/cc/departures/${departure.id}`, { token: owner });
    assert.equal(summary.body.finance.actualProfit.TZS, 540_000 - 200_000);
    assert.equal(summary.body.summary.confirmedParticipants, 2);
  });

  test('a capacity below the seats already taken is refused', async () => {
    const trip = await prisma.trip.findUniqueOrThrow({ where: { slug: 'arusha-escape' } });
    const form = await api.request('GET', `/cc/r/trips/${trip.id}`, { token: owner });
    const departures = form.body.values.departures.map((row: { capacity: number }) => ({ ...row, capacity: 1 }));
    const result = await api.request('PATCH', `/cc/r/trips/${trip.id}`, { token: owner, body: { values: { departures } } });
    assert.equal(result.status, 422);
  });
});

describe('events and tickets', () => {
  test('registration holds tickets, stops at the limit, and payments reach the books', async () => {
    const tz = await prisma.country.findUniqueOrThrow({ where: { code: 'TZ' } });
    const created = await api.request('POST', '/cc/r/events', {
      token: owner,
      body: {
        values: {
          title: 'Silent party on the beach',
          categoryId: (await category('EVENT', 'silent-parties')).id,
          description: 'Three channels, one beach.',
          countryId: tz.id,
          startsAt: '2027-02-06T19:00',
          status: 'PUBLISHED',
          tickets: [{ name: 'Regular', currency: 'TZS', price: 20000, capacity: 3, active: true }],
        },
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const event = await api.request('GET', `/public/events/${created.body.row.slug}`);
    const ticket = event.body.tickets[0];
    assert.equal(ticket.remaining, 3);

    const first = await api.request('POST', `/community/events/${created.body.row.slug}/register`, { body: { ticketId: ticket.id, quantity: 2, name: 'Neema', phone: '+255 700 000 001' } });
    assert.equal(first.status, 201);
    assert.equal(first.body.amountDue, 40_000);
    const tooMany = await api.request('POST', `/community/events/${created.body.row.slug}/register`, { body: { ticketId: ticket.id, quantity: 2, name: 'Juma', phone: '+255 700 000 002' } });
    assert.equal(tooMany.status, 409, 'only one ticket is left');

    const registration = await prisma.eventRegistration.findUniqueOrThrow({ where: { reference: first.body.reference } });
    const paid = await api.request('POST', `/cc/registrations/${registration.id}/payments`, { token: owner, body: { amount: 40000, method: 'MOBILE_MONEY' } });
    assert.equal(paid.body.status, 'CONFIRMED');
    const checkIn = await api.request('POST', '/cc/registrations/check-in', { token: owner, body: { reference: first.body.reference, count: 2 } });
    assert.equal(checkIn.status, 200);
    const again = await api.request('POST', '/cc/registrations/check-in', { token: owner, body: { reference: first.body.reference, count: 1 } });
    assert.equal(again.status, 422, 'cannot let in more people than tickets');

    const summary = await api.request('GET', `/cc/events/${created.body.id}/summary`, { token: owner });
    assert.equal(summary.body.finance.income.TZS, 40_000);
  });

  test('a bot filling the hidden field is refused', async () => {
    const result = await api.request('POST', '/community/enquiries', { body: { name: 'Bot', phone: '+255700000000', message: 'Buy now buy now', website: 'http://spam' } });
    assert.equal(result.status, 400);
  });
});

describe('donations are not income', () => {
  test('the donation account is exactly as supplied', async () => {
    const site = await api.request('GET', '/public/site');
    const account = site.body.paymentMethods.find((method: { scopes: string[] }) => method.scopes.includes('DONATIONS'));
    assert.equal(account.accountName, 'Selcom');
    assert.equal(account.accountNumber, '0745341440');
    assert.equal(account.provider, null, 'no bank name was supplied, so none is shown');
  });

  test('a verified donation never appears in the finance reports', async () => {
    const before = await api.request('GET', '/cc/finance/reports?year=2026', { token: owner });
    const donation = await api.request('POST', '/cc/finance/donations', {
      token: owner,
      body: { amount: 100000, currency: 'TZS', donorName: 'A donor', method: 'BANK_TRANSFER', status: 'SUCCEEDED', receivedAt: '2026-11-20' },
    });
    assert.equal(donation.status, 201);
    const afterReport = await api.request('GET', '/cc/finance/reports?year=2026', { token: owner });
    assert.deepEqual(afterReport.body.totals.income, before.body.totals.income);
    const donations = await api.request('GET', '/cc/finance/donations', { token: owner });
    assert.ok(donations.body.items.some((row: { donorName: string }) => row.donorName === 'A donor'));
  });
});

describe('settings, history and sessions', () => {
  test('contact details need confirming, are logged, and can be restored', async () => {
    const current = (await api.request('GET', '/cc/settings', { token: owner })).body.settings.contact;
    const changed = { ...current, hours: 'Mon–Sat, 9:00–18:00' };
    assert.equal((await api.request('PUT', '/cc/settings/contact', { token: owner, body: { value: changed } })).status, 428);
    assert.equal((await api.request('PUT', '/cc/settings/contact', { token: owner, body: { value: changed, confirm: true } })).status, 200);
    const site = await api.request('GET', '/public/site');
    assert.equal(site.body.settings.contact.hours, 'Mon–Sat, 9:00–18:00');

    const history = await api.request('GET', '/cc/settings/contact/history', { token: owner });
    const restored = await api.request('POST', `/cc/settings/contact/restore/${history.body[0].id}`, { token: owner, body: { confirm: true } });
    assert.equal(restored.status, 200);
    assert.equal(restored.body.value.hours, current.hours);
  });

  test('a revoked session stops working at once', async () => {
    const person = await api.register('session');
    assert.equal((await api.request('GET', '/auth/session', { token: person.token })).status, 200);
    const sessions = await api.request('GET', '/cc/people/security/sessions?scope=all', { token: owner });
    const theirs = sessions.body.find((session: { user: { id: string } }) => session.user.id === person.id);
    assert.ok(theirs);
    assert.equal((await api.request('POST', `/cc/people/security/sessions/${theirs.id}/revoke`, { token: owner })).status, 200);
    assert.equal((await api.request('GET', '/auth/session', { token: person.token })).status, 401);
  });

  test('a partner role sees only the listings assigned to it', async () => {
    const role = await prisma.adminRole.findUniqueOrThrow({ where: { name: 'Property Manager' } });
    const staff = await api.request('POST', '/cc/people/staff', { token: owner, body: { email: `hotel-${Date.now()}@test.local`, name: 'Hotel Manager', roleId: role.id } });
    const token = await api.login(staff.body.email, staff.body.temporaryPassword);
    const tz = await prisma.country.findUniqueOrThrow({ where: { code: 'TZ' } });
    const hotels = await category('PLACE', 'hotels');
    const mine = await prisma.place.create({ data: { slug: `mine-${Date.now()}`, name: 'Their hotel', categoryId: hotels.id, countryId: tz.id, managerId: staff.body.id } });
    const other = await prisma.place.create({ data: { slug: `other-${Date.now()}`, name: 'Someone else’s hotel', categoryId: hotels.id, countryId: tz.id } });

    const list = await api.request('GET', '/cc/r/places', { token });
    assert.deepEqual(list.body.items.map((item: { id: string }) => item.id), [mine.id]);
    assert.equal((await api.request('PATCH', `/cc/r/places/${other.id}`, { token, body: { values: { name: 'Hijacked' } } })).status, 404);
    const edit = await api.request('PATCH', `/cc/r/places/${mine.id}`, { token, body: { values: { summary: 'Sea views.', sponsored: true, infoSource: 'VERIFIED' } } });
    assert.equal(edit.status, 200);
    const stored = await prisma.place.findUniqueOrThrow({ where: { id: mine.id } });
    assert.equal(stored.sponsored, false, 'a partner cannot sponsor its own listing');
    assert.equal(stored.infoSource, 'BUSINESS_SUBMITTED', 'nor vouch for its own details');
  });
});

describe('Connect', () => {
  test('members find each other, connect, and a block hides them completely', async () => {
    const a = await api.register('conna');
    const b = await api.register('connb');
    await prisma.user.update({ where: { id: b.id }, data: { city: 'Dar es Salaam', interests: JSON.stringify(['Basketball']) } });
    const found = await api.request('GET', '/community/members?interest=Basketball&city=Dar', { token: a.token });
    const card = found.body.find((member: { id: string }) => member.id === b.id);
    assert.ok(card, 'found by interest and city');
    assert.equal(card.email, undefined, 'no email on a member card');
    assert.equal(card.phone, undefined, 'no phone on a member card');

    const request = await api.request('POST', '/community/connections', { token: a.token, body: { userId: b.id } });
    assert.equal(request.body.status, 'PENDING');
    const incoming = await api.request('GET', '/community/connections', { token: b.token });
    assert.equal(incoming.body.incoming.length, 1);
    await api.request('POST', `/community/connections/${request.body.id}/respond`, { token: b.token, body: { accept: true } });
    assert.equal((await api.request('GET', '/community/connections', { token: a.token })).body.connected.length, 1);

    await api.request('POST', '/community/blocks', { token: b.token, body: { userId: a.id } });
    assert.equal((await api.request('GET', `/community/members/${b.id}`, { token: a.token })).status, 404);
    assert.equal((await api.request('GET', '/community/connections', { token: a.token })).body.connected.length, 0);
  });

  test('member search needs a signed-in account', async () => {
    assert.equal((await api.request('GET', '/community/members')).status, 401);
  });
});

describe('launch scope', () => {
  test('operator sign-ups are closed until the marketplace phase', async () => {
    const result = await api.request('POST', '/auth/register', {
      body: { name: 'Op', email: `op-${Date.now()}@test.local`, password: 'TestPass-123', accountType: 'ORGANIZER', companyName: 'Op Co' },
    });
    assert.equal(result.status, 403);
  });

  test('a private trip request lands in the enquiries inbox', async () => {
    const sent = await api.request('POST', '/community/enquiries', {
      body: { type: 'PRIVATE_TRIP', name: 'Planner', phone: '+255700000001', message: 'Family safari in July', subjectTitle: 'Serengeti', details: { Destination: 'Serengeti' } },
    });
    assert.equal(sent.status, 201);
    const inbox = await api.request('GET', '/cc/enquiries?type=PRIVATE_TRIP', { token: owner });
    assert.ok(inbox.body.items.some((item: { reference: string }) => item.reference === sent.body.reference));
  });
});
