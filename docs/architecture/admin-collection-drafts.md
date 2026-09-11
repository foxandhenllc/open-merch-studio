# Installation collection drafts

September 10, 2026. This contract covers private collection planning in `/admin`. The subsequent
[review and publication contract](./admin-collection-publication.md) adds public artwork previews
and withdrawal. Production placement and purchase validation remain V1-04 gates.

## Owner experience

Visual thesis: a calm, paper-colored workspace with a compact collection list, a readable editor,
private artwork previews beside each print area, and a text preview that never impersonates a product mockup.
Content plan: collection list and new-draft action, collection details, product configurations, then
preview and save. One accent identifies the current draft and primary action.
Interaction thesis: immediate text preview, clear selection/hover feedback, and explicit saved,
unsaved, and conflict states; honor reduced motion and retain local edits across admin navigation.

Owners can name and describe a collection, choose guidance for a permanent collection, event,
community feature, or limited drop, configure product/variant/print areas, record a target price,
and plan an artwork mode. Guidance changes no fields or integrations automatically. These choices
cover artist events, creator drops, coffee features, and everyday local merchandise without coding
those personas into the reusable admin. No credentials or private artwork URLs belong in drafts.

Original artwork can now be attached to individual print areas using the
[private owner library](./admin-collection-artwork.md). Removing an area detaches its file without
deleting the library original; selecting another catalog product resets its area bindings.

Product, price, and artwork-mode choices remain plans. Saving does not change customer permissions,
published prices, the public collection, or payment/fulfillment gates. The preview contains text and
configuration only. It does not claim a print-ready file or a supplier mockup exists.

## Storage and authorization

`/api/admin/collections` uses installation admin authority, inherited no-store responses, and an
explicit JSON contract. It never accepts an organization selector or exposes the unwired tenant
owner API. Up to 20 drafts, each with 15 product configurations, fit in one bounded versioned
`AdminSetting` document. No migration or new browser database access is needed.

The service serializes mutations using a PostgreSQL transaction advisory lock, checks the expected
revision, and atomically writes the draft document and a redacted audit event. Audit metadata holds
only revision/counts, never collection descriptions or provider payloads. A database failure never
falls back to a successful fixture save. Nonproduction without a database uses an explicitly labeled
process-local fixture, serialized for the same stale-write semantics.

The shared contract rejects unknown fields, duplicate identifiers, invalid integers/modes, and
oversized text/lists. Every save validates product/variant/placement relationships against the
installation's current catalog. The admin reader never substitutes the sample catalog when a
configured database fails or is empty. Existing drafts remain inspectable when catalog entries
become unavailable; the editor identifies affected rows before a resave.

## Next contract

Connect a reviewed collection to a production placement and an immutable purchased configuration
that quoting and checkout can enforce. Current public previews are versioned, replaceable snapshots;
they are not historical order records.
Revalidate availability and owner-allowed customization on the server, including stale carts.
Keep this draft plan separate from active customer controls until that path passes its tests.

## Local verification — September 10, 2026

The receipt below covers the initial editor. The subsequent upload/binding slice has its own
[artwork verification receipt](./admin-collection-artwork.md#local-verification).

Source: uncommitted work based on `223bc5ac960416c997f72a3ce6d8b741f1999a5f`, not a release or a
production deployment. All provider behavior used fixtures; no payment, order, or provider request
was used to prove this editor.

- Node 22.12.0 / npm 10.9.2: lint, type-check, unit/contracts, and production build passed.
  Backend suite: 112 passed, 8 optional database tests skipped. Root scripts: 17 passed.
- The three installation-admin PostgreSQL tests then passed against a newly created loopback-only
  `oms_store_admin_test` database using the complete migration chain. They verified process restart
  persistence and atomic audit rollback for settings/profile/collections; the collection test also
  verified stale revisions, catalog drift, and redacted audit metadata. Other optional database
  suites were not rerun by this slice.
- Browser suite passed the existing customer flow at 11 viewports and admin at 1440 and 390 pixels.
  Collection checks covered two independently signed-in tabs, conflict recovery preserving local
  text, explicit discard/reload, navigation retention, reload persistence, product ordering,
  purpose changes preserving fixed artwork intent, and cents/mode/revision request payloads.
- Desktop and phone screenshots were inspected from the gitignored local artifact directory
  `artifacts/private/admin-collections-2026-09-10/`. No horizontal overflow was observed.
- The clean dependency-install profile rehearsal passed with the new workspace package included.
  CI is configured for the same durable admin checks; remote CI has not been run for these edits.
