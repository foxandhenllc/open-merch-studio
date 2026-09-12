# Expired collection preparation retention

An installation owner can review expired, unattached collection print preparations and clear them
from private storage. Keep every preparation referenced by any order, regardless of payment or
fulfillment status. Original artwork and published previews are outside this cleanup.

The admin uses a small maintenance panel in Orders & review: explain the seven-day grace period,
show aggregate counts, and offer an explicit clear action. Never display storage paths, customer
identifiers, or private URLs. Fixture mode explains that durable cleanup is unavailable.

## Retention and recovery contract

- The server reads bounded batches of old preparation records and returns aggregate counts/bytes,
  with a continuation cursor for another batch. A preview does not change storage.
- Eligibility requires the seven-day post-expiry grace period, matching metadata on every copied
  asset, a matching private-storage namespace, and no order or other quote reference. Unknown or
  inconsistent records are retained. Never repurpose this as a general artwork eraser.
- Preparation creation, checkout, and cleanup share the per-quote lock. Cleanup rechecks eligibility
  under the collection lock, marks all copies `retiring`, and writes an audit entry before removing
  private folders. Staged/retired records cannot be reused to finalize a purchase.
- After removal, `retired` tombstones and a completion audit commit together. Metadata and quotes
  remain for diagnosis; cleanup does not erase order, financial, or original-artwork records.
- A failed or uncertain deletion remains `retiring`. Review again and retry; already-missing
  folders are safe to revisit. Do not manually delete the tombstones to force a retry.
- Successful purchase finalization updates staged manifests to the same final quote, including its
  expiration after a recovered attempt. Older inconsistent records fail the eligibility check and
  need a targeted investigation instead of automatic deletion.
- This is an owner-invoked maintenance action, not a scheduled background job. No live storage was
  cleared during implementation. Private-storage account configuration remains deployment-managed.

## September 12 local evidence

PostgreSQL/private-filesystem tests prove read-only inventory, namespace mismatch rejection,
protection of paid/pending/refunded/cancelled orders, audit rollback before deletion, recovery after
removal with a lost response, fresh-process retry, and cleanup of staged files without a Quote row.
Reusing a retired request is rejected. Path, age, duplicate-file and metadata tampering are covered
without a provider. Browser contracts test confirmation/cancel, exact payload, partial failure and
retry feedback using intercepted responses; real fixture mode truthfully reports cleanup unavailable.
Desktop and phone layouts are checked with the complete owner/order workflow.

