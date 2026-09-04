import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { Prisma, PrismaClient } from '@prisma/client';
import { openOwnerMembershipReader } from '../owner/owner-membership.repository.js';
import { HttpError } from '../middleware.js';

// Separate opt-in: npm test must never use the application's DATABASE_URL for these role tests.
const testUrl = process.env.OMS_OWNER_TEST_DATABASE_URL;

test('restricted PostgreSQL owner membership isolation', { skip: !testUrl }, async (t) => {
  const url = new URL(testUrl!);
  assert.ok(
    ['localhost', '127.0.0.1'].includes(url.hostname),
    'Use an isolated local test cluster.'
  );
  assert.ok(['/oms_owner_isolation_test', '/open_merch_studio'].includes(url.pathname));
  const admin = new PrismaClient({ datasources: { db: { url: testUrl } }, log: [] });
  const restrictedUrl = new URL(url);
  restrictedUrl.username = 'oms_owner_reader';
  restrictedUrl.password = 'oms-local-reader-only';
  restrictedUrl.searchParams.set('connection_limit', '1');
  const sql = new PrismaClient({ datasources: { db: { url: restrictedUrl.href } }, log: [] });
  const reader = openOwnerMembershipReader(restrictedUrl.href);
  const suffix = randomUUID();
  const orgA = { id: randomUUID(), slug: `alpha-${suffix}`, name: 'Alpha' };
  const orgB = { id: randomUUID(), slug: `beta-${suffix}`, name: 'Beta' };
  const legacyOrg = { id: randomUUID(), slug: `legacy-${suffix}`, name: 'Legacy' };
  const actorA = { issuer: 'https://alpha.example/auth/v1', subject: `shared-${suffix}` };
  const actorB = { ...actorA, issuer: 'https://beta.example/auth/v1' };
  const identityA = randomUUID();
  const identityB = randomUUID();
  const memberA = randomUUID();
  const memberB = randomUUID();
  const ids = [orgA.id, orgB.id, legacyOrg.id];
  const denied = (error: unknown) =>
    error instanceof Prisma.PrismaClientKnownRequestError && error.meta?.code === '42501';
  const unavailable = (error: unknown) =>
    error instanceof HttpError &&
    error.statusCode === 503 &&
    error.errorCode === 'owner_access_unavailable';
  async function context<T>(
    actor: typeof actorA,
    slug: string,
    run: (tx: Prisma.TransactionClient) => Promise<T>
  ) {
    return sql.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('oms.owner_issuer', ${actor.issuer}, true),
        set_config('oms.owner_subject', ${actor.subject}, true),
        set_config('oms.owner_organization_slug', ${slug}, true)`;
      return run(tx);
    });
  }
  let loginActivated = false;
  try {
    const [role] = await admin.$queryRaw<
      Array<{ rolcanlogin: boolean }>
    >`SELECT rolcanlogin FROM pg_roles WHERE rolname = 'oms_owner_reader'`;
    assert.equal(role?.rolcanlogin, false, 'The migration must not activate a login.');
    await admin.$executeRaw`ALTER ROLE oms_owner_reader LOGIN PASSWORD 'oms-local-reader-only'`;
    loginActivated = true;
    await admin.organization.createMany({ data: [orgA, orgB, legacyOrg] });
    await admin.organizationMember.create({
      data: { organizationId: legacyOrg.id, subject: actorA.subject, role: 'owner' },
    });
    await admin.ownerIdentity.createMany({
      data: [
        { id: identityA, ...actorA, status: 'active' },
        { id: identityB, ...actorB, status: 'active' },
      ],
    });
    await admin.ownerMembership.createMany({
      data: [
        {
          id: memberA,
          identityId: identityA,
          organizationId: orgA.id,
          organizationSlug: orgA.slug,
          role: 'owner',
          status: 'active',
        },
        {
          id: memberB,
          identityId: identityB,
          organizationId: orgB.id,
          organizationSlug: orgB.slug,
          role: 'editor',
          status: 'active',
        },
      ],
    });

    await t.test(
      'RLS denies missing context and scopes unfiltered SQL across both organizations and issuers',
      async () => {
        assert.deepEqual(await sql.$queryRaw`SELECT id FROM public.organizations`, []);
        assert.deepEqual(
          await sql.$queryRaw`SELECT "identityId" FROM public.owner_memberships`,
          []
        );
        assert.deepEqual(
          await context(
            actorA,
            orgA.slug,
            (tx) => tx.$queryRaw`SELECT id FROM public.organizations`
          ),
          [{ id: orgA.id }]
        );
        assert.deepEqual(
          await context(
            actorB,
            orgB.slug,
            (tx) => tx.$queryRaw`SELECT id FROM public.organizations`
          ),
          [{ id: orgB.id }]
        );
        assert.deepEqual(
          await context(
            actorA,
            orgB.slug,
            (tx) => tx.$queryRaw`SELECT id FROM public.organizations`
          ),
          []
        );
        assert.equal(await reader.findMembership(actorA, orgB.slug), null);
        assert.equal(await reader.findMembership(actorB, orgA.slug), null);
        assert.equal(await reader.findMembership(actorA, legacyOrg.slug), null);
        assert.equal(await reader.findMembership(actorA, `${orgA.slug}' OR true --`), null);
        assert.equal((await reader.findMembership(actorA, orgA.slug))?.organization.id, orgA.id);
        // Even a person belonging to both organizations sees only the selected organization per call.
        const extra = await admin.ownerMembership.create({
          data: {
            identityId: identityA,
            organizationId: orgB.id,
            organizationSlug: orgB.slug,
            status: 'active',
          },
        });
        assert.deepEqual(
          await context(
            actorA,
            orgA.slug,
            (tx) => tx.$queryRaw`SELECT "organizationId" FROM public.owner_memberships`
          ),
          [{ organizationId: orgA.id }]
        );
        await admin.ownerMembership.delete({ where: { id: extra.id } });
      }
    );

    await t.test(
      'every role can read only context; own and cross-org writes, private columns and domain tables are denied',
      async () => {
        for (const role of ['viewer', 'editor', 'publisher', 'owner']) {
          await admin.ownerMembership.update({ where: { id: memberA }, data: { role } });
          assert.equal((await reader.findMembership(actorA, orgA.slug))?.role, role);
          for (const target of [orgA.id, orgB.id]) {
            await assert.rejects(
              context(
                actorA,
                orgA.slug,
                (tx) =>
                  tx.$executeRaw`UPDATE public.organizations SET name = 'forbidden' WHERE id = ${target}`
              ),
              denied
            );
            await assert.rejects(
              context(
                actorA,
                orgA.slug,
                (tx) => tx.$executeRaw`DELETE FROM public.organizations WHERE id = ${target}`
              ),
              denied
            );
          }
          await assert.rejects(
            context(
              actorA,
              orgA.slug,
              (tx) =>
                tx.$executeRaw`INSERT INTO public.owner_memberships (id, "identityId", "organizationId", "organizationSlug", "updatedAt") VALUES ('forbidden', ${identityA}, ${orgB.id}, ${orgB.slug}, now())`
            ),
            denied
          );
          await assert.rejects(
            context(
              actorA,
              orgA.slug,
              (tx) => tx.$executeRaw`UPDATE public.owner_memberships SET role = 'owner'`
            ),
            denied
          );
          await assert.rejects(
            context(
              actorA,
              orgA.slug,
              (tx) => tx.$executeRaw`DELETE FROM public.owner_memberships`
            ),
            denied
          );
        }
        for (const query of [
          Prisma.sql`SELECT * FROM public.owner_identities`,
          Prisma.sql`SELECT * FROM public.orders`,
          Prisma.sql`SELECT * FROM public.design_assets`,
          Prisma.sql`SELECT * FROM public.saved_products`,
          Prisma.sql`SELECT * FROM public.organization_members`,
        ]) {
          await assert.rejects(
            context(actorA, orgA.slug, (tx) => tx.$queryRaw(query)),
            denied
          );
        }
        await assert.rejects(sql.$executeRaw`SET ROLE postgres`, denied);
        await assert.rejects(
          sql.$executeRaw`CREATE TABLE public.forbidden_owner_table(id text)`,
          denied
        );
        await assert.rejects(sql.$executeRaw`TRUNCATE public.owner_memberships`, denied);
      }
    );

    await t.test(
      'fresh reads observe revocation, inactive identities/organizations and membership status',
      async () => {
        await admin.ownerMembership.update({
          where: { id: memberA },
          data: { status: 'revoked', revokedAt: new Date() },
        });
        assert.equal(await reader.findMembership(actorA, orgA.slug), null);
        await admin.ownerMembership.update({
          where: { id: memberA },
          data: { status: 'inactive', revokedAt: null },
        });
        assert.equal(await reader.findMembership(actorA, orgA.slug), null);
        await admin.ownerMembership.update({ where: { id: memberA }, data: { status: 'active' } });
        await admin.ownerIdentity.update({
          where: { id: identityA },
          data: { status: 'disabled' },
        });
        assert.equal(await reader.findMembership(actorA, orgA.slug), null);
        await admin.ownerIdentity.update({ where: { id: identityA }, data: { status: 'active' } });
        await admin.organization.update({ where: { id: orgA.id }, data: { status: 'inactive' } });
        assert.equal(await reader.findMembership(actorA, orgA.slug), null);
        await admin.organization.update({ where: { id: orgA.id }, data: { status: 'active' } });
        assert.ok(await reader.findMembership(actorA, orgA.slug));
      }
    );

    await t.test(
      'commit and rollback clear transaction context on the same pooled connection',
      async () => {
        const before = await context(
          actorA,
          orgA.slug,
          (tx) => tx.$queryRaw`SELECT pg_backend_pid() AS pid`
        );
        assert.deepEqual(await sql.$queryRaw`SELECT pg_backend_pid() AS pid`, before);
        assert.deepEqual(await sql.$queryRaw`SELECT id FROM public.organizations`, []);
        await assert.rejects(
          context(actorA, orgA.slug, async (tx) => {
            await tx.$queryRaw`SELECT id FROM public.organizations`;
            throw new Error('rollback-fixture');
          }),
          /rollback-fixture/
        );
        assert.deepEqual(await sql.$queryRaw`SELECT pg_backend_pid() AS pid`, before);
        assert.deepEqual(await sql.$queryRaw`SELECT id FROM public.organizations`, []);
      }
    );

    await t.test(
      'schema rejects unknown roles/statuses, inconsistent revocation, and mismatched organization keys',
      async () => {
        await assert.rejects(
          admin.ownerMembership.update({ where: { id: memberA }, data: { role: 'admin' } })
        );
        await assert.rejects(
          admin.ownerMembership.update({ where: { id: memberA }, data: { status: 'unknown' } })
        );
        await assert.rejects(
          admin.ownerMembership.update({ where: { id: memberA }, data: { revokedAt: new Date() } })
        );
        await assert.rejects(
          admin.ownerMembership.update({
            where: { id: memberA },
            data: { organizationSlug: orgB.slug },
          })
        );
        await assert.rejects(
          admin.ownerIdentity.update({ where: { id: identityA }, data: { status: 'unknown' } })
        );
        await admin.organization.update({
          where: { id: orgA.id },
          data: { slug: `${orgA.slug}-renamed` },
        });
        assert.equal(await reader.findMembership(actorA, orgA.slug), null);
        assert.ok(await reader.findMembership(actorA, `${orgA.slug}-renamed`));
        await admin.organization.update({ where: { id: orgA.id }, data: { slug: orgA.slug } });
      }
    );

    await t.test(
      'reader rejects privileged credentials, disabled RLS and privilege drift with safe errors',
      async () => {
        const wrongReader = openOwnerMembershipReader(testUrl!);
        try {
          await assert.rejects(wrongReader.findMembership(actorA, orgA.slug), unavailable);
        } finally {
          await wrongReader.close();
        }
        await admin.$executeRaw`ALTER TABLE public.owner_identities DISABLE ROW LEVEL SECURITY`;
        try {
          await assert.rejects(reader.findMembership(actorA, orgA.slug), unavailable);
        } finally {
          await admin.$executeRaw`ALTER TABLE public.owner_identities ENABLE ROW LEVEL SECURITY`;
        }
        await admin.$executeRaw`GRANT UPDATE (name) ON public.organizations TO oms_owner_reader`;
        try {
          await assert.rejects(reader.findMembership(actorA, orgA.slug), unavailable);
        } finally {
          await admin.$executeRaw`REVOKE UPDATE (name) ON public.organizations FROM oms_owner_reader`;
        }
        assert.ok(await reader.findMembership(actorA, orgA.slug));
      }
    );

    await t.test('browser roles have no direct owner or storefront table access', async () => {
      for (const role of ['anon', 'authenticated']) {
        for (const table of [
          'owner_identities',
          'owner_memberships',
          'organizations',
          'organization_members',
          'brand_profiles',
          'saved_designs',
          'design_versions',
          'saved_products',
          'merch_collections',
          'collection_products',
          'storefronts',
        ]) {
          const [grants] = await admin.$queryRaw<
            Array<{ allowed: boolean }>
          >`SELECT has_any_column_privilege(${role}, ${`public.${table}`}, 'SELECT,INSERT,UPDATE,REFERENCES') OR has_table_privilege(${role}, ${`public.${table}`}, 'DELETE,TRUNCATE,TRIGGER') AS allowed`;
          assert.equal(grants.allowed, false, `${role} must not access ${table}`);
        }
      }
    });
  } finally {
    await Promise.all([reader.close(), sql.$disconnect()]);
    if (loginActivated) {
      await admin.organization.deleteMany({ where: { id: { in: ids } } });
      await admin.ownerIdentity.deleteMany({ where: { id: { in: [identityA, identityB] } } });
      await admin.$executeRaw`ALTER ROLE oms_owner_reader NOLOGIN PASSWORD NULL`;
    }
    await admin.$disconnect();
  }
});
