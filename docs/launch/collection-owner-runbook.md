# Operating an approved collection

This workflow is for one merchant installation. The artist can publish a small event collection;
a creator can offer an approved emote/still design; a local business can offer a fixed branded line.
Special submission systems, channel ingestion, contests, and other persona extensions belong in
the later client-style example projects.

## Prepare and open a collection

1. In **Store admin → Collections**, save a collection and its product choices. Confirm each variant,
   placement, owner price, and artwork rights. Bind an original to every required print area.
2. Set the intended print width and review the saved collection. Resolve every blocking print or
   catalog issue. Approve the public artwork previews deliberately; originals remain private.
3. Publish the collection preview. Open its public URL and check the artwork, labels, variant, price,
   and mobile presentation. This action alone does not open ordering.
4. Prepare each print layout using the provider's template for that exact variant. Set the canvas
   dimensions and offsets, save, inspect the canvas, and download a prepared PNG for review. Repeat
   for every area, including a back print. Do not assume one saved area completes the product.
5. Check sales readiness. Review the published prices and saved layouts, then select **Enable
   collection ordering**. The store's installation settings still determine fixture, paused, or live
   checkout. The button does not change payment permissions or automatically confirm production.
6. Rehearse quantities, the estimate, policy acceptance, checkout, and order revisit in fixture mode.
   A real sample and payment/fulfillment rehearsal require a separately authorized live run.

## What customers see

Customers choose quantities from the approved collection, review the owner's prices plus estimated
shipping, enter a receipt address, and accept the current policies before checkout. Tax is determined
at secure checkout. Estimates expire after 30 minutes. Selection changes require a fresh estimate;
retrying an unchanged request recovers the same quote. Their order page requires the access retained
by their browser or supplied through the existing order-link flow.

A collection's public images depict artwork and planned dimensions. They are not proof of the
finished garment, sticker, mug, or print. Use a reviewed physical sample before advertising production
quality. Do not advertise a real purchase or shipment from fixture screenshots.

## Changes and recovery

- **Pause sales:** select **Pause collection ordering**. Existing orders and their private print
  copies remain available. New checkout attempts against the paused collection are blocked.
- **Change a layout:** save and inspect the revised canvas. The previous sales approval no longer
  applies; review the prices/layouts again before enabling ordering.
- **Change the collection:** edit the draft, review it, and publish a new version. An older public
  version and its estimates become stale. Draft edits alone do not change the published collection.
- **Withdraw:** confirm withdrawal in admin. Public previews disappear and new purchases stop.
  Paid-order copies remain independent of the original; withdrawing is not a cancellation or refund.
- **Estimate unavailable:** retry after a temporary storage error. If the version/layout changed,
  reopen the collection. An expired request receives a fresh request ID for the next review. A rate
  limit asks the customer to retry later; repeated refreshes do not bypass it.
- **Checkout interrupted:** retry the same checkout. The server reuses its order and, when available,
  its existing Stripe session. Do not manually recreate payments while provider status is uncertain.
- **Customer lost browser access:** use the existing verified order-link/support workflow. Never ask
  the customer to share a provider token or copy a private artwork URL into a support ticket.

## Review an order

Open **Store admin → Orders & review** and select **Needs attention** to inspect unresolved orders.
Choose an order, download every saved collection print, and compare it with the provider template
and editable draft. The order's saved copy remains available after a collection changes or withdraws.

Use **Acknowledge review** to record that someone has picked it up. Add a note naming the issue and
next responsible person; omit private customer/account information. **Mark issue resolved** records
that note and clears the review flag. It does not refund, ship, or approve production.

When eligible, **Retry draft preparation** offers an explicit confirmation. Check the provider for
an existing draft first. Refresh after an uncertain result rather than creating another order.
Production is still confirmed in Printful. Fixture mode labels reviews as simulated and never offers
provider retries; fixture notes reset when the backend restarts.

## Responsibility after handoff

The merchant handles artwork rights, pricing, customer questions, policy decisions, cancellations,
and refunds. A named operator reviews paid print files and provider drafts before production.
Fox & Hen's optional care or managed package covers only the agreed operating/technical scope;
provider manufacturing and shipment outcomes remain with the fulfillment provider. Define the
operator and backup in the launch handoff before opening live checkout.

Technical recovery must preserve both PostgreSQL and private storage. In **Orders & review → Keep
private storage tidy**, select **Review expired preparations** to inspect abandoned copies at least
seven days past estimate expiry. Review another batch when offered. **Clear eligible preparations**
asks for confirmation and checks eligibility again. All order-linked files and original artwork are
retained. If cleanup cannot finish, check storage, review again, and retry; do not delete its database
records manually. This is an owner action, not a scheduled job. See the
[retention contract](../architecture/collection-retention.md).
