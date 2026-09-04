import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { HttpError } from '../middleware.js';
import { createApp } from '../app.js';
import { createOwnerRouter } from '../routes/owner.routes.js';
import {
  ownerRoleAllows,
  readOwnerContext,
  type OwnerMembership,
  type OwnerMembershipReader,
} from '../owner/owner-access.js';
import { createSupabaseOwnerVerifier, ownerBearerToken } from '../owner/supabase-owner-identity.js';
import { redactRequestUrl, setOperationalSink } from '../utils/operational-logger.js';

const identity = { issuer: 'https://auth.example/auth/v1', subject: 'owner-a' };
const membership: OwnerMembership = {
  ...identity,
  organization: { id: 'org-a', slug: 'alpha', name: 'Alpha', status: 'active' },
  role: 'owner',
  status: 'active',
  revokedAt: null,
};
const status = (code: number) => (error: unknown) =>
  error instanceof HttpError && error.statusCode === code;

test('role policy denies unknown roles and follows the owner action matrix', () => {
  const actions = ['read', 'edit-draft', 'publish', 'manage-members'] as const;
  for (const [role, count] of [
    ['viewer', 1],
    ['editor', 2],
    ['publisher', 3],
    ['owner', 4],
  ] as const) {
    assert.deepEqual(
      actions.map((action) => ownerRoleAllows(role, action)),
      actions.map((_, index) => index < count)
    );
  }
  for (const role of ['admin', 'OWNER', '__proto__', 'constructor', '']) {
    for (const action of actions) assert.equal(ownerRoleAllows(role, action), false);
  }
});

test('context rechecks scope, status, revocation and projects only organization display fields', async () => {
  const reader = {
    findMembership: async () => ({ ...membership, privateArtworkUrl: 'private', token: 'secret' }),
  };
  assert.deepEqual(await readOwnerContext(reader, identity, 'alpha'), {
    organization: { id: 'org-a', slug: 'alpha', name: 'Alpha' },
    role: 'owner',
    readOnly: true,
  });
  const denied: (OwnerMembership | null)[] = [
    null,
    { ...membership, issuer: 'https://other.example/auth/v1' },
    { ...membership, subject: 'owner-b' },
    { ...membership, organization: { ...membership.organization, slug: 'beta' } },
    { ...membership, organization: { ...membership.organization, status: 'disabled' } },
    { ...membership, role: 'admin' },
    { ...membership, status: 'invited' },
    { ...membership, revokedAt: '2026-09-04T00:00:00Z' },
  ];
  for (const row of denied) {
    await assert.rejects(
      readOwnerContext({ findMembership: async () => row }, identity, 'alpha'),
      status(404)
    );
  }
  await assert.rejects(readOwnerContext(reader, identity, '../alpha'), status(404));
  await assert.rejects(
    readOwnerContext(
      {
        findMembership: async () => {
          throw new Error('private connection');
        },
      },
      identity,
      'alpha'
    ),
    (error: unknown) => status(503)(error) && !String(error).includes('private connection')
  );
});

test('bearer parsing never accepts missing, combined, cookie-style or unbounded credentials', () => {
  for (const header of [
    undefined,
    '',
    'Basic code',
    'Bearer ',
    'Bearer a,b',
    'Bearer a Bearer b',
    'Bearer a\nb',
    `Bearer ${'a'.repeat(8193)}`,
  ]) {
    assert.throws(() => ownerBearerToken(header), status(401));
  }
  assert.equal(ownerBearerToken('bearer fake.token.signature'), 'fake.token.signature');
});

test('Supabase adapter performs fresh server verification and ignores metadata authorization claims', async () => {
  let calls = 0;
  const verifier = createSupabaseOwnerVerifier({
    url: 'https://auth.example',
    publishableKey: 'public-fixture-key',
    fetch: async (input, init) => {
      calls++;
      assert.equal(String(input), 'https://auth.example/auth/v1/user');
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer fake.token.signature');
      assert.equal(init?.redirect, 'error');
      assert.ok(init?.signal);
      return Response.json({
        id: 'owner-a',
        is_anonymous: false,
        email: 'private@example.com',
        user_metadata: { role: 'owner', organizationId: 'org-b' },
        app_metadata: { role: 'admin' },
      });
    },
  });
  assert.deepEqual(await verifier('fake.token.signature'), identity);
  assert.deepEqual(await verifier('fake.token.signature'), identity);
  assert.equal(calls, 2);
});

