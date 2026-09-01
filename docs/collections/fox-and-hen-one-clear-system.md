# Fox & Hen — One Clear System

Collection 001 is a five-product proof built entirely from Open Merch Studio's current catalog. It
demonstrates supplied artwork, reference-led creation, print-file preparation, and distinct
front/back placements without introducing a new merchandise category.

## Production recipe

| Product | OMS product / Printful variant | Placements | Production files | Provider cost | Suggested retail | Live proof |
| --- | --- | --- | --- | ---: | ---: | --- |
| Workbench Tee | `df8b8554-c205-4f83-ae08-495bc54711de` / `4017` | Front + back DTG | `workbench-tee-front.png`, `workbench-tee-back.png` | $17.64 | $38 | `gt-963874414` |
| Field Notes Tote | `7a1c0013-0655-4cc9-af8b-e26fa78acbc4` / `10458` | Front + back DTG | `field-notes-tote-front.png`, `field-notes-tote-back.png` | $21.51 | $42 | `gt-963874882` |
| Connected Systems Mug | `052e3ae7-4027-4367-93d7-42cd4373a341` / `1320` | Wraparound sublimation | `connected-systems-mug-wrap.png` | $5.95 | $24 | `gt-963875050` |
| System Map Poster | `88792ee3-f35b-4aa8-9fb8-c401863f65c6` / `3876` | Single full-color print | `system-map-poster.png` | $11.39 | $30 | `gt-963875161` |
| Ampersand Sticker | `b4a367e8-e61c-494c-9aa8-609b258b6da4` / `10163` | Single kiss-cut print | `ampersand-mark-1800.png` | $2.29 | $8 | `gt-963875249` |

The tee and tote each include Printful's current $5.95 second-placement charge. Suggested retail is
planning guidance, not a published offer. Shipping, tax, Stripe fees, refunds, and final margin must
be reviewed when products are published.

## Reusable asset IDs

| Product | Placement | Design asset ID |
| --- | --- | --- |
| Workbench Tee | Front | `9a8a71d2-40c4-4c35-8458-30eb3dfed3e9` |
| Workbench Tee | Back | `736b4bc9-0cc5-43bb-b463-7a4c84a2ae8a` |
| Field Notes Tote | Front | `6457718a-52f9-4df5-a3b1-d9e43032983a` |
| Field Notes Tote | Back | `3cb43b43-3e91-4231-bc70-02d91ab9eb54` |
| Connected Systems Mug | Default | `1985ade9-aaf6-4698-92b9-d82cacb169de` |
| System Map Poster | Default | `12243bf4-3356-4c60-bcbf-cb2088f986b2` |
| Ampersand Sticker | Default | `c6fc33c4-6404-4e6b-a534-017f3d622a27` |

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
