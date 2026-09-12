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
| V1-02: One supported installation | Persona-guided resumable setup and read-only migration/private-storage checks are implemented. Cloud bootstrap/account signup still needs the owner or installer. | A guided Vercel/PostgreSQL/private-storage path establishes one admin identity, domains, migration status, and connection checks with resumable progress and recovery. Provider signup/billing/verification stays with the owner. |
| V1-03: Make the store theirs | Brand/contact/colors/policies/order/email labels and reviewed publication are implemented. | Logo/share-image preparation and domain guidance are implemented; verify storefront, metadata, policies, checkout, and email agree after publication. No inherited merchant identity or data. |
| V1-04: Approved collection | Private drafts and original-artwork bindings now support intended print-size review, explicit versioned public previews, replacement, and withdrawal. Published originals stay pinned. Admin sales checks inspect the published source/catalog and prices independently of later drafts. Manual print-template layouts now support saved offsets, canvas review, and private PNG exports. Owner-approved ordering now creates durable owner-priced quotes and private verified print copies, reuses one order on checkout retries, and connects to the existing checkout/draft-fulfillment path. Fixture and fresh-process database evidence cover recovery. Owner-invoked abandoned-copy cleanup now preserves all order references and recovers interrupted deletion. Physical samples, live commerce evidence, and automatic template binding remain incomplete. | A single-installation admin creates, previews, publishes, updates, and withdraws an approved collection with product/placement/price controls. A customer buys that published product under this installation's commerce settings. Stale/unpublished configurations fail safely. |
| V1-05: Controlled personalization | Fixed/upload/generate/reference choices are server-enforced per published item. Private originals, ownership checks, generation replay receipts and saved print preview approval have fixture, database and responsive browser evidence. | Owner chooses fixed artwork or an allowed customization mode from the existing paths; the server enforces it. Preserve original artwork and bind a submitted design to the configured product. Broader template editors are outside V1. |
| V1-06: Two-model AI and costs | Flare/Sunburst are the active choices. Legacy Image 2 settings migrate to Flare; remove.bg calls and controls are retired. Redacted token usage reconciles provisional spend transactionally, with restart/audit-failure coverage. Live model quality, account access, and invoice calibration remain unverified. | Migrate existing saved/env settings, remove legacy Image 2 and remove.bg dependency/controls, retain imported files, record redacted token usage, reconcile cost estimates, and prove budget/failure behavior without silently charging a different provider. |
| V1-07: Operate and recover orders | Durable checkout/webhooks, draft fulfillment, email and customer order access exist. The owner workspace now provides a private order list, saved print downloads, acknowledgment/resolution notes, and explicitly confirmed eligible draft retries. Fixture browser checks and database restart/audit-rollback tests pass locally; real sample and operator observation remain open. | Give the installation owner a clear review/exception workflow and named support responsibilities. Separately authorize and observe a real sample/order lifecycle. Preserve idempotency and manual production confirmation. |
| V1-08: Adopt and maintain | CI, isolated profile builds and a persistent local owner rehearsal exist. The rehearsal pairs database/private files, restores to a separate copy, and preserves settings, orders and artwork. Cloud recovery and independent owner observation remain open. | Prove a distinct installation, an upgrade preserving owner settings, and isolated database plus private-artwork recovery. Observe a nontechnical owner performing setup, publication, and recovery; record actual assistance and elapsed time. |

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
- Image 2.5 Flare and Sunburst only. Existing Image 2 configurations migrate to Flare; historical
  artwork files are retained. No external background-removal provider is used.
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