test('Supabase denies expired/invalid, anonymous, deleted, banned and malformed identities without provider detail', async () => {
  const cases = [
    { body: { message: 'private-token expired' }, httpStatus: 401 },
    { body: { message: 'private-token invalid' }, httpStatus: 403 },
    { body: { id: 'owner-a', is_anonymous: true }, httpStatus: 200 },
    { body: { id: 'owner-a' }, httpStatus: 200 },
    { body: { id: '', is_anonymous: false }, httpStatus: 200 },
    { body: { id: 'owner-a', is_anonymous: false, deleted_at: '2026-09-01' }, httpStatus: 200 },
    { body: { id: 'owner-a', is_anonymous: false, banned_until: '2999-01-01' }, httpStatus: 200 },
    { body: { id: 'owner-a', is_anonymous: false, banned_until: 'invalid' }, httpStatus: 200 },
  ];
  for (const item of cases) {
    const verifier = createSupabaseOwnerVerifier({
      url: 'https://auth.example',
      publishableKey: 'public-fixture-key',
      fetch: async () => Response.json(item.body, { status: item.httpStatus }),
    });
    await assert.rejects(
      verifier('fake.token.signature'),
      (error: unknown) => status(401)(error) && !String(error).includes('private-token')
    );
  }
  const unavailable = createSupabaseOwnerVerifier({
    url: 'https://auth.example',
    publishableKey: 'public-fixture-key',
    fetch: async () => Response.json({ message: 'private failure' }, { status: 503 }),
  });
  await assert.rejects(unavailable('fake.token.signature'), status(503));
  for (const url of [
    'http://auth.example',
    'https://user:secret@auth.example',
    'https://auth.example/path',
    'https://auth.example?key=secret',
  ]) {
    assert.throws(() => createSupabaseOwnerVerifier({ url, publishableKey: 'key' }));
  }
});

async function withServer(app: express.Express, run: (origin: string) => Promise<void>) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

test('two-organization HTTP fixture isolates identical subjects across issuers and refreshes revocations', async () => {
  let revokedAt: string | null = null;
  const rows = [
    membership,
    {
      ...membership,
      subject: 'owner-b',
      organization: { id: 'org-b', slug: 'beta', name: 'Beta', status: 'active' },
    },
  ];
  const reader: OwnerMembershipReader = {
    findMembership: async (actor, slug) => {
      const row = rows.find(
        (item) =>
          item.issuer === actor.issuer &&
          item.subject === actor.subject &&
          item.organization.slug === slug
      );
      return row ? { ...row, revokedAt } : null;
    },
  };
  const app = express();
  app.use(
    '/api/owner',
    createOwnerRouter({
      memberships: reader,
      verifyIdentity: async (token) => ({
        issuer: token === 'foreign' ? 'https://other.example/auth/v1' : identity.issuer,
        subject: token === 'b' ? 'owner-b' : 'owner-a',
      }),
    })
  );
  app.use(
    (
      error: HttpError,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      res.status(error.statusCode).json({ error: error.message });
    }
  );
  await withServer(app, async (origin) => {
    const request = (slug: string, token: string) =>
      fetch(`${origin}/api/owner/organizations/${slug}/context`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    assert.equal((await request('alpha', 'a')).status, 200);
    assert.equal((await request('beta', 'b')).status, 200);
    const cross = await request('beta', 'a');
    const absent = await request('missing', 'a');
    assert.equal(cross.status, 404);
    assert.deepEqual(await cross.json(), await absent.json());
    assert.equal((await request('alpha', 'foreign')).status, 404);
    const result = await request('alpha', 'a');
    assert.equal(result.headers.get('cache-control'), 'private, no-store');
    assert.equal(result.headers.get('vary'), 'Authorization');
    assert.equal(((await result.json()) as { data: { readOnly: boolean } }).data.readOnly, true);
    revokedAt = '2026-09-04T00:00:00Z';
    assert.equal((await request('alpha', 'a')).status, 404);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      assert.equal(
        (
          await fetch(`${origin}/api/owner/organizations/alpha/context`, {
            method,
            headers: { Authorization: 'Bearer a' },
          })
        ).status,
        404
      );
    }
  });
});

test('production composition remains closed; admin, guest, query and browser claims do not substitute for owner auth', async () => {
  setOperationalSink(() => {});
  try {
    await withServer(createApp(), async (origin) => {
      const path = `${origin}/api/owner/organizations/alpha/context`;
      for (const headers of [
        {},
        { 'x-admin-access': 'operator-code' },
        { cookie: 'owner=secret' },
        { 'x-owner-subject': 'owner-a', 'x-organization-id': 'org-a' },
      ]) {
        assert.equal(
          (await fetch(path, { headers: headers as Record<string, string> })).status,
          401
        );
      }
      assert.equal((await fetch(`${path}?access_token=secret`)).status, 401);
      const unavailable = await fetch(path, {
        headers: { Authorization: 'Bearer guest-or-owner-token' },
      });
      assert.equal(unavailable.status, 503);
      assert.equal(
        ((await unavailable.json()) as { errorCode: string }).errorCode,
        'owner_access_unavailable'
      );
      assert.equal(unavailable.headers.get('cache-control'), 'private, no-store');
      assert.match(unavailable.headers.get('vary') ?? '', /Origin/);
      assert.match(unavailable.headers.get('vary') ?? '', /Authorization/);
    });
  } finally {
    setOperationalSink();
  }
  assert.equal(
    redactRequestUrl('/api/owner/organizations/secret/context?access_token=secret'),
    '/api/owner/[redacted]'
  );
  assert.equal(redactRequestUrl('/api/owner?access_token=secret'), '/api/owner/[redacted]');
  assert.equal(redactRequestUrl('/API/OWNER?access_token=secret'), '/api/owner/[redacted]');
});
