# Changelog

Entries describe source changes. They do not imply a release tag or production deployment.

## Unreleased — working toward V1.0.0

### Owner controls

- Protected installation admin with image-model selection and persistent AI budget/allowance controls.
- Supported provider credential entry through a configured hosting bridge, with separate save and
  deployment states and no secret readback.
- Merchant branding, contact information, order/email labels, and policy editing through private
  drafts and explicitly reviewed publication.
- Coordinated profile builds for storefront, server, policies, checkout, email, and static metadata.
- Store setup begins with brand preview; AI artwork controls remain optional.
- Private collection drafts with configurable names, descriptions, purpose guidance, product and
  variant choices, print areas, planned customer artwork options, target prices, reorder/removal,
  and a text preview. Drafts persist with revision conflicts and atomic redacted audit events;
  they do not publish products or alter live checkout prices/customer permissions.
- Private owner artwork library with original-image upload, separate front/back attachment,
  authenticated previews, reuse/detach controls, permission confirmation, and image preparation
  without AI or background removal. Saved collection references prevent accidental file removal.
  Prepared images require explicit product-specific owner review before preview publication.
- Intended print-size and resolution review, explicit template/content/public-display confirmation,
  and versioned collection preview publication at `/collections`. Saved private edits leave the
  public version intact. Replacing or withdrawing a preview revokes its old thumbnail routes, and
  published references protect library files from removal. Ordering is separately enabled after price and print-layout approval.
- Published collections now include a protected sales-readiness check for source/catalog drift and
  missing owner prices. It checks the published snapshot independently of private edits, rejects
  stale versions, and distinguishes owner actions from the remaining production and checkout work.
- Manual print-template layouts for published artwork, with per-area dimensions and offsets,
  revisioned saves, private canvas previews, and transparent 300-PPI PNG export. Server checks reject
  clipping, oversized canvases, stale layouts, and mismatched original bytes. Original files stay
  unchanged; layouts survive restart and are discarded when the collection is replaced or withdrawn.
  Automatic provider-template lookup remains unfinished; manual templates must be checked against the current provider variant.
- Sales readiness now identifies each missing or invalid saved print layout, including an unsaved
  back print. A server-only purchase-preparation contract resolves published owner prices and
  supplier variants, verifies original bytes, and prepares separate print files with checksums.
  It rejects altered inputs, stale versions, and oversized batches.
- Published, explicitly enabled collections now create durable owner-priced quotes and immutable
  private print copies. Quantity selection, estimate review, policy acceptance, checkout, and a
  protected order page work in the fixture rehearsal. Checkout retries reuse one order/session;
  fulfillment verifies the copied files even after source withdrawal.
- Owners can list/review orders, privately download exact saved collection prints, acknowledge or
  resolve an issue with a note, and explicitly retry eligible draft preparation. Notes preserve
  payment and production facts. Fixture reviews cannot contact a provider.
- Owners can preview and clear abandoned print preparations after a seven-day post-expiry grace
  period. All order-linked copies are retained; deletion tombstones support retry after interruption.
  This is manual maintenance, not a scheduled job.
- Flare and Sunburst are the active image-model choices. Legacy Image 2 settings migrate to Flare
  while retaining owner budgets and historical artwork. remove.bg calls and setup controls are
  retired; uploads retain the original and generated transparent output is validated.
- Redacted image-token usage now reconciles provisional AI spend transactionally. Missing/uncertain
  usage retains its reservation. Estimates are not provider invoice totals or a hard billing cap.

### Independent adoption

- The environment template leaves DATABASE_URL empty so a local fixture demo does not attempt a
  database connection simply because the template was copied.
- Added getting-started, support, upgrade/recovery, V1 scope, and demo-portfolio guidance.
- CI includes a clean dependency-install rehearsal of an admin-published merchant profile.
- CI now runs isolated PostgreSQL checks for installation settings, merchant profiles, and collection
  drafts and artwork metadata, including persistence across processes, stale edits, catalog drift,
  private-file recovery, and audit rollback. Its separate database server avoids cluster-wide role
  collisions with the owner-isolation migration.

### Existing source capabilities

The current foundation also includes private artwork upload, reference-based creation, print
preparation, product preview, quantities/cart, guarded Stripe Checkout, draft-only Printful
fulfillment, and durable customer-email/order access. See README and the architecture docs for
their individual capability and deployment boundaries. This entry does not assign them a newly
published version or claim a real order lifecycle has been independently observed for each fork.
