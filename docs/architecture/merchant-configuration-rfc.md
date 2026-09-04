# Merchant configuration RFC

**Status:** Version 1 configuration contract verified with isolated fixture-profile rehearsal

**Schema:** `config/merchant.config.json`, version 1

**Scope:** One merchant per deployment; this is not a multi-tenant design.

## Decision

Open Merch Studio will use one committed, versioned JSON manifest for non-secret merchant identity
and presentation. Provider credentials, database locations, webhook secrets, and live authorization
remain deployment-managed environment values. Policy prose is a separate committed operator-owned
JSON document; the manifest pins its path, digest, approval version, and date. It never generates terms.

Project attribution is deliberately separate from merchant branding. A fork can call its store
“Community Gear Lab” while continuing to identify Open Merch Studio, its source, creator, and MIT
license accurately.

## Precedence and failure behavior

1. `config/merchant.config.json` is the committed public source of truth.
2. Deployment-derived host values may describe the current deployment but never replace canonical
   merchant identity.
3. Environment values supply secrets and explicit live gates only. They may not silently override
   brand, operator, policy, or attribution fields.
4. Built-in fixture data remains available only when fixture fallbacks are enabled.

`npm run config:generate` validates the active profile and emits immutable typed modules for the
browser and server. `npm run config:check` proves those committed modules are current; type-checking,
builds, and the test suite enforce that invariant. `npm run config:validate` validates the reference
and synthetic profiles, while `npm run doctor` includes the active profile check. Invalid JSON, an
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
6. Only then build owner authentication and editable mini-store administration on top of the
   organization boundary.

## Examples

- `config/merchant.config.json` is the Open Merch Studio reference profile.
- `config/examples/community-gear-lab.merchant.config.json` proves the shape can represent a second
  merchant without changing source code. Its `.example.org` identity is synthetic and not a claim
  of a deployed business.
