# Owner review and public collection previews

This V1 increment lets an owner review original artwork at an intended print size and explicitly
publish a collection preview. Published products are not yet purchasable. The next gate is a server
contract that binds a purchased line to approved artwork, variant, placement, and price.

## Interaction and visual plan

The owner is an artist, creator, or local business operator with finished artwork. The admin surface
uses a quiet, linear review: saved product, intended width, original proportions and resolution,
explicit owner checks, then publication. It extends the existing utility layout and uses real private
artwork thumbnails rather than simulated product mockups. Mobile keeps the same sequence.

Public previews use the installation's brand and color tokens, generous artwork space, restrained
type, and a clear collection title. Content order is brand, preview status, collection description,
artwork and planned products, then support. There is no checkout call to action. The distinct visual
story for an artist is their own original artwork becoming a reviewed collection. A screenshot of
this page must not imply a physical sample, a provider-rendered mockup, or completed commerce.

## Review contract

- Only fixed owner artwork can be published in this increment. Customer upload, generation, and
  reference modes remain draft plans until their purchase contract exists.
- Owners enter an intended width in inches for each selected area. Height preserves the original's
  proportions. The service rejects less than 150 pixels per inch and warns below 300. Existing
  blocked originals remain blocked. Embroidery needs a separate digitization workflow.
- Product-level placement dimensions in the current catalog are not authoritative variant templates.
  Owners must check the actual selected product's template, placement, bleed, colors, and rights.
  This record does not crop, position, render, or approve a production file automatically.
- The review digest includes the saved draft revision, selected widths, current catalog and variant
  values, and original checksums and dimensions. Publishing recomputes it under the shared collection
  lock. Changed source data, stale publication revisions, missing preview bytes, or incomplete
  attestations prevent publication.

The resolution guidance follows [Printful's file guide](https://www.printful.com/graphics-and-embroidery-guide)
and [DPI explanation](https://help.printful.com/hc/en-us/articles/360014007920-What-is-DPI-resolution-and-actual-print-file-size).
Product-specific requirements still take precedence over this general screen.

## Owner steps and recovery

1. In **Admin → Collections**, select the draft and attach an original to each selected print area.
   Choose **Owner artwork only** for each product's planned customer options, then save the draft.
2. Under **Review & publish**, enter each intended print width from the selected product's template.
   Choose **Review saved collection** and resolve the listed issues. The calculated height keeps
   the original proportions; it is not a crop or positioning tool.
3. Check the product template and the artwork yourself, then confirm the three review statements.
   **Publish collection preview** creates a public link immediately; it does not require a redeploy.
4. Open the published link to inspect the visitor view. Save later draft edits privately, then
   review and publish again when ready to replace the public version.
5. Use **Withdraw preview**, then **Confirm withdrawal**, to stop serving the public page and images.
   Private drafts and originals remain available. Previously downloaded images cannot be recalled.

If another admin session changed drafts, reload saved drafts after preserving any local edits. If
publication status changed, use **Refresh publication status** and review again. A missing private
preview requires restoring its bytes and matching metadata before publication can succeed. Do not
change bucket privacy to work around that failure. Fixture publication lasts only for the local
server session; production requires the durable database and private storage described below.

## Publication and privacy

`installation-collection-publications-v1` is a private AdminSetting with one current snapshot per
collection (maximum 20). Each publish or withdrawal increments a global revision. Replacement removes
the prior snapshot; this is not a historical release archive. Future order retention requires a
separate immutable commerce record. Publication and its redacted audit event commit atomically.

Private draft edits do not alter the public snapshot. Published artwork remains pinned even when
removed from the private draft. Withdrawal removes the public record and thumbnail access. Versions
are never reused, including after withdrawal and republication.

The public API constructs a narrow DTO containing collection copy, product titles, planned prices,
and versioned thumbnail URLs. It omits private asset IDs, filenames, originals, paths, checksums,
credentials, and owner approval records. Only the approved WebP derivative is served through the
backend. Originals and print files stay in a private bucket; [Supabase public buckets bypass read
access control](https://supabase.com/docs/guides/storage/buckets/fundamentals).

Public collection responses and thumbnails use no-store and noindex. Thumbnail requests recheck the
current version after storage reads to close a withdrawal race. Withdrawal prevents future server
access; it cannot recall an image a visitor already downloaded. Admin mutation routes retain the
existing server authentication boundary. Missing production database or private storage fails closed.

No provider is called to prove this flow. Fixture browser checks and isolated PostgreSQL tests cover
review, publication, restart, conflict, rollback, private-file access, and withdrawal.

## Local verification — September 10, 2026

This receipt covers an uncommitted working-tree increment based on
`223bc5ac960416c997f72a3ce6d8b741f1999a5f`. It is not a deployment, release tag, live print-quality
assessment, or completed V1-04. All artwork and commerce used synthetic fixtures.

- Node 22.12.0 / npm 10.9.2: lint, type checks, and production build passed.
- `npm test`: 115 backend tests passed, nine optional database cases skipped in the credential-free
  run; 17 root script tests and both frontend fixture/selector contracts passed.
- Four installation-admin PostgreSQL tests passed on an isolated temporary loopback cluster after
  applying all 16 unchanged migrations. Coverage includes published-state restart, thumbnail recovery,
  failed-audit rollback, draft-independent artwork retention, withdrawal, and private-artwork cleanup.
  Cleanup left zero admin settings and audit rows; the five seeded catalog products remained. The
  temporary cluster was stopped and removed.
- The publication API test verifies authentication, invalid dimensions, insufficient resolution,
  missing confirmations, stale source/draft/publication revisions, missing storage, narrow public
  responses, original-file privacy, checkout rejection for an owner-library ID, replacement, and a
  withdrawal that arrives during thumbnail access.
- `npm run test:browser`: existing customer contracts passed across 11 viewports and the policy/profile
  contract passed. The first admin pass encountered a navigation-idle timeout after a successful
  withdrawal. The new visitor checks now wait for the actual page result; `npm run test:admin-browser`
  passed at 1440 and 390 pixels, including real request bodies, image decoding, private-edit isolation,
  publication replacement, old-image revocation, withdrawal, and no horizontal overflow/page errors.
- `npm run config:rehearse-admin` passed from a clean dependency install with an isolated Harbor
  Community Merch profile. The source checkout was unchanged by the rehearsal.
- Desktop and phone review/publication screenshots were visually inspected. Private, gitignored
  artifacts and the source hash manifest are under `artifacts/private/admin-publications-2026-09-10/`.
- `git diff --check` passed. No schema change, production configuration change, deployment, live
  provider request, purchase, or fulfillment draft was made for this increment.

Remaining V1-04 work: production placement and preview, immutable purchased configurations, collection
price and allowed-action enforcement in quote/checkout, and stale/withdrawn-cart handling. Public
previews deliberately expose `orderingAvailable: false` until that contract is complete.
