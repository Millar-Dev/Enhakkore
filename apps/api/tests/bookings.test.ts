import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { type Api, openDeparture, prisma, startApi } from './helpers';

/**
 * Bookings: the part of the platform where a bug costs someone money or a
 * seat. Each test books as a freshly registered traveller so tests cannot
 * affect one another through shared accounts.
 */
describe('bookings', () => {
  let api: Api;
  before(async () => {
    api = await startApi();
  });
  after(async () => {
    await api.close();
  });

  async function book(token: string, tripDateId: string, extra: Record<string, unknown> = {}) {
    return api.request('POST', '/bookings', {
      token,
      body: {
        tripDateId,
        travellers: 1,
        travellerDetails: [{ fullName: 'Test Traveller' }],
        paymentMethod: 'MOBILE_MONEY',
        ...extra,
      },
    });
  }

  test('a successful booking confirms, takes the seat, charges the right amounts and opens the group', async () => {
    const departure = await openDeparture('mikumi-adventure');
    const project = await prisma.impactProject.findUniqueOrThrow({ where: { slug: 'classroom-block-morogoro' } });
    const traveller = await api.register('booker');

    const result = await book(traveller.token, departure.id, {
      impactAmount: 10_000,
      impactProjectId: project.id,
    });

    assert.equal(result.status, 201, JSON.stringify(result.body));
    const booking = result.body.booking;
    const unit = departure.price ?? departure.trip.basePrice;
    assert.equal(booking.status, 'CONFIRMED');
    assert.equal(booking.tripAmount.amount, unit);
    assert.equal(booking.impactAmount.amount, 10_000);
    assert.equal(booking.totalAmount.amount, unit + 10_000);
    // Commission is 10% of the trip only — never of the contribution.
    assert.equal(booking.platformFee.amount, Math.round(unit * 0.1));
    assert.equal(result.body.payment.simulated, true, 'the mock gateway must never claim a real charge');

    const after = await prisma.tripDate.findUniqueOrThrow({ where: { id: departure.id } });
    assert.equal(after.seatsBooked, departure.seatsBooked + 1);

    const projectAfter = await prisma.impactProject.findUniqueOrThrow({ where: { id: project.id } });
    assert.equal(projectAfter.raised, project.raised + 10_000);
    assert.equal(projectAfter.contributorCount, project.contributorCount + 1);

    assert.ok(booking.conversationId, 'a confirmed booking opens the trip group');
    const group = await api.request('GET', `/conversations/${booking.conversationId}`, { token: traveller.token });
    assert.equal(group.status, 200);
  });

  test('two people racing for the last seat: exactly one gets it, the departure is never oversold', async () => {
    const departure = await openDeparture('zanzibar-escape');
    await prisma.tripDate.update({
      where: { id: departure.id },
      data: { seatsBooked: departure.capacity - 1, status: 'ALMOST_FULL' },
    });
    const [first, second] = await Promise.all([api.register('racer-a'), api.register('racer-b')]);

    const results = await Promise.all([book(first.token, departure.id), book(second.token, departure.id)]);
    const statuses = results.map((r) => r.status).sort();

    assert.deepEqual(statuses, [201, 409], `got ${statuses.join(', ')}`);
    const loser = results.find((r) => r.status === 409)!;
    assert.equal(loser.body.error.code, 'not_enough_seats');

    const after = await prisma.tripDate.findUniqueOrThrow({ where: { id: departure.id } });
    assert.equal(after.seatsBooked, departure.capacity, 'exactly full — never over capacity');
  });

  test('asking for more seats than remain is refused with a clear reason', async () => {
    const departure = await openDeparture('ruaha-wild-circuit', 2);
    await prisma.tripDate.update({ where: { id: departure.id }, data: { seatsBooked: departure.capacity - 2 } });
    const traveller = await api.register('greedy');

    const result = await book(traveller.token, departure.id, {
      travellers: 3,
      travellerDetails: [{ fullName: 'A One' }, { fullName: 'B Two' }, { fullName: 'C Three' }],
    });

    assert.equal(result.status, 409);
    assert.match(result.body.error.message, /Only 2 seats are left/);
  });

  test('a failed payment releases the seat and records no contribution', async () => {
    const departure = await openDeparture('stone-town-culture-weekend');
    const project = await prisma.impactProject.findUniqueOrThrow({ where: { slug: 'village-borehole-chalinze' } });
    const traveller = await api.register('declined');

    // The mock gateway declines any total ending in 13. Trip prices are whole
    // thousands, so a 13 TZS contribution makes the total end in 13.
    const result = await book(traveller.token, departure.id, { impactAmount: 13, impactProjectId: project.id });

    assert.equal(result.status, 402);
    assert.equal(result.body.payment.status, 'FAILED');
    assert.equal(result.body.booking.status, 'CANCELLED');

    const after = await prisma.tripDate.findUniqueOrThrow({ where: { id: departure.id } });
    assert.equal(after.seatsBooked, departure.seatsBooked, 'the seat is released');
    const projectAfter = await prisma.impactProject.findUniqueOrThrow({ where: { id: project.id } });
    assert.equal(projectAfter.raised, project.raised, 'no money was taken, so none is counted');
  });

  test('cancelling refunds, gives the seat back and removes the traveller from the group', async () => {
    const departure = await openDeparture('mikumi-adventure');
    const traveller = await api.register('canceller');
    const booked = await book(traveller.token, departure.id);
    assert.equal(booked.status, 201);
    const { reference, conversationId } = booked.body.booking;

    const cancelled = await api.request('POST', `/bookings/${reference}/cancel`, {
      token: traveller.token,
      body: { reason: 'Test cancellation' },
    });

    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.booking.status, 'REFUNDED');
    assert.equal(cancelled.body.refunded, true);
    const after = await prisma.tripDate.findUniqueOrThrow({ where: { id: departure.id } });
    assert.equal(after.seatsBooked, departure.seatsBooked);

    const group = await api.request('GET', `/conversations/${conversationId}`, { token: traveller.token });
    assert.equal(group.status, 404, 'access to the private group ends with the booking');
  });

  test('a departure that has already left cannot be booked', async () => {
    const departed = await prisma.tripDate.findFirstOrThrow({ where: { status: 'DEPARTED' } });
    const traveller = await api.register('late');
    const result = await book(traveller.token, departed.id);
    assert.equal(result.status, 422);
  });

  test('you must be signed in to book', async () => {
    const departure = await openDeparture('mikumi-adventure');
    const result = await api.request('POST', '/bookings', {
      body: { tripDateId: departure.id, travellers: 1, travellerDetails: [{ fullName: 'Nobody' }] },
    });
    assert.equal(result.status, 401);
  });
});
