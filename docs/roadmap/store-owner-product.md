# A store product that owners can configure

The current stopping point is the [V1.0.0 release contract](../launch/v1-release-contract.md).
The milestones below implement that contract; later [persona demos](../product/demo-portfolio.md)
belong in separate repositories pinned to the release.

The product is a merch store an owner can install, connect, and operate. The
repository is its reusable foundation. Normal store operations should not require
React, TypeScript, provider-API knowledge, or custom development.

The first audience is creators and community brands with an existing following. The
[owner experience brief](../product/owner-experience.md) distinguishes the person choosing and
running the platform from the shopper using their storefront. Every milestone should demonstrate
an owner outcome, a recovery path, and a truthful, readable preview of the result.

One installation represents one merchant. Fox & Hen can maintain its own fork;
FanHarmon, Ryucharts, and RCR can each have a separate brand, deployment, database,
provider accounts, and launch decision. They must not inherit another store's
credentials, customer data, or payment identity. Shared upstream improvements
belong in the product; project-specific content belongs in each installation.

## Working first milestone

- A protected `/admin` surface with a setup overview and installation guide.
- Image 2 / Image 2.5 Flare / Image 2.5 Sunburst selection without source edits.
- Persistent AI budgets and a new-visitor draft allowance.
- Provider credential forms, deployment storage, and an explicit redeploy action.
- A visual store-profile editor with private drafts, live identity preview,
  brand/contact/order/email fields, and all five policy/support pages.
- Explicit policy approval tied to a saved revision and publication through one
  shared build profile for browser, server, checkout, email, and static metadata.
- Existing customer artwork, commerce authorization, and fulfillment review
  boundaries preserved.
- Private installation collection drafts, product/variant/print-area configuration, planned prices
  and artwork modes, preview/reorder/removal, and contextual event/community/drop guidance.
  See [collection drafts](../architecture/admin-collection-drafts.md). Active customer customization
  enforcement and collection checkout are still separate gates.
- A private owner artwork library with unchanged originals, prepared images and private previews,
  rights confirmation, per-print-area attachment, reuse, and guarded removal. See
  [private artwork](../architecture/admin-collection-artwork.md).
- Intended print-size review and explicit owner checks, followed by versioned public collection
  previews, replacement, and withdrawal. See [publication](../architecture/admin-collection-publication.md).
  Production placement and purchasable, approved configurations remain release gates.

See [the admin contract](../architecture/store-admin-control-plane.md) for implementation and limits.
This milestone is key-based connection management, not OAuth or fully automated
installation. Hosting and database bootstrap remain one-time installation steps.

## Next product milestones

1. **Guided installation.** A maintained deployment template that provisions or
   connects the owner's database, runs migrations, creates private buckets,
   establishes admin identity, and validates URLs. Setup steps must show durable
   completion and recovery rather than leaving a terminal checklist to the owner.
2. **Complete store customization.** The brand/contact/policy editor is implemented;
   add logo and share-image upload, domain onboarding, and actual product/margin
   controls with their coordinated validation. Keep one validated public profile
   and explicit approval of merchant-specific policy prose. See
   [profile publication](../architecture/admin-merchant-profile.md).
3. **Account authorization.** Prefer provider-owned authorization where available;
   keep scoped write-only key entry for providers that need it. Show account
   verification, webhook setup, sender verification, expired credentials, and
   reconnect flows without exposing credentials or implying commerce activation.
4. **Store and collection editing.** Add the already-designed ownership constraints,
   private revisions, and publication snapshots before enabling shared mini-store
   owner writes. An installation administrator and a collection owner are different
   roles. Maintain those boundaries even if their UI shares components.
5. **Launch and maintenance.** Guide the owner through test-mode payment, catalog
   and mockup verification, review-first fulfillment, and explicit live launch.
   Make subsequent upstream upgrades and credential rotation manageable without
   editing application code or merging merchant content into product code.

The acceptance test for the larger product is a new, nontechnical owner setting
up a distinct store with their own accounts, recovering a failed connection,
changing a model, publishing approved branding, and operating an order without
source-code changes. Do not advertise that complete experience until it is
observed end to end.
