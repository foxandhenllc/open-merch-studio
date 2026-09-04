# Owner membership database boundary

September 4, 2026. Checkpoint 2a of [owner administration](./mini-store-owner-administration.md).
This is a read-only membership boundary, not the product-editing or publication database contract.
The application still registers its owner router without dependencies. No deployment flag activates
the reader, and no real identity, membership, login, or credential is provisioned here.

## Decision

Keep legacy `organization_members` separate. Its subject-only keys and arbitrary role strings cannot
be safely promoted into authenticated grants. New `owner_identities` bind the exact server-verified
issuer and subject, with a unique constraint and an active/disabled status. New `owner_memberships`
bind those identities to organizations, constrain the four roles and membership statuses, and
require revocation status and timestamp to agree. Identities default disabled; memberships default
inactive and viewer. There is no backfill, email match, or automatic owner assignment.

The membership stores organization ID and slug under a composite foreign key. That small
denormalization allows RLS to scope membership by the requested slug without a recursive policy
between organizations and memberships. A slug rename cascades; mismatched ID/slug pairs fail.
It does not solve the separate product/design/collection ownership constraints still required.

## Read boundary

Migration `20260904213000_owner_membership_isolation` creates `oms_owner_reader` as NOLOGIN,
NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, and NOBYPASSRLS. A conflicting existing role
causes the migration to fail rather than inherit unknown grants. No password is committed or set
by the migration. It grants only the columns needed for identity/membership/context reads.

RLS follows an acyclic dependency order: active identity matches transaction-local issuer/subject;
active, unrevoked membership matches that identity and transaction-local organization slug; active
organization matches the slug and that membership. The reader role has no INSERT, UPDATE, DELETE,
TRUNCATE, or product/artwork/order grants, regardless of the application membership role. There are
no SECURITY DEFINER helpers, browser-role policies, or owner mutation policies.

The migration revokes PUBLIC schema creation and direct PUBLIC/anon/authenticated privileges on the
two new and nine existing storefront-domain tables. This removes implicit browser grants without
changing the privileged operator connection's table ownership. Review preexisting grants and
database roles on the intended deployment before applying this migration.

`openOwnerMembershipReader(databaseUrl)` creates its own Prisma pool with an explicit restricted
credential. It never uses `DATABASE_URL`, the application Prisma singleton, or a fixture fallback.
Each call starts a read-only transaction, checks the connection is really `oms_owner_reader` (not
a privileged session using SET ROLE), rejects elevated attributes/role memberships, public schema
creation, table or column write grants, and missing/disabled RLS on the three context tables.
SQL statement and transaction deadlines bound the read.

Issuer, subject, and organization slug use parameterized `set_config(..., true)` values. Those values
expire on commit/rollback. The query also explicitly filters the same identity/organization and
projects a narrow result. Database errors become the existing safe unavailable error. Fresh
READ COMMITTED reads begun after a committed revocation deny access; this is not a serialization
contract for writes or an immediate revocation promise for already-running reads.

The restricted credential belongs only to trusted server code. RLS protects row access when queries
omit filters; it does not make arbitrary SQL execution or disclosure of that credential safe, since
the trusted connection sets the identity context. Future provisioning must audit target grants,
callable privileged functions, and role ownership as well as these application checks.

## Repeatable local verification

Use an isolated local PostgreSQL cluster, not a production connection or port-forward. The dedicated
test URL must use localhost/127.0.0.1 and the `oms_owner_isolation_test` database (CI uses its disposable
`open_merch_studio` service database). The suite temporarily enables a synthetic login on the reader
role and restores NOLOGIN with no password afterward. It deletes only its generated fixture rows.

After starting the local cluster and creating that database:

```sh
export OMS_OWNER_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55483/oms_owner_isolation_test
psql "$OMS_OWNER_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/prisma/ci-storage-bootstrap.sql
DATABASE_URL="$OMS_OWNER_TEST_DATABASE_URL" npx prisma migrate deploy --schema backend/prisma/schema.prisma
npm run type-check
npm run test:owner-db
```

Use Node 22.12.0 from `.nvmrc`. The dedicated command fails if its URL is absent; ordinary `npm test`
skips this database suite unless the separate opt-in URL is set. CI supplies the disposable PostgreSQL
17 service and runs this gate after the existing recovery integration suite. No provider credentials
or real Auth request are involved.

The integration suite proves unfiltered SQL isolation across two organizations and two issuers with
the same subject, same-person multi-organization scoping, legacy non-promotion, all four role denials,
private-column/domain-table denial, revocation/status checks, commit/rollback pool reuse, role/status
and composite-key constraints, safe connection rejection, privilege/RLS drift rejection, and denied
browser access to all eleven domain/identity tables. Local PostgreSQL 14.20 passed all eight tests.

## Remaining activation gates

Do not wire this reader into production yet. The next schema checkpoint establishes product/design/
collection composite ownership, private draft revisions, immutable publication snapshots and audit
actors. Future mutation repositories need transaction authorization, revocation serialization,
optimistic concurrency, and RLS USING/WITH CHECK denial tests; this read-only credential gets no write
grants as a shortcut.

Before real activation, verify the target Supabase project/database and Auth issuer, audit existing
grants, apply the reviewed migrations, provision a dedicated restricted login through managed secrets,
and create verified memberships through an audited operator workflow. Sign-in UI and per-organization
commerce remain separate checkpoints. Source deployment alone neither applies this migration nor
enables owner access.
