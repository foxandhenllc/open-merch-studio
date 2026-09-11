# Owner print layouts

Visual thesis: extend the quiet admin workspace with a clear template canvas and compact inch-based
controls. Content plan: select a published product area, enter template size and offsets, save,
inspect the transparent canvas, then download the prepared PNG. Interaction thesis: explicit loading
feedback, preview invalidation on edits, and a saved-version check before every preview/export.

Owners supply dimensions from the selected variant's actual print template; the existing catalog's
product-level dimensions have insufficient unit/variant provenance to fill these automatically.
Artwork width comes from the approved collection review. Height preserves the original proportions.
Only rectangular, uncropped placement is supported. This is a template canvas, not a supplier mockup,
digitization service, bleed generator, or guarantee of print quality.

Layouts live on the private current publication with their own revision. Saving one does not alter
the public collection version. Replacing or withdrawing the publication discards its layouts. Saves
and exports check the publication version, layout revision, and current source/catalog review.
Exports additionally verify the original bytes against the recorded checksum before rendering.

The output is a transparent PNG at 300 pixels per inch, bounded to 40 million pixels and 20 MB.
Resampling does not improve the original's effective resolution. No cropping, AI, background removal,
or mutation of the stored original occurs. Derivatives are rendered on demand behind admin access;
they are not stored publicly or connected to an order. Templates and offsets are recorded in inches,
rounded to output pixels only during rendering. An out-of-bounds layout is rejected before rendering.

These manually checked exports are one production-placement step. Automatic provider-template
lookup, supplier mockups, immutable purchased files, and binding these layouts into checkout and
fulfillment remain V1 work. A saved layout never authorizes payment or production.

## Owner workflow

1. In **Admin → Collections**, find the published preview and choose **Prepare print layouts**.
2. Select the product's print area. Read its approved artwork size and effective resolution.
3. Enter the template width/height and artwork offsets from the template's left and top edges.
   Check these against the provider's selected variant template, including bleed requirements.
4. Confirm the template check and save. Use **Preview saved canvas** to inspect the transparent
   margins and placement, then **Download prepared PNG**. Inspect the file before production.
5. Reopen saved layouts to recover stored values or resolve a concurrent-edit conflict. Reopening
   discards unsaved entries. Editing the dimensions clears the preview and disables export until
   the new layout is saved and previewed. Browser navigation warns about unsaved dimensions.

The original stays behind the existing private-storage adapter. No bucket privacy or access policy
is changed; see [Supabase's private-bucket access model](https://supabase.com/docs/guides/storage/buckets/fundamentals).
Export routes require installation-admin access and return private no-store responses. Filenames
contain no credentials or original upload names. Object URLs are revoked after use.

## Local verification — September 11, 2026

Verified working-tree increment before the checkpoint commit, based on `223bc5ac960416c997f72a3ce6d8b741f1999a5f`. This is
local fixture evidence, not a deployment, a real supplier mockup, or a physical sample approval.

- Node 22.12.0 / npm 10.9.2: lint, type checks, build, and `git diff --check` passed.
- `npm test`: 116 backend cases passed (nine optional database cases skipped without credentials),
  17 script tests, and frontend fixture/selector contracts passed.
- Export regression checks verify exact 2400 × 3000 output at 300 PPI, transparent margin pixels,
  positioned artwork pixels, unchanged original bytes, and bounded previews. Invalid dimensions,
  clipping, duplicate/foreign areas, unknown fields, oversized canvases, missing confirmation,
  mismatched original bytes, stale source/layout/publication versions, and withdrawal are rejected.
- Four installation-admin PostgreSQL tests passed on an isolated temporary loopback cluster with
  all 16 unchanged migrations. Saved layouts survive process restart and can render from restored
  private original bytes; failed audit writes roll back layout changes. Cleanup left zero admin
  settings and audit rows; temporary database/storage resources were removed.
- `npm run test:browser` passed the customer flow across 11 viewports, the policy/profile contract,
  and admin flows at 1440 and 390 pixels. The new browser contract checks invalid-layout recovery,
  actual save payloads, saved-value reload, private preview decoding, actual downloaded PNG metadata,
  unauthenticated export rejection, and export invalidation on edits.
- Desktop/phone screenshots were visually inspected with no horizontal overflow or page errors.
  Private, gitignored artifacts and a source manifest are at
  `artifacts/private/print-layouts-2026-09-11/`.
- No live provider, payment, or fulfillment action was used. Supabase documentation/changelog was
  checked; this increment requires no new migration, SDK change, storage object, or policy grant.
