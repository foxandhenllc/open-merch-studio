# Blank owner test and separate streamer example

The owner test now starts with no supplied merchant identity, artwork, collection, order, or policy
prose. Neutral colors, catalog choices, and AI limits are software defaults, not example merchant
content. Provider calls remain simulated in this private QA environment. Initial infrastructure is
still provided by the local harness; this test does not prove that a nontechnical owner can provision
hosting, database, storage, and a domain alone.

## Owner experience

Open `/admin/` through the private preview using the existing code. Overview gives one next action
and a resumable sequence. Each working section explains what the action does and what should follow.
Profile drafts can be saved unfinished without importing fallback identity or policy text. Complete
validation still applies at publication. Private profile edits do not update the storefront until
review, publication and successful redeployment. Collections have their own publication and ordering
approvals. Model and budget changes apply to new requests immediately.

The blank storefront stays unpublished until the owner supplies and publishes a profile. It does
not present Open Merch Studio's operator, policies, or examples as the new merchant's content.

## Separate fictional streamer example

- `/examples/streamer`: Night Shift, a fictional channel's completed merchandise presentation.
- `/examples/streamer/admin`: read-only setup sequence, before/after consequences, store previews at
  each stage, and inspectors for profile, collections, connections, artwork, installation, and orders.

The example contains no admin API client, provider account, purchasing action, or persistence. Its
prices and order are fictional, and its product photography is AI-generated illustrative artwork,
not Printful proof or a physical sample. Streamer ingestion and OAuth are not implemented or implied:
the creator supplies original artwork. Nothing from this example is seeded into the owner's database.

## Start another genuinely empty owner rehearsal

Stop the current lab and run `npm run owner:lab -- --fresh` using `.nvmrc`. This creates a new empty
local PostgreSQL cluster, database and private-file namespace, clears the new copy's backup list, and preserves the old
installation descriptor, database and files. Ordinary `npm run owner:lab` resumes the active copy.
The remote sharing process may stay running during a restart; it returns a temporary unavailable
response until the lab is ready. The access code is retained. The fresh switch never targets a
production database.

Do not run the older scenario-seeding `verify.mjs` on the blank owner test. Keep QA state and
completed persona examples separate from the user's clean installation.

## September 12 verification

Lint, type checking, 132 backend tests, 22 root tests, and the production build passed. Responsive
and policy browser checks passed; the updated admin contracts passed at 1440px and 390px. The
remote HTTPS check verified empty identity/policy fields, zero collections/artwork/orders, zero
confirmed setup tasks, unfinished draft persistence after reload, rejection of unfinished
publication, and every streamer sequence step and read-only inspector. Browsing the streamer
example made zero merchant API requests or mutations. Desktop/mobile screenshots were visually
reviewed. Evidence is ignored under `artifacts/private/owner-lab/evidence/`.

`node scripts/owner-lab/verify-blank.mjs` checks the pristine owner content and read-only example.
Its optional `--exercise-private-save` switch is only for a pristine QA copy: it saves one temporary
name, verifies persistence and publication rejection, then restores the empty draft with an
optimistic revision check. Start a new `--fresh` copy after exercising that write path if handing
off a literally untouched installation. Never run it against a store with owner content.
