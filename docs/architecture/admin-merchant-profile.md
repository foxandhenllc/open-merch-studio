# Owner-managed merchant profiles

September 10, 2026. One merchant per installation.

## Owner workflow

Open `/admin`, choose **Store profile**, and edit branding, store initials, app description,
colors, search copy, operator disclosure, support email, order prefix, email sender name, and
the displayed margin label. The catalog's actual pricing is not changed by its label. A live
identity preview updates as the owner types. All five policy/support pages have plain-text
fields and editable sections. The editor never rewrites prose by substituting business names.

**Save draft** stores a private revision; it does not alter the storefront. Switching admin
sections retains unsaved edits. Reloading the page discards unsaved edits and requires signing
in again; the browser warns before leaving an unsaved draft. **Discard edits & reload** explicitly
loads the latest saved revision, including after a concurrent edit conflict.

**Review & publish** shows changed fields and complete policy content. Changed merchant identity,
policy text, version, or approval date requires a new policy version and the owner's explicit
approval of the exact saved revision. Editing or saving clears the approval checkbox. A visual
change that does not change the policy identity or document preserves its existing approval.
No automatic process declares a different merchant's policies approved or legally adequate.

**Publish saved profile** sends the reviewed snapshot to hosting. **Redeploy with saved values**
then requests the configured production build. Neither button claims that a successful build
has already completed. After deployment, refresh status and verify the public storefront.
Publishing can also be followed by a manual Vercel redeploy when no deploy hook is configured.

## Shared contract and persistence

`packages/merchant-profile` owns field validation, policy binding, digest generation, and the
publication format. Existing script validators re-export that same implementation. The admin
API and build reject unknown fields, identity/digest drift, modified fixed settings, invalid
colors, unreadable base text/accent combinations, and payloads over 32 KB. Policy text is rendered
as text, never executable HTML. Validation does not judge the truth or adequacy of the prose.

The existing private `AdminSetting` table stores `merchant-profile-draft-v1`, its revision, and
the digest of the installed profile on which it was based. Save requests include both revision
and installed digest. Publication also includes the exact saved draft digest. Stale requests
return a conflict. Rebuilt installations expose their actual compiled profile as the baseline.

PostgreSQL advisory transaction locks serialize saves and publication for this installation,
including across server replicas. Draft and audit writes share a transaction. Publishing holds
the same lock while making bounded hosting calls so two revisions cannot overtake one another.
The audit contains digests and revision metadata, not the policy paragraphs or provider secrets.

Hosting and PostgreSQL cannot share one transaction: a hosting write can succeed before an audit
failure or lost response. Such a response reports an unconfirmed operation, never that hosting
was unchanged. Refresh deployment status before retrying; resending the same snapshot is safe.
Without a database, only non-production operation gets explicitly labeled server-session storage.

## Consistent publication

The existing Vercel bridge saves one encrypted, production-only `OMS_MERCHANT_PROFILE` value
and its activation marker after verifying the configured team/project. It cannot accept a new
hosting destination from the form. A profile is public merchant content, not a secret store;
arbitrary ENV names, runtime switches, credentials, and commerce gates are rejected.

`scripts/installation-profile.mjs` loads either that validated snapshot or the committed default.
The root build prepares the generated browser/server merchant modules, browser policy pages,
server policy approval, and admin baseline together. Static route metadata, sitemap, manifest,
and canonical pages use the same loader. Customer theme tokens use the selected colors. Sender
names use the selected profile while the verified email mailbox remains deployment-owned.
Existing order numbers are preserved; only newly created orders use the new prefix.

Deploy through the root `npm run build`. Other hosts can supply the same reviewed environment
value and run that command. Removing the override reverts the next build to the committed
default, including its own identity and policy record; review that transition before using it.

Vercel allows 64 KB of environment data in total for a Node deployment. The profile's 32 KB
limit leaves room but cannot guarantee the rest of an installation fits. Hosting save/build
failures remain visible. See [Vercel environment limits](https://vercel.com/docs/environment-variables#environment-variable-size).

## Deliberate installation boundaries

Domain routing and canonical origin, country/currency, actual margins/prices, logo and social
image files, product catalog, policy routes, source attribution, provider identity, and live
commerce authorization remain outside this editor. They need coordinated setup or separate
controls. A new fork still needs its own initial approved merchant/policy profile, accounts,
database, storage configuration, domain setup, and deployment bridge.

## Verification

- `npm test`: exact approval/revision binding, strict field and build validation, safe provider
  writes, configured-versus-active behavior, and existing customer contracts.
- `npm run test:browser`: customer flows at eleven viewport sizes, policy/profile contracts,
  and admin editing, preview, recovery, readback, policy approval, and hosting payloads on phone
  and desktop. Transports use fixtures only.
- `OMS_STORE_TEST_DATABASE_URL=...` with the existing store-admin database integration test:
  draft readback from a new process and atomic rollback on an audit failure, in a dedicated
  loopback database named `oms_store_admin_test`.
- `npm run config:rehearse-admin`: copies maintained source into a temporary directory, performs
  a clean dependency install, publishes a synthetic profile into its build environment, compiles
  both applications, checks server/email identity, and runs the policy/customer browser contract.
  It carries no provider credentials or live authorization and leaves this checkout unchanged.

The UI follows the existing restrained admin surface: labeled fields, one live identity preview,
and a distinct review step. Preview updates, section retention, and visible save/deploy states
provide interaction feedback without decorative motion.
