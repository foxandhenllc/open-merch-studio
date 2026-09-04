# Themed storefront boundary

The mini-store domain turns a durable, print-ready quote line into an owner-controlled product and
then publishes an ordered collection through a read-only storefront. It does not reuse the guest
cart as durable inventory.

## Ownership and access

- Every brand profile, saved product, collection, and storefront belongs to exactly one
  `Organization`.
- `OrganizationMember.subject` is reserved for a verified external authentication principal. The
  current application does not yet provide owner sign-in, so operator writes remain behind
  `ADMIN_ACCESS_CODE`; do not populate membership from an unverified email or browser value.
- All new tables have PostgreSQL RLS enabled with no Supabase Data API policy. Prisma connects as the
  table owner; public reads go through the narrow storefront API.
- Saved artwork remains a private `DesignAsset`. The public DTO exposes an explicitly configured
  mockup URL, never the design asset ID, storage path, quote ID, or provider payload.

## Publication invariant

A storefront can publish only when its collection has at least one product and every product is:

- active within its organization;
- backed by an active, sellable catalog product and available variant;
- backed by artwork whose policy status is `pass` and readiness is `ready`.

Publication and protected product changes create audit records. A public request returns only a
published storefront whose organization and collection are also active/published. Catalog drift is
filtered from public output even after publication; a future reconciliation job must also demote the
saved product and alert the operator.

## Commerce boundary

The first hosted mini-store is deliberately read-only. It links into the general studio and does not
silently inherit the Fox & Hen checkout, tax, support, Stripe, or Printful configuration. Per-owner
commerce requires verified organization authentication and separate merchant/fulfillment launch
review.
