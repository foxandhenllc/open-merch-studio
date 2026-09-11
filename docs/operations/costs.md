# Operating-cost model: Image 2.5 stores

Prices checked September 10, 2026. USD planning estimates; provider billing, usage, taxes, and
commercial terms can change. This is not a quote or a measured invoice. Image 2 and remove.bg are
excluded from this model. The current runtime retains legacy compatibility during migration.

## Fixed infrastructure

| Component | Planning basis | Scope |
| --- | --- | --- |
| Vercel Pro | $20/month | One deploying seat and $20 included usage credit. Extra deploying seats are $20 each; overages/add-ons are separate. |
| Supabase Pro | $25/month | One Micro project covered by the included $10 compute credit, within plan allowances. Storage, egress, larger compute, and extra projects can add cost. |
| Resend Free | $0/month | 3,000 emails/month, with a 100/day limit. A drop can hit the daily limit before the monthly allowance. |
| Resend Pro | $20/month | 50,000 emails/month; $0.90 per extra 1,000. |
| Printful Free plan | $0/month | Products, placements, shipping, and applicable taxes are paid separately. No Growth discount assumed. |

Sources: [Vercel Pro](https://vercel.com/docs/plans/pro-plan),
[Supabase](https://supabase.com/pricing), [Resend](https://resend.com/pricing),
[Printful](https://www.printful.com/pricing).

The initial infrastructure subtotal is **$45/month** with free email, or **$65/month** with Resend
Pro. A second deploying seat makes those **$65/$85**. These are not total store costs. Add domain
registration, provider overages, AI, products, payments, support, maintenance, backups beyond plan
coverage, and any paid integrations. Vercel Hobby is for personal non-commercial use; do not use it
as the commercial-store cost assumption. [Vercel pricing](https://vercel.com/pricing)

## Flare and Sunburst

Both models have the same published rates per million tokens:

| Token type | Flare | Sunburst |
| --- | ---: | ---: |
| Text input | $5.00 | $5.00 |
| Cached text input | $1.25 | $1.25 |
| Image input | $8.00 | $8.00 |
| Cached image input | $2.00 | $2.00 |
| Image output | $30.00 | $30.00 |

[Flare model](https://developers.openai.com/api/docs/models/gpt-image-2.5-flare),
[Sunburst model](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst).

The official Image 2.5 calculator currently groups Sunburst and Flare together. At 1024 × 1024 it
showed 196 output tokens / **$0.00588** for low quality and 1,756 / **$0.05268** for high quality.
These are calculator estimates of output only, observed in the rendered documentation; they are
not independent measurements of either model. Inputs and retries add cost. Use response usage to
calibrate each model and workload; matching rates do not guarantee matching invoices.
[Official calculator and cost guidance](https://developers.openai.com/api/docs/guides/image-generation#cost-and-latency)

```text
request USD = (uncached text tokens × 5 + cached text tokens × 1.25
             + uncached image tokens × 8 + cached image tokens × 2
             + output image tokens × 30) / 1,000,000
```

The current OMS request uses the Image API, one PNG, 1024 × 1024, low for drafts and high for finals.
No extra Responses API mainline-model cost is included. Both models support transparent PNG output;
the app still validates the returned pixels. Unchanged artwork uploads need no image-generation call.
[Image generation guidance](https://developers.openai.com/api/docs/guides/image-generation)

Illustrative inputs, with no cache discount or retries:

| Request | Assumed input tokens | Output estimate | Planned total, either model |
| --- | --- | ---: | ---: |
| New draft | 300 text, 0 image | 196 | $0.00738 |
| New final | 300 text, 0 image | 1,756 | $0.05418 |
| High-quality reference/edit | 500 text, 1,000 image | 1,756 | $0.06318 |

The input counts are assumptions, not measurements or a fixed cost per uploaded file. Reference
images, input dimensions, prompt length, and model behavior matter. A prior generated image reused
for editing is also an image input. Each additional generated candidate, regeneration, and paid retry
must be counted, including work by visitors who never buy.

| Monthly workload | Flare planning estimate | Sunburst planning estimate |
| --- | ---: | ---: |
| Unchanged uploads only | $0 image generation | $0 image generation |
| 1,000 new drafts + 100 new finals | $12.80 | $12.80 |
| Above + 100 high-quality edits | $19.12 | $19.12 |
| 10,000 new drafts + 500 new finals | $100.89 | $100.89 |

Equal columns reflect the shared calculator and assumed token counts, not a measured model tie.
Rounding happens after summing. OMS's existing $0.50 draft / $1.00 final reservations are provisional
admission controls, not these provider prices or invoice measurements. Budget enforcement must be
calibrated before advertising an exact spending guarantee. See V1-06 in the release contract.

## Per-order economics

Standard US domestic-card processing is **2.9% + $0.30** per successful transaction. International
cards, conversion, disputes, and other services can add fees. Stripe Tax's Checkout integration lists
**0.5%** per transaction where the merchant is registered to collect tax. Confirm the installation's
actual plan and fee basis. [Stripe payments](https://stripe.com/pricing),
[Stripe Tax](https://stripe.com/tax/pricing)

Use the current supplier quote rather than a generic tee price. Include every placement, shipment,
tax paid to the supplier, and reprint/refund allowance. Sales tax collected is not merchandise revenue;
payment processing can apply to the total collected, including shipping and tax.

An illustrative order, with hypothetical product/shipping costs and no sales-tax amount:

```text
Merchandise $30 + shipping collected $5                         $35.00
Supplier product/placements $16 + shipping $4.50               -20.50
Domestic-card fee (2.9% × $35 + $0.30)                          - 1.315
Tax-service fee assumption (0.5% × $35)                        - 0.175
Refund/reprint reserve assumption (2% × $35)                   - 0.70
Handling assumption (3 minutes at $30/hour)                    - 1.50
Contribution before AI, infrastructure, care, and setup         $10.81
```

At 50 such monthly orders, the $19.12 AI workload and $65 infrastructure reduce that to about
**$9.13/order**. An illustrative $150/month care service reduces it to **$6.13/order**. This is
contribution under assumptions, not profit: acquisition, setup amortization, additional supplier
taxes/fees, overhead, and income taxes are not included. Change those inputs for the actual business.

## What to measure in the pilot

Record model/quality/size, redacted input/output usage, successful and paid failed requests, latency,
accepted designs, and orders. Count total AI spend against all visitors and accepted designs; do not
divide only the successful final call by an order. Track owner review and support time. Validate a
sample's print quality and actual shipping cost. No live calls or order purchases were used to make
this document.

Source checkpoints are dated estimates. Recheck before a proposal or public savings claim. The
remove.bg API-replacement concern is unverified here; simplifying new installations follows native
Image 2.5 transparency and does not depend on asserting a provider shutdown.
