# Roadmap

The next product release target is **V1.0.0: one merchant, one configurable store, an approved
collection, and controlled personalization**. This is a target, not the current release status.

The [V1 release contract](./docs/launch/v1-release-contract.md) defines the finite acceptance gates.
The [owner roadmap](./docs/roadmap/store-owner-product.md) carries implementation context. Historical
0.1/0.2 tickets remain useful execution notes; the V1 contract is the current scope boundary.

## Finish the reusable store

- Complete brand, logo, collection, product, margin, and personalization controls in admin.
- Guide one supported installation path, verify account connections, and explain recovery.
- Standardize on Image 2.5 Flare and Sunburst, with usage-based cost evidence and a documented
  transition away from the legacy Image 2/background-removal path.
- Give owners an understandable review-first order workflow.
- Demonstrate a second installation, an upgrade, a restore, and a nontechnical owner handoff.

## Build examples from the stable release

After V1, separate demo repositories will show an artist, streamer, coffee community, and specialty
local business. Each will pin the upstream release and prove a distinct workflow. Shared fixes can
return upstream; the base will not accumulate every campaign, social integration, or membership tool.
See the [demo portfolio](./docs/product/demo-portfolio.md).

## Maintain the foundation

Security fixes, provider compatibility, reproducibility, and defects continue after the V1 feature
freeze. A new general capability needs a documented reuse case and explicit scope decision.
Multi-tenant hosted commerce, native membership billing, a general automation builder, POS, and
automatic Printful production confirmation are outside the V1 target.
