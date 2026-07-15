# Pre-Domain Product And Release Audit — 2026-07-15

**Scope:** Open Merch Studio immediately before a branded-domain cutover  
**Canonical candidate:** `https://openmerchstudio.com`  
**Commerce posture:** Checkout and fulfillment remain closed  
**Result:** Ready to continue on the temporary host while domain, legal, and live-payment approval remain explicit gates

## What Changed

- Preserved the focused desktop workbench: persistent product canvas, one task panel, and no
  document scrolling in the core flow at desktop widths.
- Reworked tablet and mobile into a product-first sheet with no horizontal overflow and one clear
  next action.
- Added bounded 30-day guest recovery, a visible Start fresh control, recoverable Stripe return-URL
  cleanup, and safe recovery from failed provider previews.
- Replaced public order payloads with a customer-safe confirmation contract that omits customer
  email, addresses, Stripe identifiers, Printful identifiers/errors, raw provider notes, and internal
  quote metadata.
- Prepared pure HTML/text order, refund, and action-needed email templates without enabling a sender
  or adding an email credential.
- Added temporary-host noindex controls, security headers, a web manifest, a useful not-found route,
  updated privacy/support copy, and the branded-domain cutover checklist.
- Added automated responsive and first-visitor coverage across the release viewport matrix.

## Flow Health

1. **Choose a product — healthy.** Desktop retains the canvas/task-panel split. Widths below 1024px
   open a full-height catalog sheet with touch-sized controls and internal scrolling.
2. **Choose color and size — healthy.** Variant changes update the product preview immediately,
   preserve selection per product, and keep one Continue action.
3. **Describe the design — healthy.** The prompt is the primary focus target; supporting copy remains
   contextual, and the layout does not horizontally overflow.
4. **Generate — healthy in fixture and guarded provider modes.** The UI announces one phase at a
   time, moves cleanly from product to artwork to mockup, and preserves artwork if the mockup fails.
5. **Review — healthy.** The customer sees the finished preview, readiness result, estimated total,
   and the three intended actions without provider internals.
6. **Checkout return — healthy in fixture mode.** URL credentials are removed from browser history,
   unrelated campaign parameters are retained, delayed reconciliation can be checked again after a
   reload, and the order view uses the customer-safe response.
7. **Order/support — healthy for closed beta.** The confirmation shows items, tax, final total,
   customer-safe status history, next steps, support, and returns guidance.
8. **Domain and app-owned email — prepared, intentionally gated.** The temporary host remains
   non-indexable. Canonical metadata, branded support/sender addresses, DNS authentication, legal
   approval, and direct email delivery wait for domain ownership.

## Visual Evidence

- `screenshots/01-desktop-configure.png` — initial desktop configure audit; exposed an oversized
  programmatic focus outline that is now suppressed while keyboard-visible focus remains.
- `screenshots/02-desktop-product.png` — desktop product-selection mode.
- `screenshots/03-desktop-describe.png` — desktop prompt composition.
- `screenshots/04-mobile-describe-390.png` — 390px prompt composition.
- `screenshots/08-after-mobile-product-320.png` — final 320px product sheet.
- `screenshots/09-after-desktop-configure-1440.png` — final 1440px configure mode.

## Automated Evidence

The responsive smoke test covers product, configure, and describe modes across the documented
desktop, tablet, and phone viewports. It also runs the full fixture journey through generation,
review, checkout, and order confirmation, validates variant updates and product switching, focus
movement, document/viewport overflow constraints, reduced-motion behavior, console errors, and
recoverable Stripe query cleanup.

Release checks for this tranche:

```bash
npm ci
npm audit --audit-level=high
npm run lint
npm run type-check
DATABASE_URL= npm test
npm run smoke:fixture
npm run build
npm run test:browser
```

All eight Prisma migrations were also applied to a disposable local PostgreSQL database, and the
serialized payment/refund/fulfillment recovery integration test passed against that migrated schema.

## Remaining Gates

- Purchase and protect the domain, attach apex and `www`, then follow the
  [domain cutover checklist](../../launch/domain-cutover-openmerchstudio-com.md).
- Approve seller identity, effective dates, jurisdiction-specific terms/privacy rights, retention,
  and the branded support mailbox before public payment access.
- Keep app-owned transactional email disabled until sender authentication and an exactly-once
  notification/outbox record are implemented and tested.
- Open real payments and Printful draft creation only through the supervised allowlist procedure;
  close both immediately after the single smoke purchase.
