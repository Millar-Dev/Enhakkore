import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { ACCOUNTS, type Api, startApi } from './helpers';

/**
 * Trip enquiries — the private-trip form, and the Arusha package form, which
 * both arrive here.
 *
 * The rule being pinned down is that one way of replying is enough. Plenty of
 * people will leave a phone number and never an email address, and an enquiry
 * form that insists on an address it does not need is an enquiry that never
 * gets sent. What it must never accept is an enquiry nobody can answer.
 */
describe('enquiries', () => {
  let api: Api;
  before(async () => {
    api = await startApi();
  });
  after(async () => {
    await api.close();
  });

  const base = {
    destination: 'Arusha Escape — Arusha, Tanzania',
    travellers: 2,
    contactName: 'Test Traveller',
  };

  test('an email address alone is enough', async () => {
    const result = await api.request('POST', '/requests', {
      body: { ...base, contactEmail: 'email-only@test.local' },
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.contactEmail, 'email-only@test.local');
    assert.equal(result.body.contactPhone, null);
  });

  test('a phone number alone is enough', async () => {
    const result = await api.request('POST', '/requests', {
      body: { ...base, contactPhone: '+255700000001' },
    });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    assert.equal(result.body.contactPhone, '+255700000001');
    assert.equal(result.body.contactEmail, null, 'no address was given, and none is invented');
  });

  test('an enquiry nobody could answer is refused', async () => {
    const result = await api.request('POST', '/requests', { body: base });
    assert.equal(result.status, 422);
    assert.match(JSON.stringify(result.body), /email address or a phone number/i);
  });

  test('a malformed email is still refused', async () => {
    const result = await api.request('POST', '/requests', {
      body: { ...base, contactEmail: 'not-an-address' },
    });
    assert.equal(result.status, 422);
  });

  test('the package details travel with the enquiry', async () => {
    const result = await api.request('POST', '/requests', {
      body: {
        ...base,
        contactEmail: 'package@test.local',
        startDate: '2026-12-18',
        endDate: '2026-12-20',
        budget: 540_000,
        currency: 'TZS',
        notes: 'Traveller category: Tanzanian resident',
      },
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.budget.amount, 540_000);
    assert.equal(result.body.budget.currency, 'TZS');
    assert.match(result.body.notes, /Tanzanian resident/, 'which price they were shown must survive');
  });

  test('it reaches the admin queue, and only an admin can read it', async () => {
    await api.request('POST', '/requests', {
      body: { ...base, contactEmail: 'queued@test.local' },
    });

    const traveller = await api.login(ACCOUNTS.michael);
    assert.equal((await api.request('GET', '/admin/requests', { token: traveller })).status, 403);

    const admin = await api.login(ACCOUNTS.admin);
    const queue = await api.request('GET', '/admin/requests', { token: admin });
    assert.equal(queue.status, 200);
    assert.ok(
      queue.body.items.some((item: { contactEmail: string | null }) => item.contactEmail === 'queued@test.local'),
      'the enquiry is waiting for someone to answer it',
    );
  });
});
