# Collection commerce

Local implementation toward V1-04. This is not a V1 release or live commerce receipt.

Visual thesis: retain the quiet, artwork-led collection and add a compact order summary using the
merchant's existing colors. Content plan: artwork and variant first, quantity and owner price next,
then an explicit estimate and checkout action. Interaction thesis: selection updates the summary;
a changed selection invalidates its quote; loading/blocked states explain the next action without
hiding the artwork or inventing provider progress.

Owners separately enable ordering after reviewing prices and all saved print layouts. Public
preview approval alone does not authorize a collection to sell. Layout changes, replacement, and
withdrawal invalidate its sales activation. Server commerce gates continue to control actual
checkout and fulfillment.

## Durable purchase contract

`POST /api/collections/:id/quotes` accepts only publication/layout versions, item IDs, whole-number
quantities, a store session, and an idempotency request ID. The server resolves every price, variant,
technique, and print area from the approved publication. It does not accept customer-supplied prices
or artwork URLs. The quote is USD, valid for 30 minutes, with estimated shipping and checkout tax.
Supplier cost and margin fields are unmeasured placeholders, not a profitability calculation.

Private copies are staged in `DesignAsset` records before immutable object writes. Their manifest
records the original checksum, rendered checksum, storage namespace, owner labels/prices, publication
and layout versions. Finalizing asset readiness, the quote, and its redacted audit is transactional.
A lost upload response is recovered only after the stored bytes match. Failed finalization leaves
retryable staged rows, never a usable partial quote. The existing schema is sufficient; no migration
or public storage grant is added.

Completed request retries return the same quote. New rendering attempts are capped at 30 per session
and 120 per installation over a rolling hour, serialized in the database across replicas. The stored
limit record contains hashed session identifiers and timestamps, not IP addresses or artwork. These
limits bound preparation work; they are not a claim of general denial-of-service protection.

Checkout verifies the session, immutable quote, current publication/activation and all copied bytes.
One deterministic order ID per collection quote and a separate database advisory lock serialize
checkout retries. An uncertain Stripe request reuses the same order, original parameters, and Stripe
idempotency key. An existing session is recovered rather than creating a second one. Payment remains
webhook-driven; manual Printful draft review remains mandatory.

Fulfillment signs only the verified copied files. A paid copy survives later withdrawal or source
removal. Generic workbench image/draft access cannot expose or repurpose these records. Customer
order pages return a link to the current collection instead of rebuilding a generic-price cart.

## Retention and release limits

Keep collection print copies and their manifests while any order may require fulfillment, refund,
recovery, or support. Existing uploaded-artwork cleanup deliberately excludes them. Abandoned staged
copies are discoverable by `sourceType=collection`, `purpose=collection-print`, and pending status;
automated expiry/cleanup is not implemented yet. Do not bulk-delete them with upload cleanup.

Manual templates must be checked against the provider's current variant. This increment does not
prove physical print quality, actual shipping/tax accuracy, Stripe/Printful account access, or a live
order. Automatic template discovery and controlled personalization remain separate V1 work.

## Rehearsal evidence (2026-09-12)

The fixture unit contract covers owner pricing, exact quote reuse, concurrent checkout retry,
selection/session rejection, storage namespace and checksum mismatches, uncertain uploads, layout
changes during preparation, and source withdrawal. A separate limits test checks concurrency and
window expiry. The PostgreSQL test runs in fresh processes with private filesystem fixtures, verifies
quote reload and source independence, injects audit failure, and recovers the same pending request.
CI runs it with the existing installation-admin database tests against an isolated local database.
No paid provider is used for this evidence.

Owner workflow: [collection runbook](../launch/collection-owner-runbook.md).

Final local checks: lint, TypeScript, 119 passing backend tests (10 database-only skips in the
ordinary run), 17 passing root tests, frontend fixture/selector contracts, and production build.
The isolated PostgreSQL rehearsal passed all five installation/artwork/purchase tests without skips.
Browser verification passed the existing 11-viewport customer suite and policy/profile suite;
the final admin/purchase rehearsal passed at 1440px and 390px, including quantity persistence,
unchanged quote reuse, changed quantities, explicit sales activation/pause, exact checkout payload,
protected order-page reload, and the collection return link. Desktop/mobile screenshots were
visually inspected; a consent-control overflow found on mobile was fixed and rechecked.
