# Image 2.5 upgrade and usage accounting

Local V1-06 implementation, September 12, 2026. No live image request or provider-account change is
required to perform the fixture/database verification described here.

## Owner experience

Store admin offers **GPT Image 2.5 Flare** and **GPT Image 2.5 Sunburst** for new generation, reference
work, and edits. Flare remains the everyday default. A saved selection takes effect without a
redeploy. Existing files and imported artwork remain intact. These choices and their transparent PNG
support were checked against the official [Flare](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare),
[Sunburst](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst), and
[image generation](https://developers.openai.com/api/docs/guides/image-generation) documentation.

An old `gpt-image-2` environment alias or dated snapshot resolves to Flare. A saved Image 2 setting
is migrated to Flare in a database transaction, increments the settings revision, preserves budgets
and allowances, and writes one redacted migration audit. A failure to store that audit rolls back the
change. Other unknown models do not silently select a paid provider; the owner must choose a
supported model before generation. Reviewed 2.5 snapshots remain supported in environment settings.

The remove.bg setup connection, environment inputs and outbound calls are retired. Existing
`REMOVE_BG_*` deployment values are ignored by the runtime and may be removed by the owner.
Requests for the retired upload-removal option fail explicitly before upload completion. Ordinary
upload keeps its original background and never silently regenerates an artist's work. Native
transparency is verified from decoded PNG pixels, not assumed from the selected model or an alpha
channel alone. Opaque/invalid generated output needs another attempt or a prepared transparent PNG.

Merchant-approved policy prose is not rewritten automatically. A merchant whose processor list
mentions remove.bg should review that disclosure through the existing policy approval/publication
workflow before publishing a revised policy.

## Costs and failure recovery

Both models currently share token rates, but may consume different numbers of tokens for the same
request. The runtime's initial reservations remain $0.50 for a draft/revision and $1.00 for a final.
Those are provisional budget reservations, not promised per-image prices or a provider billing cap.
See the [official cost guidance](https://developers.openai.com/api/docs/guides/image-generation#gpt-image-25-costs).

Successful Image API responses are reduced to validated text-input, image-input, image-output, and
total token counts. No prompt, image bytes, private URL, provider credential, or raw response is stored
in the usage receipt. The estimate uses the reviewed uncached token rates and rounds up to cents.
Cache discounts are not inferred when the response lacks the necessary breakdown; the result is a
conservative token-based estimate, not an invoice reconciliation.

The receipt and corrected spend amount commit together under the same database advisory lock as
spend reservation/release. Repeating the same receipt is idempotent; conflicting receipts fail.
Recorded provider usage cannot then be released as an unstarted request. Missing or invalid usage
keeps the provisional reservation, as does failed receipt persistence. Actual usage above the
reservation remains counted and can block later requests; it cannot retroactively prevent incurred
provider cost.

Moderation/preflight failures known to occur before sending an image request release the reservation.
An image request with an uncertain outcome retains its reservation. A returned image that cannot be
stored safely also retains counted spend. Inspect provider billing before deciding whether uncertain
spend should be adjusted. There is no automatic cross-provider fallback or background-removal fee.

## Verification

Fixture tests inspect both models' generation/reference/edit payloads, transparent pixel checks,
redacted usage parsing, invalid/missing usage, legacy model rejection/mapping, and the distinction
between an unstarted request and a provider error. The isolated PostgreSQL integration test verifies
migration across processes, preserves owner budgets, rolls back usage correction on audit failure,
retries it after recovery, and prevents a recorded request from being released twice. CI includes
this test in the installation-admin database gate. Existing allowance, checkout, upload and browser
contracts remain required before release.

Live account access, real prompt/image quality, measured latency, and observed invoice costs still
need a deliberately authorized evaluation. Do not market fixture receipts as proof of those outcomes.

Completed local checks (2026-09-12): lint, TypeScript, 123 passing backend tests (11 database-only
skips in the ordinary run), 17 root tests, frontend fixture/selector contracts, and production build.
All six isolated installation/artwork/purchase/model database tests passed without skips, including
migration-audit rollback. The full responsive and policy suites and admin/purchase browser contracts
passed, including both 1440px and 390px admin model selection and persistence. Independent-build
rehearsals passed for Harbor Community Merch and Community Gear Lab. The production audit checked
152 package versions: one applicable advisory, none high/critical/unclassified.
