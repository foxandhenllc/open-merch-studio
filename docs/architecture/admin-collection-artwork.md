# Private collection artwork

September 10, 2026. Owner upload and attachment implement another part of V1-04. Collection
publication, product-specific print review, customer customization enforcement, and purchase of
these drafts remain open release gates.

## Owner workflow

In `/admin` → Collections, choose a product and its print areas. Each area accepts a library file
or an original PNG, JPEG, or WebP upload after permission confirmation. Front and back can use
different images. The owner sees a private preview, dimensions, transparency information, and a
review requirement. Saving drafts records those bindings; uploading alone adds a library file.

This supports an artist's original work, a creator's existing emote, an owner-selected community
photo, or a local business's artwork without editing source code. No persona-specific provider
integration is implied. Upload never calls OpenAI or remove.bg and never replaces the original.

Visual thesis: retain the quiet collection workspace and put an authentic artwork preview beside
the print area it belongs to. Keep upload instructions collapsed after use and use plain-language
recovery messages. The collection text preview is still not a supplier mockup.

Preparation rotates for image orientation, produces an sRGB PNG derivative, and creates a small
WebP preview. The original bytes are preserved, including their embedded metadata. Derivatives
omit embedded metadata. Transparency is measured from pixels, not just alpha-channel existence.
Images below 600 pixels on the shortest side are marked blocked; larger images always require
review of product size, placement, colors, content, and permission. Neither result certifies print
quality or rights. Permission confirmation records the installation admin's assertion and time.

## Private storage and contracts

- All endpoints are under `/api/admin/collection-artwork` with the existing installation admin gate
  and private, no-store responses. They accept no merchant selector, arbitrary URL, or storage path.
- The existing RLS-protected `AdminSetting` table stores metadata under
  `installation-artwork-v1:<UUID>`. No new migration is required. This installation library is
  separate from customer `DesignAsset` records, guest runtime drafts, and the public design API.
- Original, prepared PNG, and preview are all stored in the configured **private upload bucket**,
  under a server-generated `owner-artwork/<UUID>/` folder. Every storage operation verifies that
  the bucket is private. Metadata fingerprints the bucket/project configuration; changing storage
  cannot silently substitute another installation's files.
- The browser receives a short-lived, non-upserting signed upload URL in memory. It uploads bytes
  directly without an admin credential in that request. Previews and original retrieval require
  the admin header; the browser displays previews through revocable Blob URLs. The original
  download API returns a one-minute signed download link in production and original bytes in
  fixtures. A client must fetch that link without the admin header. It is deliberately a JSON
  response, not an automatic redirect that could forward a custom header. Normal library and
  completion responses omit paths, checksums, namespace fingerprints, and signed read URLs.
- Authenticated API routes: list, authorize, complete, read preview/original bytes, and remove.
  Production requires both PostgreSQL and configured private storage; a database failure does not
  switch into fixtures. The library's `available` field indicates configuration, not a successful
  provider connection check. Actual operations verify the connection and bucket.
- A draft item stores only `{ placementCode, assetId }` bindings. Old drafts with no `artwork`
  field normalize to an empty list. The shared contract rejects duplicate areas, unknown fields,
  unselected areas, and invalid identifiers. Saving checks that every file is complete in this
  installation's library. Artwork changes and draft saves share a PostgreSQL advisory transaction
  lock; metadata mutations and redacted audits commit together.

## Limits and recovery

The library holds up to 100 files. Uploads are bounded by `UPLOAD_MAX_BYTES` and a 20 MB maximum;
prepared PNGs also have a 20 MB limit. Decode accepts single-frame images up to 40 million pixels.
The underlying private bucket must accept PNG, JPEG, and WebP within these limits. Fixture mode
accepts up to 2 MB per original and 32 MB of total in-memory file data, clears on server restart,
and does not contact storage or paid providers.

