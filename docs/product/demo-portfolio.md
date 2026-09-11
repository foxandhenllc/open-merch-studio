# Demo portfolio after V1

September 10, 2026. Scenario specifications for future example repositories; the repositories,
deployments, integrations, and human setup results described here have not yet been created.

The base V1 has a finite [release contract](../launch/v1-release-contract.md). Each subsequent example
should be an independently runnable fork of the released foundation, with its own identity, safe
fixtures, and one unmistakable owner benefit. Four color variants of the same demo are insufficient.

After V1, start each fork as a separate client-style project: write the persona's brief, select the
appropriate service scope, map their actual inputs and operating responsibilities, implement the
necessary custom workflow, and verify handoff. The persona is the client for that project, not a
new feature checklist imposed on the base. Use admin configuration for routine differences and
reserve application development for the scoped extension.

## Distinct stories

| Persona | Starting material | Primary benefit | Demonstrable result | Boundary or extension |
| --- | --- | --- | --- | --- |
| Streamer | Their own emotes, approved clip stills, and community phrases | Turn recognizable community moments into controlled merch | An owner selects a still/emote, creates an approved mug or sticker, and allows a bounded fan variant | Begin with manual upload. Twitch/YouTube connection and scheduled ingestion are example-specific extensions. A generated variant must be labeled separately from an unchanged emote. |
| Working artist | Finished artwork supplied by the artist | Preserve the work and publish a small event collection quickly | Upload, crop/placement preview, approve poster/sticker products, publish a collection with a link to the artist's existing membership site | No generative changes by default. QR artwork must be deterministic and verified. Publishing quickly does not mean physical goods are manufactured at the event; order samples/stock in advance or accept shipped orders. |
| Community coffee shop | Photographs submitted by customers | Turn community participation into an owner-curated monthly feature | Private intake, owner selection, a poster, a sticker, and a credited monthly collection | Requires a private submission/review extension, permission/credit record, and deletion path. Packaging-label size, material, adhesive, quantity, and cost need a supplier check and sample. |
| Specialty local business | Existing brand assets and a small approved collection | Assemble the pipeline without application development | A fresh owner follows setup, verifies accounts, publishes, and operates a reviewed order | This is the timed independent-setup proof. Show actual setup/verification waits and required assistance. Routine automation retains owner review and exception work. |

## Give generation its own clear moment

Three of the proposed personas naturally favor upload. Do not force an artist's original work or a
community photograph through AI simply to demonstrate generation. Give the streamer two explicit
actions: use this emote unchanged, or create a new community-themed design. An optional generated
monthly mascot/design can also fit the specialty-business example if the owner wants it.

Start a generated design from a prompt when demonstrating Generate new. Use a source image only
when explicitly demonstrating Reference or Edit. The UI, caption, and saved provenance must agree.
Any future programmatic integration creates a private draft that an owner reviews; it never publishes
or orders automatically. Define scoped authentication, idempotency, spending limits, queued jobs,
status, and audit contracts in that example before exposing an API integration.

## Example repository contract

Use proposed names such as `oms-example-streamer`, `oms-example-artist`,
`oms-example-coffee-community`, and `oms-example-local-business` only when the repositories are
actually created. These names are planning labels, not existing GitHub destinations.

Each example must include:

- The upstream tag and commit, a link to OMS, and a concise inventory of changes from the base.
- Brand assets and content fixtures that can be publicly redistributed, with provenance/license notes.
- One configured collection and a persona-appropriate starting route and landing page.
- Provider-free local use and visibly labeled simulated commerce on a hosted demo.
- The same upstream smoke checks plus tests for its added workflow, ownership, and failure states.
- A setup walkthrough, precise account requirements, limitations, and maintenance instructions.
- A scenario proof receipt recording source version, viewport, action/result, and what remains simulated.

Keep merchant configuration and scenario fixtures apart from reusable application code. Use stable
seams for extensions; avoid copying the large studio or order services into each example. Cross-cutting
fixes return upstream with a regression test, then examples deliberately update their pinned baseline.
Each live merchant gets isolated accounts, data, and launch authorization. Shared billing for public
fixtures must not become shared real-merchant credentials or order data.

## Workflow and art direction

**Streamer:** energetic, recognizable emote artwork and a focused collection. The hero moment is
the same approved community asset on a product, followed by a clearly labeled generated alternative.
Use original or rights-cleared stream footage; the example does not demonstrate downloading any
arbitrary channel's media. A game visible in a still may have separate merchandise permissions.

**Artist:** an editorial gallery with generous space, faithful color/texture, and a compact event
collection. Show the unchanged original beside its print preview. The membership link stays on the
artist's existing destination; do not add native subscription billing to the base for this demo.

**Coffee shop:** warm documentary photography, legible contributor credit, and an owner selection
moment. Show private intake separately from published winners. Physical poster and packaging photos
require actual samples; a digital mockup cannot prove paper, adhesive, print color, or bulk economics.

**Specialty business:** credible local identity and a short, understandable setup path. A bike shop,
climbing gym, record shop, or similar fictional fixture can demonstrate the shape before a real
business agrees to be featured. Do not invent a testimonial, sales result, or saved-time number.

## Four advertising purposes

1. **Upload:** the artist keeps their work intact and gains a physical collection.
2. **Generate:** the streamer makes a new community-specific design from an explicit prompt.
3. **Built/managed for you:** show Fox & Hen configuring an installation, the delivered storefront,
   and the named maintenance/owner tasks. Link the agency offering only from the demo marketing
   layer; ordinary merchant shopping pages should not default to agency lead generation.
4. **Quick setup:** show a real fresh-owner attempt in the local-business demo with elapsed time,
   wait periods, and any assistance stated. Avoid a numerical speed claim until measured.

The coffee story adds a fifth purpose: recurring community participation. It can support the
custom-workflow service while the other examples explain the core upload and generation benefits.

Each capture shows one input, one consequential action, and one result. Compose separately for
square, portrait, and vertical placements; inspect readable text at phone size with audio off.
Preserve fixture, draft, awaiting-deployment, and manual-review states. A progress bar alone does
not establish that a provider action or shipment completed.

## Sequence and proof

First run the Fox & Hen installation as the founder-operated pilot. After V1 gates pass, build the
artist fork as the smallest distinct upload example, then the streamer, coffee, and independent
local-business examples. The final setup study validates the speed story. Earlier forks can inform
it; they do not substitute for an independent owner.

Promote an example only after its core story works on phone and desktop, its exact request/state
changes are verified, and a new viewer can say what the software helps them build. Keep fixture
evidence, an authorized real sample/order lifecycle, and outside-owner adoption as separate facts.
