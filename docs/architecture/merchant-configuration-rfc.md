# Merchant configuration RFC

**Status:** Version 1 configuration contract; reviewed admin publication added September 10, 2026

**Schema:** `config/merchant.config.json`, version 1

**Scope:** One merchant per deployment; this is not a multi-tenant design.

## Decision

Open Merch Studio uses a versioned JSON profile for non-secret merchant identity and presentation.
The committed manifest and separate operator-owned policy document supply the installation default.
The manifest pins policy path, digest, approval version, and date; it never generates terms.

The September 10 owner-admin extension allows a reviewed profile to be published as one
deployment-managed `OMS_MERCHANT_PROFILE` snapshot. The build validates it and generates all public
and server consumers together. This supersedes the original environment-only-for-secrets rule for
this one structured value. Provider credentials, database locations, webhook secrets, and live
authorization remain separate deployment-managed values. See the
[profile publication contract](./admin-merchant-profile.md) for editable fields and approval rules.

Project attribution is deliberately separate from merchant branding. A fork can call its store
“Community Gear Lab” while continuing to identify Open Merch Studio, its source, creator, and MIT
license accurately.

## Precedence and failure behavior

1. A valid, explicitly published `OMS_MERCHANT_PROFILE` is the active build profile when present.
   Malformed, unapproved, or incompatible content fails validation instead of falling back.
2. Otherwise, `config/merchant.config.json` and its pinned policy document supply the default.
3. Deployment-derived host values never replace canonical identity. Individual environment values
   cannot silently replace merchant fields. The reviewed snapshot cannot change fixed fields such
   as canonical origin, asset paths, currency, policy routes, or project attribution.
4. Built-in fixture data remains available only when fixture fallbacks are enabled.

`npm run config:generate` validates the active profile and emits immutable typed modules for the
browser and server. `npm run config:check` proves generated modules match that profile. The root
build generates modules from a published snapshot when present and checks the committed defaults
otherwise; type-checking and the test suite also enforce consistency. `npm run config:validate`
validates the reference and synthetic profiles, while `npm run doctor` includes the active profile
check. Invalid JSON, an
unsupported schema version, missing public assets, unsafe URLs, malformed order prefixes, or missing
launch-critical fields returns a nonzero exit code. Validation reports field paths and fixed
remediation text, never configured secret values.

## Field ownership

| Domain        | Manifest fields                                   | Classification                       | Current consumers to migrate                               |
| ------------- | ------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------- |
| Brand         | name, description, logo, social image, colors     | Public config                        | workbench header, loading shell, PWA and social metadata   |
| Web/SEO       | canonical URL, title, description                 | Public config                        | `index.html`, static routes, sitemap and canonical tags    |
| Operator      | legal name, disclosure, support email, country    | Public config plus operator approval | policies, support, customer order view                     |
| Policies      | route paths, approved version/date                | Operator-approved content metadata   | policy routing and checkout acceptance                     |
| Catalog       | currency, shipping countries, category allowlist  | Public config                        | catalog presentation and checkout validation               |
| Pricing       | customer-visible margin label                     | Public config                        | quote line labels                                          |
| Orders        | order-number prefix                               | Public config                        | durable order creation and support references              |
| Email         | sender display name and mailbox local part        | Public config                        | customer templates; verified domain stays deployment setup |
| Attribution   | project/source/license/creator identity           | Public config, license-preserving    | footer and repository links                                |
| Providers     | API keys, account/store IDs, webhook secrets      | Secret env                           | backend adapters only                                      |
| Storage/data  | database URL, Supabase URL and service key        | Secret env                           | Prisma and private artwork storage                         |
| Authorization | payment, fulfillment, checkout mode, auto-confirm | Explicit env gates                   | server enforcement only                                    |
| Deployment    | runtime host/preview URL                          | Deployment-derived                   | CORS and callback construction                             |

## Security and policy boundaries

- The manifest is public and must contain no credentials, banking data, tax IDs, private addresses,
  customer data, provider identifiers, or webhook values.
- A support email is public contact metadata; email-provider authentication remains secret.
- `CHECKOUT_ACCESS_MODE` remains the server payment gate. Manifest validation cannot enable payment.
- `PRINTFUL_AUTO_CONFIRM_ORDERS=false` remains the default review-first fulfillment contract.
- Policy dates prove only which operator-reviewed copy was selected. The validator does not assess
  legal sufficiency and must not fabricate policy text.
- Merchant configuration does not confer organization membership or mini-store write access.

## Versioning and migration

Schema version 1 passed runtime, static-build, and isolated second-profile rehearsal on September 4,
2026. This verifies configuration portability, not legal sufficiency or one-click live activation.
Its policy paths remain fixed to the current deployment routes. Additive optional fields may remain within a version; removing, renaming, or
changing field meaning requires a new version and an explicit migration guide. Unsupported versions
fail closed. Runtime code must not guess a nearest version.

## Implementation sequence

1. **Completed:** reference and synthetic profiles, JSON Schema, deterministic validator, doctor
   integration, missing-asset checks, and redaction tests.
2. **Completed September 4, 2026:** generate committed, typed frontend/backend constants from the
   validated manifest; request handlers never read mutable configuration files.
3. **Completed September 4, 2026:** migrate low-risk consumers for workbench presentation,
   attribution, customer-email branding, support contact, currency default, Stripe item names,
   pricing label, and order prefix. The active profile preserves current Open Merch Studio output.
4. **SEO completed September 4, 2026:** derive canonical origins, route titles/descriptions, social
   identity, icon references, robots output, and sitemap output from the manifest. The subsequent
   policy boundary moved approved prose out of `App.tsx`; installed-app metadata and social-image
   description now derive from the same profile. See [operator policy content](./operator-policy-content.md).
5. **Completed September 4, 2026:** `npm run config:rehearse` installs indexed source in an isolated
   temporary directory using `npm ci`, rejects cross-operator policy reuse, generates Community Gear
   Lab configuration, and runs validation, doctor, lint, type-check, build, fixture checkout, compiled
   server checks, and mobile/desktop browser verification. Runtime support, order prefix, pricing,
   policy content/version, canonical metadata, installed-app identity, source, and MIT attribution
   agree. The synthetic SVG is explicitly a fixture asset, not a tested social-platform preview.
   Every live provider/payment/fulfillment gate is disabled; no provider credentials are inherited.
   CI repeats this command. Real merchant policy approval remains mandatory before live activation.
6. **Completed locally September 10, 2026:** installation-admin brand and policy editing, private
   drafts, exact revision approval, and reviewed profile publication. `npm run config:rehearse-admin`
   verifies a clean install and build with a distinct synthetic profile. See the
   [implementation and verification](./admin-merchant-profile.md). These controls do not enable
   organization-owner access or imply a production deployment.
7. Build owner authentication and editable mini-store administration on top of the
   organization boundary. The [owner administration architecture](./mini-store-owner-administration.md)
   now specifies the identity adapter, membership roles, scoped repository/RLS boundary, immutable
   publication revisions, audit records, and prerequisite corrections. Owner mutations remain disabled.

## Examples

- `config/merchant.config.json` is the Open Merch Studio reference profile.
- `config/examples/community-gear-lab.merchant.config.json` proves the shape can represent a second
  merchant without changing source code. Its `.example.org` identity is synthetic and not a claim
  of a deployed business.
