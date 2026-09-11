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
  published references protect library files from removal. These pages do not accept orders yet.
- Published collections now include a protected sales-readiness check for source/catalog drift and
  missing owner prices. It checks the published snapshot independently of private edits, rejects
  stale versions, and distinguishes owner actions from the remaining production and checkout work.
- Manual print-template layouts for published artwork, with per-area dimensions and offsets,
  revisioned saves, private canvas previews, and transparent 300-PPI PNG export. Server checks reject
  clipping, oversized canvases, stale layouts, and mismatched original bytes. Original files stay
  unchanged; layouts survive restart and are discarded when the collection is replaced or withdrawn.
  Automatic provider-template lookup and connecting prepared files to orders remain unfinished.
- New installation defaults use Image 2.5 Flare. Existing configured model selections are preserved;
  legacy Image 2 removal is a remaining V1 migration gate.

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
