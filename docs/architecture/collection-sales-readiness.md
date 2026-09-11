# Published collection sales readiness

This increment inspects a published collection before connecting it to commerce. It does not open
checkout. The current checkout uses calculated prices and customer-session artwork; neither may
silently replace the owner's published price or original.

Visual thesis: retain the quiet admin workspace with one compact, readable result beneath each
published collection. Content plan: published version, check action, owner-action findings, then
remaining implementation requirements. Interaction thesis: explicit checking feedback, immediate
replacement of old results on retry, and automatic dismissal when a publication version changes;
no decorative motion or new dashboard cards.

The protected check takes only a collection ID and expected published version. It reads under the
collection lock and reruns the existing review against the published snapshot, not the editable
draft. Source, catalog, dimensions, or rights drift invalidates that review. Private draft edits
alone do not invalidate the public version. Missing or withdrawn publications and stale versions
return conflicts instead of silently checking a different configuration.

Price checks require a positive, integer, owner-specified price for each published product. They
do not estimate profit, request provider pricing, change prices, or assert that the eventual order
total includes shipping or tax. Owners repair missing prices in drafts and explicitly republish.

The result distinguishes owner actions from unimplemented production placement and collection
checkout. It always reports ordering unavailable. Successful source checks prove metadata matches
the reviewed snapshot; they do not prove a private storage object's bytes are recoverable or a
physical print looks correct. Existing publication verifies preview availability separately.

The snapshot review seam is shared with publication and is intended for the later quote/checkout
contract. It must be rerun at that boundary, with durable artwork and production-file validation,
not replaced by a previously displayed admin result. No saved readiness flag grants authorization.

The review fingerprint now sorts object keys before hashing. PostgreSQL JSONB can reorder those
keys; semantically identical saved data must retain the same digest across a restart. Array order
remains meaningful except for the explicitly sorted widths and catalog fingerprints. Existing
pre-release previews using the earlier fingerprint may need explicit review and republication;
the service does not silently treat an unverifiable earlier approval as current.

The endpoint is `POST /api/admin/collection-publications/:id/sales-readiness` with the sole body
field `version`. It retains installation-admin authentication and private no-store responses.
Expected-version checks use the collection's version, not an unrelated collection's revision.
The result includes check time and version, safe product titles/prices, and categorized findings;
it contains no private artwork identifiers, checksums, paths, or provider credentials.

Manual layout saving and export were subsequently added in the [print-layout contract](./collection-print-layouts.md).
Readiness now reports saved area counts while retaining the automatic order-placement gate.

## Verification — September 10, 2026

Local working-tree increment based on `223bc5ac960416c997f72a3ce6d8b741f1999a5f`; not a release
or deployment. Node 22.12.0 / npm 10.9.2 were used. No live provider calls or purchases were made.

- Lint, type checks, and build passed. `npm test` passed 115 backend cases (nine optional database
  cases skipped without credentials), 17 script cases, and the frontend fixture/selector contracts.
- The publication API regression covers protected readiness access, exact expected version,
  rejected override fields, changed artwork metadata, unavailable variants, missing published
  prices, unchanged published state after private edits, and withdrawal. Results stay redacted
  and ordering stays unavailable.
- Four isolated PostgreSQL admin tests passed after applying all 16 unchanged migrations. A fresh
  process now verifies readiness against a saved publication. This test exposed and confirmed the
  fix for JSONB key ordering falsely invalidating the fingerprint. Temporary database/storage
  resources were cleaned up; zero admin settings or audit rows remained.
- `npm run test:browser` passed customer flows across 11 viewports, policy/profile checks, and admin
  flows at 1440 and 390 pixels. After the fingerprint fix, `npm run test:admin-browser` passed again
  on both sizes. Added checks cover failed-request retry, the exact version request body, readable
  owner/development statuses, and removing stale results when a publication is replaced.
- Desktop and phone screenshots were visually inspected; no horizontal overflow or page errors
  were observed. Gitignored artifacts and a source hash manifest are in
  `artifacts/private/sales-readiness-2026-09-10/`. `git diff --check` passed.

Production placement, immutable purchased artwork, owner-price enforcement in quotes, and collection
checkout remain unfinished. This check identifies those requirements; it does not implement them.
