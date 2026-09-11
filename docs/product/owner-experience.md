# The owner experience

Product direction agreed September 10, 2026. This brief guides implementation; planned acceptance
criteria below are not claims that self-service installation or independent-owner adoption is complete.

## Who the product serves

The first audience is creators and community brands with an existing following, usable brand assets,
and a merch concept. They want a store and creation workflow that fit their community. Developers
and agencies are also users of the reusable foundation and contributors to it.

The accepted starting experience is a focused approved collection with controlled personalization.
The [V1 release contract](../launch/v1-release-contract.md) defines when to stop expanding the base;
the [demo portfolio](./demo-portfolio.md) defines the distinct forks that follow it.

The merchant chooses and operates the platform. The merch shopper uses the resulting storefront.
Both experiences must work well, and they answer different questions:

| Surface | User's question | Useful proof |
| --- | --- | --- |
| Product introduction and repository | Can this become my store, and can I run it? | A distinct example, fixture quickstart, setup requirements, ownership and maintenance documentation |
| Installation and admin | What do I need to do, and what happens when I save? | Brand preview, connection verification, explicit draft and active states, recovery paths |
| Merchant storefront | Can I make or choose something I want and buy it confidently? | Artwork, product previews, clear price, delivery expectations, accessible checkout and support |

A new builder introduction should have its own entry point. Merchant storefronts keep their own
shopping purpose; installation-specific pages must not become agency lead-generation pages by default.

## Product promise and present boundary

The target is a branded merch workflow owners can configure and operate, with an open-source core
they can inspect and extend. The supported reference stack currently uses Printful, Stripe,
PostgreSQL/private storage, optional OpenAI, and optional transactional email. Initial hosting,
storage, domains, administrator access, and provider verification still need technical setup.

The existing admin supports selected profile fields, policies, AI model/budgets, and write-only
provider settings through the configured hosting bridge. Logo upload, domain onboarding, actual
product/margin editing, verified account connections, and fully guided installation are future work.
One installation is one merchant. A settings form does not establish account ownership or prove
successful payment, fulfillment, email delivery, or deployment.

Fox & Hen's service direction is a defined store build and supervised launch, with optional ongoing
care. Self-directed users retain a useful documented route. Service scope and support commitments
must be agreed separately; the public repository is not a support SLA.

## UI priorities

The visual thesis is a calm, capable owner workspace that gives the merchant's identity and products
room to stand out. Existing typography, restrained color, and clear field labels remain the base.

The content sequence is brand preview, connected accounts, optional artwork controls, and launch
readiness. After setup, the overview should prioritize actual operating work: orders requiring
review, connection problems, and spending exceptions. Do not fabricate activity or completion.

Interactions should explain consequences: immediate draft preview, a clear saved revision, and
observable publication status. Short transitions can orient a user between editing and preview;
reduced-motion users must receive the same information without animation.

- Let an owner see their brand early. The current identity preview is a start; a future preview
  should show a real configured product and its storefront context as logo/catalog controls land.
- Use provider names and tasks such as Connect payments in routine flows. Keep API field names and
  advanced deployment details where the person configuring the connection needs them.
- Distinguish missing, saved, verified, awaiting deployment, active, and failed states using
  persisted evidence. Supply a specific next action for each recoverable failure.
- Make publishing consequences readable on phone and desktop. Retain private drafts and explicit
  approval; a visually polished toggle must not imply a successful deployment.
- Keep existing-artwork use prominent. AI is an optional capability with owner spending controls.
- Apply consistent focus, keyboard, contrast, and touch-target behavior across example identities.

## Demonstration quality

Screenshots should make an owner think: I can picture my brand here, and I understand how to run it.
Show one action and one result per frame: editing identity beside its preview, a saved artwork choice,
or a configured product in the storefront. Key-entry forms and implementation diagrams belong in
setup documentation. They are secondary proof for developer audiences.

Use actual tested UI and approved artwork. Fixture status must remain legible; accelerated recordings
must disclose elapsed deployment time. A concept mockup cannot be represented as shipped functionality.
Compose captures for square, portrait, and vertical crops, with readable labels and captions without
sound. These are presentation targets, not guarantees of individual advertising-platform acceptance.

## Evidence required before calling the owner product ready

1. An independent owner follows documented setup with their own accounts. Record time, stalls,
   required assistance, and whether they can recover a failed connection without source changes.
2. Two distinct installations prove separate identity, accounts, customer data, and merchant policies.
   A fixture profile proves configuration behavior; it is not evidence of a launched second business.
3. The owner changes and publishes branding, chooses an artwork model, and understands costs and
   draft-versus-active state on phone and desktop.
4. A separately authorized order rehearsal covers payment, review, fulfillment, customer support,
   and delivery evidence. Provider-free tests remain the default automated proof.
5. A maintained upgrade procedure preserves owner settings; backup/restore and connection rotation
   have a demonstrated recovery path. Configuration portability alone does not establish data export.
6. A public release explains supported versions, limitations, costs, contribution paths, and where
   community help ends. Claims link to reproducible proof for the release being shown.

Implement against the [owner roadmap](../roadmap/store-owner-product.md),
[profile contract](../architecture/admin-merchant-profile.md), and
[deployment guide](../../DEPLOYMENT.md).
