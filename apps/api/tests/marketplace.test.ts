import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { type Api, prisma, startApi } from './helpers';

/**
 * The public marketplace: what a visitor sees before signing in.
 */
describe('marketplace', () => {
  let api: Api;
  before(async () => {
    api = await startApi();
  });
  after(async () => {
    await api.close();
  });

  test('only published trips are listed', async () => {
    const result = await api.request('GET', '/trips?pageSize=50');
    assert.equal(result.status, 200);
    assert.ok(result.body.total > 0);
    assert.ok(
      result.body.items.every((trip: { status: string }) => trip.status === 'PUBLISHED'),
      'a draft or archived listing must never reach the marketplace',
    );
  });

  test('search ignores capital letters', async () => {
    // The live site runs PostgreSQL, which compares text case-sensitively;
    // local SQLite does not. This caught a real bug where "zanzibar" found
    // nothing on the live site while "Zanzibar" found two trips.
    const [lower, upper, mixed] = await Promise.all([
      api.request('GET', '/trips?q=zanzibar'),
      api.request('GET', '/trips?q=ZANZIBAR'),
      api.request('GET', '/trips?q=Zanzibar'),
    ]);
    assert.ok(mixed.body.total > 0, 'fixture assumption: a Zanzibar trip exists');
    assert.equal(lower.body.total, mixed.body.total);
    assert.equal(upper.body.total, mixed.body.total);
  });

  test('destination search ignores capital letters too', async () => {
    const [lower, upper] = await Promise.all([
      api.request('GET', '/destinations/search?q=zanz'),
      api.request('GET', '/destinations/search?q=ZANZ'),
    ]);
    assert.ok(lower.body.items.length > 0);
    assert.equal(upper.body.items.length, lower.body.items.length);
  });

  test('impact project search ignores capital letters', async () => {
    const [lower, upper] = await Promise.all([
      api.request('GET', '/impact/projects?q=morogoro'),
      api.request('GET', '/impact/projects?q=MOROGORO'),
    ]);
    assert.ok(lower.body.total > 0);
    assert.equal(upper.body.total, lower.body.total);
  });

  test('filters narrow the results rather than silently ignoring unknown values', async () => {
    const safaris = await api.request('GET', '/trips?type=SAFARI&pageSize=50');
    assert.ok(safaris.body.total > 0);
    assert.ok(safaris.body.items.every((trip: { type: string }) => trip.type === 'SAFARI'));

    const cheap = await api.request('GET', '/trips?maxPrice=600000&pageSize=50');
    assert.ok(
      cheap.body.items.every((trip: { fromPrice: { amount: number } }) => trip.fromPrice.amount <= 600_000),
    );
  });

  test('a trip page carries what the booking decision needs', async () => {
    const result = await api.request('GET', '/trips/mikumi-adventure');
    assert.equal(result.status, 200);
    const trip = result.body;
    assert.ok(trip.itinerary.length > 0, 'itinerary');
    assert.ok(trip.includes.length > 0, 'what is included');
    assert.ok(trip.departures.length > 0, 'dates');
    assert.ok(trip.organizerDetail.companyName, 'who runs it');
    assert.equal(typeof trip.fromPrice.amount, 'number');
  });

  test('fellow travellers are shown by first name and country only', async () => {
    const result = await api.request('GET', '/trips/mikumi-adventure');
    assert.ok(result.body.travellers.length > 0, 'fixture assumption: someone has booked');
    for (const traveller of result.body.travellers) {
      assert.deepEqual(
        Object.keys(traveller).sort(),
        ['avatarUrl', 'country', 'id', 'name'],
        'no email, phone or anything else about a fellow traveller',
      );
    }
  });

  test('a missing trip is a clean 404, not a crash', async () => {
    assert.equal((await api.request('GET', '/trips/no-such-trip')).status, 404);
  });

  test('impact projects report goal, raised and progress consistently', async () => {
    const result = await api.request('GET', '/impact/projects?pageSize=50');
    assert.ok(result.body.total > 0);
    for (const project of result.body.items) {
      const expected = Math.round((project.raised.amount / project.goal.amount) * 100);
      assert.equal(project.progress, Math.min(100, Math.max(0, expected)), project.slug);
      assert.ok(project.status !== 'DRAFT', 'drafts stay internal');
    }
  });

  test('the health check states plainly that payments are simulated', async () => {
    const result = await api.request('GET', '/health');
    assert.equal(result.status, 200);
    assert.equal(result.body.payments.live, false);
    assert.equal(result.body.status, 'ok');
  });

  test('platform figures are flagged as demonstration data while the seed is loaded', async () => {
    const result = await api.request('GET', '/stats');
    assert.equal(result.body.isDemoData, true, 'the UI relies on this to label demo numbers');
  });

  test('a contribution only counts when the payment succeeds', async () => {
    const project = await prisma.impactProject.findFirstOrThrow({ where: { status: 'ACTIVE' } });
    const donor = await api.register('donor');

    const declined = await api.request('POST', `/impact/projects/${project.slug}/donate`, {
      token: donor.token,
      body: { amount: 13, currency: 'TZS', paymentMethod: 'MOBILE_MONEY' },
    });
    assert.equal(declined.status, 402, 'the mock gateway declines totals ending in 13');
    let current = await prisma.impactProject.findUniqueOrThrow({ where: { id: project.id } });
    assert.equal(current.raised, project.raised, 'a failed payment raises nothing');

    const accepted = await api.request('POST', `/impact/projects/${project.slug}/donate`, {
      token: donor.token,
      body: { amount: 5_000, currency: 'TZS', paymentMethod: 'MOBILE_MONEY' },
    });
    assert.equal(accepted.status, 201);
    current = await prisma.impactProject.findUniqueOrThrow({ where: { id: project.id } });
    assert.equal(current.raised, project.raised + 5_000);
  });

  test('an anonymous contribution does not reveal the donor', async () => {
    const project = await prisma.impactProject.findFirstOrThrow({ where: { status: 'ACTIVE' } });
    const donor = await api.register('shy');
    await api.request('POST', `/impact/projects/${project.slug}/donate`, {
      token: donor.token,
      body: { amount: 7_000, currency: 'TZS', anonymous: true, paymentMethod: 'MOBILE_MONEY' },
    });

    const page = await api.request('GET', `/impact/projects/${project.slug}`);
    const names = page.body.recentContributions.map((c: { donorName: string | null }) => c.donorName);
    assert.ok(!names.some((name: string | null) => name?.includes('shy')), 'the name must not appear');
  });
});
