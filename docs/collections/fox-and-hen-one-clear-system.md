# Fox & Hen — One Clear System

Collection 001 is a five-product proof built entirely from Open Merch Studio's current catalog. It
uses the approved Fox & Hen website and social marks to demonstrate supplied artwork, print-file
preparation, and distinct front/back placements without introducing a new merchandise category.

## Production recipe

| Product | OMS product / Printful variant | Placements | Production files | Provider cost | Suggested retail | Live proof |
| --- | --- | --- | --- | ---: | ---: | --- |
| Workbench Tee | `df8b8554-c205-4f83-ae08-495bc54711de` / `4017` | Front + back DTG | `workbench-tee-front.png`, `workbench-tee-back.png` | $17.64 | $38 | `gt-963890671` |
| Studio Notes Tote | `7a1c0013-0655-4cc9-af8b-e26fa78acbc4` / `10458` | Front + back DTG | `studio-notes-tote-front.png`, `studio-notes-tote-back.png` | $21.51 | $42 | `gt-963890745` |
| Connected Systems Mug | `052e3ae7-4027-4367-93d7-42cd4373a341` / `1320` | Wraparound sublimation | `connected-systems-mug-wrap.png` | $5.95 | $24 | `gt-963890810` |
| System Map Poster | `88792ee3-f35b-4aa8-9fb8-c401863f65c6` / `3876` | Single full-color print | `system-map-poster.png` | $11.39 | $30 | `gt-963890869` |
| Studio Mark Sticker | `b4a367e8-e61c-494c-9aa8-609b258b6da4` / `10163` | Single kiss-cut print | `studio-mark-sticker.png` | $2.29 | $8 | `gt-963890915` |

The tee and tote each include Printful's current $5.95 second-placement charge. Suggested retail is
planning guidance, not a published offer. Shipping, tax, Stripe fees, refunds, and final margin must
be reviewed when products are published.

## Reusable asset IDs

| Product | Placement | Design asset ID |
| --- | --- | --- |
| Workbench Tee | Front | `9426dc08-1ff3-4734-be93-f541962e739a` |
| Workbench Tee | Back | `f24c4743-45d8-4893-b77f-e5a7a858895b` |
| Studio Notes Tote | Front | `77677138-3af0-4373-b93b-12d27712c204` |
| Studio Notes Tote | Back | `5e3ac67d-3965-4600-9709-9b02b563cbf1` |
| Connected Systems Mug | Default | `f002e53d-549d-4019-89e3-f65ca2814220` |
| System Map Poster | Default | `cbd93fc0-4288-4c85-adf5-da5d01434042` |
| Studio Mark Sticker | Default | `9db155ca-8246-4ea1-a0b5-e4cd88b7a332` |

The production files live under `frontend/public/examples/fox-and-hen/print-files/`; the provider
proofs live under `frontend/public/examples/fox-and-hen/mockups/`.

## Printful template and store boundary

Printful product templates retain the selected product, variants, artwork, and placements. They do
not retain the eventual store description or retail price; those are entered when the template is
published to a store. Printful's API can list and duplicate an existing product template but cannot
create the first template from artwork, so each of these five recipes must be saved once in the
signed-in Design Maker.

Publishing the collection to a Printful Quick Store is a separate step. Complete the five templates
first, then choose variants, product copy, retail prices, and mockups at publication. Payout
onboarding may require the account owner to enter banking or tax information and accept legal
attestations; those steps must be completed by the account owner.
