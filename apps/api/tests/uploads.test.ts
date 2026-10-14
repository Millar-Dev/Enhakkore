import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { ACCOUNTS, type Api, prisma, startApi } from './helpers';

/**
 * Uploads.
 *
 * Two things are being pinned down. First, that nothing the browser says is
 * believed: it cannot choose where a file lands, and it cannot claim a file it
 * did not upload. Second, that a verification document — someone's business
 * papers — is reachable only by its owner and by an admin.
 */
describe('uploads', () => {
  let api: Api;
  before(async () => {
    api = await startApi();
  });
  after(async () => {
    await api.close();
  });

  /** Uploads a file the way the website does, returning what it would store. */
  async function upload(token: string, kind: string, contentType = 'image/jpeg', body = 'pretend-image') {
    const ticket = await api.request('POST', '/uploads/ticket', {
      token,
      body: { kind, contentType, bytes: body.length },
    });
    assert.equal(ticket.status, 200, JSON.stringify(ticket.body));

    const form = new FormData();
    for (const [name, value] of Object.entries(ticket.body.fields as Record<string, string>)) {
      form.append(name, value);
    }
    form.append('file', new Blob([body], { type: contentType }), 'papers.jpg');

    const sent = await fetch(ticket.body.uploadUrl, { method: 'POST', body: form });
    const stored = (await sent.json()) as Record<string, string>;
    assert.equal(sent.status, 201, JSON.stringify(stored));
    return { ticket: ticket.body, stored };
  }

  test('an upload slot needs a signed-in account', async () => {
    const result = await api.request('POST', '/uploads/ticket', {
      body: { kind: 'TRIP_IMAGE', contentType: 'image/jpeg', bytes: 1000 },
    });
    assert.equal(result.status, 401);
  });

  test('the file name is decided here, not by the browser', async () => {
    const traveller = await api.register('uploader');
    const { ticket } = await upload(traveller.token, 'AVATAR');
    assert.ok(
      String(ticket.assetId).startsWith(`enhakkore/avatars/${traveller.id}/`),
      'the account id is part of the path, so one account cannot write into another',
    );
  });

  test('a file type outside the list is refused', async () => {
    const traveller = await api.register('wrongtype');
    const result = await api.request('POST', '/uploads/ticket', {
      token: traveller.token,
      body: { kind: 'AVATAR', contentType: 'application/x-msdownload', bytes: 1000 },
    });
    assert.equal(result.status, 422);
    assert.equal(result.body.error.code, 'file_type');
  });

  test('an oversized file is refused before it is sent', async () => {
    const traveller = await api.register('toobig');
    const result = await api.request('POST', '/uploads/ticket', {
      token: traveller.token,
      body: { kind: 'AVATAR', contentType: 'image/jpeg', bytes: 40 * 1024 * 1024 },
    });
    assert.equal(result.status, 422);
    assert.equal(result.body.error.code, 'file_too_large');
  });

  test('only an operator can upload verification documents', async () => {
    const traveller = await api.register('nosuch');
    const result = await api.request('POST', '/uploads/ticket', {
      token: traveller.token,
      body: { kind: 'VERIFICATION_DOCUMENT', contentType: 'application/pdf', bytes: 2000 },
    });
    assert.equal(result.status, 403);
  });

  test('an upload cannot be claimed without the provider confirming it', async () => {
    const traveller = await api.register('forger');
    const { ticket } = await upload(traveller.token, 'AVATAR');

    const forged = await api.request('POST', '/uploads/confirm', {
      token: traveller.token,
      body: { kind: 'AVATAR', assetId: ticket.assetId, version: '1', signature: 'made-up', format: 'jpg' },
    });
    assert.equal(forged.status, 422);
    assert.equal(forged.body.error.code, 'upload_unverified');
  });

  test('one account cannot claim another account’s upload', async () => {
    const owner = await api.register('owner');
    const stranger = await api.register('stranger');
    const { stored } = await upload(owner.token, 'AVATAR');

    const stolen = await api.request('POST', '/uploads/confirm', {
      token: stranger.token,
      body: {
        kind: 'AVATAR',
        assetId: stored.public_id,
        version: stored.version,
        signature: stored.signature,
        format: stored.format,
      },
    });
    assert.equal(stolen.status, 403);
  });

  test('a confirmed photo comes back with an address', async () => {
    const traveller = await api.register('photo');
    const { stored } = await upload(traveller.token, 'AVATAR');

    const confirmed = await api.request('POST', '/uploads/confirm', {
      token: traveller.token,
      body: {
        kind: 'AVATAR',
        assetId: stored.public_id,
        version: stored.version,
        signature: stored.signature,
        format: stored.format,
      },
    });
    assert.equal(confirmed.status, 200);
    assert.ok(confirmed.body.url, 'a public photo has an address');
    assert.ok(confirmed.body.bytes > 0);
  });
});

