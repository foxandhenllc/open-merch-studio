# V1.0.0 release contract

Agreed product direction: September 10, 2026. **Target scope; not released and not all implemented.**
This contract supersedes earlier 0.1/0.2 milestone framing without marking historical tickets complete.

## Stopping point

V1 is a reusable, single-merchant merch store: an owner installs one supported stack, presents an
approved collection, enables only the personalization they want, connects their own accounts, and
operates review-first orders. Routine configuration and operation require no application-code edits.

After these gates pass, freeze general feature expansion and build the persona examples in separate
repositories based on the exact release. The base continues receiving security, compatibility, and
defect fixes. A scenario-specific feature belongs in an example until its reusable contract is clear.

## Finite release gates

| Gate | Local source evidence | What must pass for V1 |
| --- | --- | --- |
| V1-01: Independent evaluation | Fixture/customer tests and isolated merchant-profile builds exist. Environment template now leaves the database empty; support and quickstart docs added. | A fresh release checkout follows the documented commands without private credentials; public proof uses that release's exact commit. |
| V1-02: One supported installation | Deployment and admin guides exist; bootstrap still requires technical setup. | A guided Vercel/PostgreSQL/private-storage path establishes one admin identity, domains, migration status, and connection checks with resumable progress and recovery. Provider signup/billing/verification stays with the owner. |
| V1-03: Make the store theirs | Brand/contact/colors/policies/order/email labels and reviewed publication are implemented. | Add logo/share-image handling and domain guidance; verify storefront, metadata, policies, checkout, and email agree after publication. No inherited merchant identity or data. |
| V1-04: Approved collection | Private drafts and original-artwork bindings now support intended print-size review, explicit versioned public previews, replacement, and withdrawal. Published originals stay pinned. Admin sales checks inspect the published source/catalog and prices independently of later drafts. Manual print-template layouts now support saved offsets, canvas review, and private PNG exports. Owner-approved ordering now creates durable owner-priced quotes and private verified print copies, reuses one order on checkout retries, and connects to the existing checkout/draft-fulfillment path. Fixture and fresh-process database evidence cover recovery. Physical samples, live commerce evidence, abandoned-copy cleanup, and automatic template binding remain incomplete. | A single-installation admin creates, previews, publishes, updates, and withdraws an approved collection with product/placement/price controls. A customer buys that published product under this installation's commerce settings. Stale/unpublished configurations fail safely. |
| V1-05: Controlled personalization | Upload, generation, reference, and editing paths exist. Per-collection allowed actions are not implemented. | Owner chooses fixed artwork or an allowed customization mode from the existing paths; the server enforces it. Preserve original artwork and bind a submitted design to the configured product. Broader template editors are outside V1. |
| V1-06: Two-model AI and costs | Flare/Sunburst selection and native-alpha checks exist. New defaults use Flare. Reservations are provisional, and legacy Image 2 remains. | Migrate existing saved/env settings, remove legacy Image 2 and remove.bg dependency/controls, retain imported files, record redacted token usage, reconcile cost estimates, and prove budget/failure behavior without silently charging a different provider. |
| V1-07: Operate and recover orders | Durable checkout/webhooks, draft fulfillment, email and customer order access exist. | Give the installation owner a clear review/exception workflow and named support responsibilities. Separately authorize and observe a real sample/order lifecycle. Preserve idempotency and manual production confirmation. |
| V1-08: Adopt and maintain | CI and isolated profile rehearsals exist. Support/upgrade guidance is now documented. | Prove a distinct installation, an upgrade preserving owner settings, and isolated database plus private-artwork recovery. Observe a nontechnical owner performing setup, publication, and recovery; record actual assistance and elapsed time. |

Each gate needs a source commit, execution date, fixture/live designation, result, and remaining
limitations. Passing a unit test, a hosted 200, or a request to deploy does not replace the gate's
owner-visible result. Package versions remain unchanged until the release gates and release review pass.

## Supported boundaries

- One merchant and one installation-admin authority. Public multi-tenant owner access is separate.
- Existing curated product types, one supported provider stack, and the current US/USD commerce path.
- An approved collection is the default shopping entry. Personalization is opt-in and bounded by
  owner-selected modes. The freeform workbench remains useful as a tool, not every storefront's hero.
- Upload keeps the original artwork. Generation creates a new asset. Reference-based generation and
  editing are distinct, explicit actions. No silent generative alteration of artist submissions.
- Image 2.5 Flare and Sunburst only for the V1 target. The runtime still includes legacy compatibility
  until V1-06 is implemented; pricing and new demo designs exclude it.
- A paid order enters editable Printful draft review. No automatic production confirmation.
- Provider prices, identity verification, domains, policy approval, and billing account ownership
  remain real setup requirements, even when their completion is guided from admin.

## Keep outside the base V1

Twitch/YouTube ingestion and OAuth, scheduled clip scanning, community competitions and voting,
native memberships, digital subscription billing, POS or same-day manufacturing, roll-label production,
arbitrary printer support, arbitrary workflow builders, general-purpose public API keys, and a
hosted multi-merchant service. These can be scoped demo extensions after the core release.

Each example then becomes its own client-style project, with a brief, bounded build scope,
personalized installation, and verified handoff. Treat the persona's workflow as that project's
requirement; promote only demonstrated reusable improvements back into the base.

The artist example can link to an existing membership site. The streamer can start from a
rights-cleared local still or emote; automatic ingestion is optional follow-on work. The coffee
example needs its own private submission/review extension. This prevents four demos becoming four
new mandatory platforms before V1 can stop.

## Release procedure

1. Close V1-01 through V1-08 with linked receipts and explicit remaining limitations.
2. Run the documented lint, type, unit, fixture, database, build, browser, dependency, and isolated
   installation checks. Review source/asset licenses, public-safe fixtures, and secret hygiene.
3. Finalize release notes, supported configuration/schema versions, migration/recovery instructions,
   and contribution/support routes. Record the exact release authority and candidate commit.
4. Review the candidate for release; only then update workspace versions, tag, and publish V1.0.0.
5. Create separately branded example repositories pinned to that tag. Give each its own safe demo
   environment, upstream provenance, scenario-specific README, and honest capability labels.

## Freeze rule

Add work before V1 only if it closes a gate, fixes a defect, or maintains security/provider
compatibility. A new vertical idea alone does not expand the release. Reopen scope explicitly if a
gate needs a different approach. No calendar promise replaces the acceptance evidence.