Original uploads and downloads transfer directly with storage so they do not pass through
[Vercel's function payload limit](https://vercel.com/docs/functions/limitations#request-body-size).
The browser connection policy permits standard `https://*.supabase.co` project endpoints so a
fork does not inherit one merchant's storage hostname. Custom storage domains require a reviewed
connection-policy change; the supported setup uses the standard Supabase project URL.

Completion is idempotent once preparation succeeds. A retry after a lost upload response first
checks whether the file arrived. A failed preview has its own retry button. Pending uploads remain
visible after refreshing the library and can be removed before starting again. Failed derivative
writes remain under the recorded asset folder so removal can clean partial attempts.

Detaching or deleting a collection draft preserves library files. Removing a file requires that
all saved draft references have been detached and saved, and any published previews using the file
have been withdrawn or replaced. A deletion marker immediately
prevents new bindings, preparation, or reads, even if storage cleanup fails. Cleanup errors stay
visible and can be retried; the server does not report a missing provider response as success.

Supabase signed upload URLs last two hours and cannot be invalidated by deleting the object. Keep
a deletion marker until the upload window and a five-minute grace period have elapsed, then use
**Finish removal** to clear any late upload and its metadata. There is no scheduled cleanup job in
this slice. The expiry is recorded after signing returns, including an uncertain response. If
recording that result fails, cleanup retains an unconfirmed marker; an operator must investigate
storage/signing state before final removal. Do not delete that record merely to hide the error.
See the [signed-upload API](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl),
[upload behavior](https://supabase.com/docs/reference/javascript/file-buckets-uploadtosignedurl), and
[bucket privacy](https://supabase.com/docs/guides/storage/buckets/fundamentals).

Owner library retention is explicit removal, separate from customer-session retention. Back up
the metadata and private bucket together. Restoring metadata alone cannot recover image bytes;
changing the configured bucket requires an operator-reviewed migration of both data and namespace
metadata. Current published previews now pin their originals through the
[publication contract](./admin-collection-publication.md); historical order retention and production
placement need their own commerce contract.

## Local verification

Source: uncommitted work based on `223bc5ac960416c997f72a3ce6d8b741f1999a5f`; not a deployment or
V1 release. All artwork used synthetic fixtures. No live storage, AI, payment, or fulfillment
provider was used to prove behavior.

- Node 22.12.0 / npm 10.9.2: lint, type-check, build, 114 backend tests, and 17 root-script tests
  passed. Nine optional database tests were skipped by the default suite.
- Four installation-admin tests passed on a temporary, separate PostgreSQL server with all 16
  migrations applied unchanged. The new test verifies artwork metadata and file recovery across
  processes, original-byte preservation, idempotent completion, saved-reference removal guards,
  audit rollback, private-bucket refusal, deletion expiry, and metadata RLS. Storage uses a local
  disk adapter in this test; Supabase behavior still needs installation-specific evidence.
- CI uses a separate PostgreSQL server for installation-admin tests because the owner-isolation
  migration intentionally creates a cluster-wide role. A second database on the original server
  would collide with that role. No production migration was changed to accommodate tests.
- `npm run test:browser` passed: customer flow at 11 viewports, policy/profile checks, and admin
  at 1440 and 390 pixels. The admin runs with the deployment's actual browser connection policy.
  Artwork checks cover different front/back files, explicit permission, unchanged original bytes,
  real binding payloads, reload persistence, interrupted preparation, lost signed-upload response,
  preview retry, library reuse, area detachment, and saved-reference removal refusal. A routed
  synthetic Supabase hostname proves the fork's upload is allowed without sending an admin header.
- Desktop and mobile artwork screens were visually inspected. Artifacts are gitignored at
  `artifacts/private/admin-artwork-2026-09-10/`. No horizontal overflow or page errors were observed.
- `npm run config:rehearse-admin` passed with a fresh dependency install and a separate synthetic
  merchant identity. CI YAML and `git diff --check` passed. Remote CI and live provider/deployment
  checks have not been run for these edits.
