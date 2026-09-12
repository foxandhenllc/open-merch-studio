# Collection purchase preparation

September 12, 2026. Server-side groundwork for V1-04; no collection checkout is enabled.

The workbench quote path calculates cost-plus prices and resolves customer design assets. An owner
collection needs its published price and exact approved print files. `prepareCollectionPurchase`
provides a separate, server-only preparation boundary before integrating either durable quotes or
payment. It has no HTTP route and is not an authorization API.

## Input and result

The only accepted input fields are `collectionId`, `version`, `layoutRevision`, and `items`.
Each item contains only its published `itemId` and `quantity`. All fields are required. Duplicate
items, extra fields, fractional quantities, and browser-supplied prices, files, or asset IDs are
rejected. The existing commerce bounds apply: at most ten lines and 1–25 units per line. Only USD
and fixed owner artwork are supported at this stage.

The result is an in-memory preparation candidate containing:

- Publication and layout versions plus the approved review fingerprint.
- The selected published product, supplier variant, print technique, title, quantity, and owner
  price. The merchandise subtotal is price times quantity; it excludes shipping, tax, and any
  future quote-level adjustments. It is not a checkout total or profitability estimate.
- One private PNG per selected item/print area, independent of quantity. Each file includes its
  exact SHA-256, original checksum and asset reference, saved placement geometry, dimensions, and
  density. Buffers are newly rendered; mutating a result does not mutate the publication or original.
- `orderingAvailable: false`.

These internal fields and bytes must not be serialized into public responses or logs. No file or
candidate is persisted by this function. It is not an immutable purchased artifact, backup, quote,
order, or permission to charge. A failed preparation returns no partial result.

## Validation order and concurrency

1. Validate and copy the caller's selection before waiting on the shared collection lock.
2. Resolve the exact publication and layout revision. Verify approval, current catalog availability,
   artwork metadata, and review fingerprint using a detached catalog snapshot.
3. Resolve every selected price, supplier variant, technique, and required print layout. Check all
   layout dimensions and the aggregate render budget before reading the first original. An
   unselected product's missing price does not invalidate the selected product's price.
4. Read originals privately, verify their checksums, and render each separate print area. The
   existing 300-PPI / 40-million-pixel / 20-MB per-file limits apply. One preparation permits at most
   80 million aggregate canvas pixels and 40 MiB of output, with sequential rendering.
5. Repeat the current review after rendering. Catalog sync does not share the collection lock;
   a changed catalog or source fingerprint suppresses the result. Publication/layout saves and
   artwork deletion do share the lock.

Later private draft edits do not change a published price. Replacing/withdrawing publication or
changing a layout makes the corresponding older request invalid. The result does not stay
purchasable indefinitely: a future caller must persist the necessary metadata and exact files with
recoverable failure handling, and revalidate relevant versions before creating payment.

The private PNG export uses the same original-verification and current-review helpers, avoiding a
second interpretation of which artwork is approved.

## Owner-visible readiness

**Check sales readiness** now checks every published print area for a confirmed, valid saved layout.
A missing back layout is an owner action even when the front is saved. A passing layout check proves
saved geometry only: it does not inspect rendered bytes, approve a supplier template, or enable
production. Rendering verifies source bytes; supplier templates still require owner review.

## Next integration boundary

Persist exact purchased files in private storage, record an immutable manifest and owner-price
snapshot with the durable quote, and handle cleanup/retry after partial storage or database failure.
Transport large private files through protected storage delivery rather than assuming a hosting
function can return every accepted PNG size. Bind the manifest into Stripe and reviewed Printful
fulfillment while retaining checkout authorization, idempotent webhooks, and manual confirmation.
The public collection remains a preview until that end-to-end contract is implemented and verified.

## Local verification receipt

Verified September 12 on the working increment based on `e591363`, before its checkpoint commit.

- Node 22.12.0 / npm 10.9.2: lint, type checks, tests, and build passed. The standard suite passed
  117 backend cases (nine optional database cases skipped), 17 script tests, and frontend contracts.
- Focused regressions cover distinct front/back files, original/output checksums, published prices
  after private edits, quantity bounds, unsupported currency, forged inputs, missing prices/layouts,
  metadata corruption, stale versions, withdrawal, and catalog changes during rendering. Aggregate
  pixel limits and invalid selections are rejected before any original read.
- Four isolated PostgreSQL admin tests passed using all 16 unchanged migrations. A new process
  prepared an owner-priced selection and private PNG from restored metadata/storage. Cleanup left
  zero admin settings/audit records; the temporary cluster and artwork directory were removed.
- Customer browser checks passed across 11 viewports and the policy/profile contract passed. The
  admin extension initially used an incorrect exact dropdown label; after correcting its selector,
  `test:admin-browser` passed at 1440 and 390 pixels, including incomplete-to-complete layout checks,
  actual requests, private PNG download, and collection checkout remaining unavailable.
- Desktop/phone readiness screenshots were visually inspected. Private, ignored captures are in
  `artifacts/private/purchase-preparation-2026-09-12/`.
- The existing private-storage boundary is unchanged; the
  [Supabase private-bucket documentation](https://supabase.com/docs/guides/storage/buckets/fundamentals)
  and changelog were checked. No SDK, schema, grant, bucket, or live provider change was required.

This is local fixture/database evidence. No real payment, supplier order, or deployment was made.