describe('verification documents', () => {
  let api: Api;
  before(async () => {
    api = await startApi();
  });
  after(async () => {
    await api.close();
  });

  /** Submits a verification record with one real uploaded document attached. */
  async function submitWithDocument(token: string) {
    const ticket = await api.request('POST', '/uploads/ticket', {
      token,
      body: { kind: 'VERIFICATION_DOCUMENT', contentType: 'application/pdf', bytes: 12 },
    });
    assert.equal(ticket.status, 200, JSON.stringify(ticket.body));

    const form = new FormData();
    for (const [name, value] of Object.entries(ticket.body.fields as Record<string, string>)) {
      form.append(name, value);
    }
    form.append('file', new Blob(['%PDF-1.4 xx'], { type: 'application/pdf' }), 'licence.pdf');
    const stored = (await (await fetch(ticket.body.uploadUrl, { method: 'POST', body: form })).json()) as Record<
      string,
      string
    >;

    const submitted = await api.request('POST', '/organizers/me/verification', {
      token,
      body: {
        legalName: 'Test Safaris Limited',
        contactName: 'Test Person',
        contactEmail: 'test@example.com',
        contactPhone: '+255700000000',
        documents: [
          {
            label: 'Tour operator licence',
            fileName: 'licence.pdf',
            assetId: stored.public_id,
            version: stored.version,
            signature: stored.signature,
            format: stored.format,
            bytes: Number(stored.bytes),
          },
        ],
      },
    });
    assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
    return stored;
  }

  test('a document is listed by name, and never by a public address', async () => {
    const token = await api.login(ACCOUNTS.pendingOrganizer);
    await submitWithDocument(token);

    const workspace = await api.request('GET', '/organizers/me', { token });
    const documents = workspace.body.verification.documents;
    assert.equal(documents.length, 1);
    assert.equal(documents[0].fileName, 'licence.pdf');
    assert.ok(
      !JSON.stringify(documents).includes('http'),
      'the listing must not contain a link anyone could follow',
    );
  });

  test('the owner can open their own document, by a link that expires', async () => {
    const token = await api.login(ACCOUNTS.pendingOrganizer);
    await submitWithDocument(token);

    const workspace = await api.request('GET', '/organizers/me', { token });
    const documentId = workspace.body.verification.documents[0].id;

    const link = await api.request('GET', `/organizers/me/verification/documents/${documentId}/download`, {
      token,
    });
    assert.equal(link.status, 200);
    assert.ok(link.body.url, 'a link is issued');
    assert.equal(link.body.expiresInMinutes, 10);

    const file = await fetch(link.body.url);
    assert.equal(file.status, 200, 'and it actually fetches the document');
    assert.equal(file.headers.get('cache-control'), 'no-store, private');
  });

  test('a second operator cannot reach the first one’s documents', async () => {
    const token = await api.login(ACCOUNTS.pendingOrganizer);
    await submitWithDocument(token);
    const workspace = await api.request('GET', '/organizers/me', { token });
    const documentId = workspace.body.verification.documents[0].id;

    const otherToken = await api.login(ACCOUNTS.otherOrganizer);
    const attempt = await api.request('GET', `/organizers/me/verification/documents/${documentId}/download`, {
      token: otherToken,
    });
    assert.equal(attempt.status, 404, 'absent rather than forbidden — its existence is not revealed');
  });

  test('an admin reviewing the submission can open it', async () => {
    const token = await api.login(ACCOUNTS.pendingOrganizer);
    await submitWithDocument(token);
    const organizer = await prisma.organizer.findFirstOrThrow({
      where: { user: { email: ACCOUNTS.pendingOrganizer } },
    });
    const workspace = await api.request('GET', '/organizers/me', { token });
    const documentId = workspace.body.verification.documents[0].id;

    const adminToken = await api.login(ACCOUNTS.admin);
    const link = await api.request('GET', `/admin/organizers/${organizer.id}/documents/${documentId}`, {
      token: adminToken,
    });
    assert.equal(link.status, 200);
    assert.ok(link.body.url);
  });

  test('a traveller cannot reach the admin route at all', async () => {
    const travellerToken = await api.login(ACCOUNTS.michael);
    const result = await api.request('GET', '/admin/organizers/anything/documents/anything', {
      token: travellerToken,
    });
    assert.equal(result.status, 403);
  });

  test('a document that was never uploaded cannot be attached', async () => {
    const token = await api.login(ACCOUNTS.pendingOrganizer);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: ACCOUNTS.pendingOrganizer } });
    const result = await api.request('POST', '/organizers/me/verification', {
      token,
      body: {
        legalName: 'Invented Documents Limited',
        contactName: 'Test Person',
        contactEmail: 'test@example.com',
        contactPhone: '+255700000000',
        documents: [
          {
            label: 'Tour operator licence',
            fileName: 'licence.pdf',
            assetId: `enhakkore/verification/${user.id}/invented`,
            version: '1',
            signature: 'made-up',
            format: 'pdf',
          },
        ],
      },
    });
    assert.equal(result.status, 422);
    assert.equal(result.body.error.code, 'upload_unverified');
  });
});
