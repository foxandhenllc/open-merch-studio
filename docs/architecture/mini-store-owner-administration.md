# Authenticated mini-store administration

September 4, 2026. Architecture checkpoint after the merchant configuration rehearsal.
The read-only owner endpoint is registered but unavailable in production composition. No sign-in
settings, database roles, real memberships, or migrations are activated by this checkpoint.

## Decision and scope

Build a separate owner API over verified identities and organization-scoped repositories. Retain the
existing public read-only storefront and operator recovery API. Customer accounts/order history,
guest receipt capabilities, and owner identities remain separate authorization domains. Signing in
as an owner does not grant access to guest orders or enable payment for that organization.

Use Supabase Auth as the first identity adapter because the installation already uses Supabase and
pins its JavaScript SDK. Express verifies the presented access token with the configured project's
`auth.getUser(token)` and rejects missing, invalid, expired, anonymous, or disabled identities.
Return only a narrow `VerifiedOwnerIdentity` containing issuer and subject to the owner domain.
Never accept a browser-supplied subject, email, organization claim, or `ADMIN_ACCESS_CODE` as identity.
The Auth API performs a server request to authenticate the user; it is not local session decoding.
See [the getUser contract](https://supabase.com/docs/reference/javascript/auth-getuser).

The initial owner sign-in should use PKCE with an allowlisted callback origin and a dedicated callback
route that scrubs codes before observability mounts. Keep access/refresh tokens in the auth adapter,
not guest-cart or order-access storage. The first slice can require sign-in again after reload rather
than invent persistent application sessions. Send access tokens in Authorization headers, never URLs
or logs. If persistent HttpOnly sessions are introduced later, specify refresh rotation, CSRF,
SameSite, origin checks, and logout revocation as a separate contract. Rate-limit sign-in and writes.
Require a server-side session revocation check for material writes; do not promise that deleting a
user or client logout instantly invalidates every already-issued JWT.

## Membership and role checks

Resolve `(issuer, subject)` to a durable identity and membership. The current `OrganizationMember`
contains only a subject string, role string, and organization ID. Add an issuer-scoped identity key,
explicit membership status, constrained role values, and revocation metadata before using it for
owner access. Never link memberships merely because an email matches an order or an organization.
Initial membership provisioning belongs to the protected operator workflow and a verified identity;
invitations and owner transfers are later work with explicit acceptance and audit records.

| Role | Read own drafts | Edit drafts/products/collections | Publish/unpublish | Manage members |
| --- | --- | --- | --- | --- |
| Viewer | Yes | No | No | No |
| Editor | Yes | Yes | No | No |
| Publisher | Yes | Yes | Yes | No |
| Owner | Yes | Yes | Yes | Yes, once member-management safeguards ship |

Every request resolves the organization on the server, verifies active organization and membership,
and checks the action. Recheck membership inside the mutation transaction and serialize revocation
against writes so removed membership cannot commit a later edit. Unknown roles fail closed. Preserve
at least one active owner in future member-management transactions. Return indistinguishable 404s
for another organization's private object and an absent object; use 401 for unauthenticated requests.
Fresh database membership is authoritative; JWT metadata is not the role source. User metadata is
editable and JWT-held membership can be stale, as documented in [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Database and repository boundary

The current nine domain tables have RLS enabled and no browser-role policies. That denies direct
browser access; it does not constrain the privileged Prisma connection. Do not expose the existing
operator services directly behind a sign-in middleware and call that tenant isolation.

Before owner mutations, introduce a dedicated owner database role that is neither a table owner nor
`BYPASSRLS`. It receives only required operations. Keep `anon`/`authenticated` direct table grants
revoked. Owner transactions set verified issuer/subject and organization with parameterized
transaction-local settings; both RLS `USING` and `WITH CHECK` predicates verify organization and fresh
membership. Missing context denies access. Never set connection-global tenant state in a pool.
Keep membership writes inaccessible to the ordinary editor repository; do not use a publicly
callable SECURITY DEFINER helper to bypass these checks.

Also add organization-aware composite keys/foreign keys for storefront-to-collection,
collection-to-product, and product-to-design-version relationships. Backfill organization IDs only
after auditing existing links; fail the migration on conflicting ownership rather than reassigning
records. Every repository read/update/delete includes the authorized organization, even with RLS.
Server-owned catalog records remain shared read-only references. Quote/artwork imports require an
explicit authorized source grant and verified rights/provenance, not possession of an arbitrary
quote ID, asset ID, or guest session string. Different print areas retain their distinct immutable
artwork-version assignments.

## Drafts, publishing, and audit

New products, collections, and storefront revisions are private drafts. Editing a published entity
creates or updates a separate draft revision; it does not edit the revision currently served publicly.
Use optimistic revision numbers on writes, with a conflict response for stale editors.

Publish is an explicit transaction: authorize publisher, lock revision, verify same-organization
ownership for every relationship, revalidate catalog/variant availability and every artwork's rights,
policy/readiness state, assemble an immutable reduced publication snapshot, switch the active
publication pointer, and append an audit event. Any failure leaves the previous publication intact.
Unpublish clears that pointer and records actor/reason/revision in the same transaction. Invalidate
public caches before acknowledging the transition. Neither transition enables Checkout.

Audit material edits, import, publication, unpublication, and membership changes with organization,
verified actor, action, object, revision, timestamp, and request correlation. Write audit records
atomically with the change. Store field names and safe change summaries, never credentials, private
artwork URLs, raw provider payloads, or customer contact/shipping data.

## Existing gaps that block owner mutations

- `saveQuotedProduct` currently creates active products and mutates them in place. It resolves a
  quote globally under operator authority, which is unsuitable for an owner request.
- The schema's ordinary foreign keys allow cross-organization relationships between otherwise valid
  records. The owner schema/repository must reject these at both application and database levels.
- `getPublishedStorefront` returns the built-in Fox & Hen example on a missing published database
  record or database error. An owner unpublish must never resurrect that fallback. Keep the example
  available in explicit fixture mode, but let a durable unpublish/tombstone take precedence.
- Publication checks artwork today, but public reads only recheck product/variant availability.
  Public projection and drift handling need current artwork eligibility checks too.
- `publicUrl` allows arbitrary HTTPS and root-relative strings. Owner inputs need a controlled public
  media projection that rejects signed/private storage URLs, bearer query parameters, provider URLs,
  protocol-relative paths, and internal notes. HTTPS alone is not evidence that artwork is public.

The public DTO continues to expose only storefront/brand display data, approved public media, product
display names, quantities, placement labels, and opaque public product identifiers. Internal artwork,
quote, provider, storage, membership, and audit records never appear in it. An owner draft DTO is a
different type and does not become public by changing a status flag.

## Implementation checkpoints and evidence

1. Identity adapter, read-only owner context, role evaluator, and two-organization fixture tests.
   Invalid tokens, anonymous users, unknown roles, inactive memberships, and admin-code substitution
   must fail. No owner mutation endpoints yet.
2. Local PostgreSQL migration for issuer-scoped identities, constrained roles, ownership foreign keys,
   draft revisions/publication snapshots, audit actors, and the dedicated RLS role. Test cross-org
   SELECT/INSERT/UPDATE/DELETE, membership revocation, pool reuse, and all role denials using that
   nonprivileged role. Deploy schema only after those gates and target identity are verified.
3. Draft product/collection editing through the scoped transaction repository. Test stale revisions,
   per-placement source ownership, reorder uniqueness, and atomic audit rollback. Fixture mode uses
   explicit fake verified identities; a missing database must report unavailable, not saved.
4. Publish/unpublish and drift handling. Test read privacy, unpublish fallback suppression, blocked
   artwork, stale catalog, transactional races, and public DTO secret rejection. Keep Fox & Hen's
   published read-only route passing desktop/mobile checks throughout.
5. Owner UI, sign-in/reload/logout, keyboard and mobile flows, and independent authenticated browser
   QA across two organizations. Only then expose administration. Per-organization Stripe/Printful,
   tax, support, policy approval, and supervised real order authorization remain separate gates.

### Checkpoint 1 evidence — September 4, 2026

Implemented `backend/src/owner/supabase-owner-identity.ts`, `owner-access.ts`, and
`backend/src/routes/owner.routes.ts`. The adapter uses the pinned SDK's explicit `getUser(token)`
network path, bounded to five seconds with redirects rejected and session persistence/refresh off.
It rejects anonymous, deleted, banned, invalid, and expired identities and discards email/metadata.
Issuer comes from the configured Auth origin, never the request. Provider failures are replaced with
safe errors. No Auth project configuration or service-role fallback is inferred from storage settings.

`GET /api/owner/organizations/:organizationSlug/context` accepts only an Authorization bearer header.
Its reader contract requires fresh issuer/subject membership and active organization/membership,
known role, and no revocation. The response projects organization ID/slug/name, role, and
`readOnly: true`; it contains no private designs, provider payloads, identity claims, or write grants.
Responses are private/no-store. Unsupported owner routes/methods return a fixed 404. Owner request
paths and query strings are redacted from operational/access logs, including case variants.

The production router has **no dependencies wired in**: missing bearer credentials return 401 and
presented credentials return 503 `owner_access_unavailable`. Neither environment flags, an existing
Prisma connection, nor fixture mode can activate it. This is deliberate: subject-only legacy
memberships are not a safe substitute for the next database checkpoint. The role matrix describes
policy; it does not implement or authorize any mutation endpoint.

`backend/src/tests/owner-access.test.ts` exercises the SDK through a fake HTTP transport and a
test-only two-organization membership reader. It verifies cross-organization/issuer denials,
revocation on the next request, unknown roles, inactive membership/organization, safe projection,
non-cacheability, rejected admin/cookie/query/header claims, and the closed production composition.
This proves application contracts, not real sign-in or database isolation. No live Auth or order
provider is called by those tests.

Local verification passed configuration validation/staleness checks, lint, type-check, build,
fixture smoke, production dependency audit, 101 backend tests (four database integration tests
require PostgreSQL), 15 script tests, frontend contracts, and the browser suite across 11 viewports.
The isolated Community Gear Lab rehearsal also passed with live gates disabled. These checks retain
the existing customer workflow and read-only storefront; they do not substitute for RLS tests.

The safest next implementation is checkpoint 2: local database constraints and a nonprivileged
owner repository with RLS denial tests before draft writes. Production Auth configuration, initial
real owner membership, and a restricted database credential need verified project/account targets
before activation; this checkpoint does not create or enable them.
