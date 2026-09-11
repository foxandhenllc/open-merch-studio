# Independent-adoption audit

September 10, 2026. Readiness of the working checkout, not an assertion about a published release
or independent customer adoption. No live provider, customer order, or infrastructure mutation was used.

## Finding

The code is useful for provider-free evaluation and has tested owner configuration seams. A
nontechnical person cannot yet complete a live installation and operate the full approved-collection
workflow through admin alone. V1 must close the eight gates in the
[release contract](./v1-release-contract.md) before promoting that experience.

## Repairs made in this audit

| Finding | Repair | Evidence |
| --- | --- | --- |
| The copied environment template supplied a database URL even for a fixture demo. | Leave DATABASE_URL empty, explain durable storage separately. | Clean profile rehearsal now copies the actual template into both workspaces and runs doctor before build. |
| New installs still defaulted to the legacy image model. | Default new environment/runtime configurations to Flare; retain explicit existing selections for a deliberate migration. | Existing model request/alpha checks plus the normal tests and clean build pass. |
| Repository support and version status were difficult to find. | Added SUPPORT.md, CHANGELOG.md, ROADMAP.md, a fresh-start guide, and a PR template. | Relative document links checked; source package version remains 0.1.0 and V1 is clearly a target. |
| Owner-profile deployment verification was available locally but absent from CI. | Add the clean admin-profile rehearsal to CI. | The command passes locally after a clean dependency install; the updated GitHub workflow has not run remotely in this task. |
| Fork maintenance and release scope lacked a concise starting point. | Added an upgrade/recovery checklist and a finite V1 feature boundary. | These are documented procedures; an actual upgrade/restore rehearsal remains open. |

## Remaining blockers and limitations

| Area | Status | Needed proof |
| --- | --- | --- |
| Fresh fixture checkout | Automated rehearsal passes; all required source must be included in the release. | Re-run from the final tagged source. Untracked working files are not a GitHub release. |
| Initial live setup | Technical bootstrap and provider dashboards remain necessary. | Guided/resumable setup and a timed independent-owner attempt. |
| Owner identity | Installation admin uses a configured access code; organization-owner mutations remain closed. | Document and test the single-admin access/recovery model; do not imply multi-user permissions are available. |
| Connections | Credential save/pending deployment exists. | Verify account identity, webhook/sender readiness, expired/revoked credentials, and recovery separately. |
| Collection commerce | Read-only mini-stores and saved-product foundations exist. | Single-installation admin publication and purchasable snapshots under that merchant's authorization. |
| Controlled personalization | The broad creation paths work. | Persist owner-selected allowed modes and enforce them server-side. |
| Model spending | Reservations are provisional. | Redacted usage accounting and model-specific calibration; legacy migration and retirement. |
| Data portability | Source/config profiles are portable. | Documented data/artwork export and a matching restore rehearsal; no one-click export claim. |
| Order operations | Durable backend and customer flow exist. | Complete owner review/exception experience and an authorized physical sample/order lifecycle. |
| External adoption | Founder/agent testing is available. | Independent owners using the chosen tasks; publish only consented, observed results. |

## Verification receipt

Node 22.12.0 / npm 10.9.2: lint, type-check, unit/contract tests, build, customer/browser suites,
and `config:rehearse-admin` passed in this checkout. The normal unit run includes 117 backend tests
(110 passed, seven optional database cases skipped) and 17 configuration/policy tests, plus frontend
contracts. The browser suite checks eleven customer viewports and admin at desktop/phone sizes,
including model selection, provider payloads, profile save/readback/publication, and recovery.

The clean rehearsal installs dependencies, loads the copied template, checks doctor, builds a
synthetic Harbor Community Merch profile, verifies compiled server/email/config identity, and checks
phone/desktop policy and checkout behavior. It is configuration proof, not a timed human install or
live merchant deployment. Database recovery, live sample/order evidence, and remote CI were not
repeated by this audit. Do not fold those separate gates into an all-ready claim.

## Next bounded implementation

Start with the single-installation collection editor and publication/checkout contract, then
owner-selected personalization modes. These close the largest gap between today's workbench and
the accepted collection-first product. Advance guided setup/account verification alongside that
work, then finish upgrade/recovery and owner acceptance evidence. Scenario-specific integrations
remain in the later demo repositories.
