# Store administration

The `/admin` interface is the installation owner's control panel. The first
working release covers image-model selection, visitor AI allowances, and
provider credentials. It now also includes a [store-profile editor](./admin-merchant-profile.md)
with private brand/policy drafts and coordinated publication. It serves one merchant per deployment. A fork owns its
hosting, database, credentials, customers, and payment/fulfillment accounts.

## Owner workflow

Sign in with the deployment's `ADMIN_ACCESS_CODE`. Choose an artwork model and
save limits without editing source. Connect the installation's own OpenAI,
Printful, Stripe, Supabase, remove.bg, and Resend credentials in the Connections
forms. Values are saved to the configured Vercel production project. A separate
redeploy action applies them. Presence is labeled "configured", never proof of
account access, webhook verification, or live-commerce readiness.

The admin code remains only in memory for the open page, in a request header.
It is never placed in a URL, localStorage, or sessionStorage. Reloading requires
sign-in. The server checks the code on every action; rotating it revokes access.
There is a per-instance failed-login throttle; deployments should additionally
apply hosting-level rate limits across instances. Admin responses are no-store,
admin documents are noindex, and analytics are not mounted on admin pages.

This installation-admin credential does not confer organization membership.
The independent `/api/owner` mini-store API remains closed. Do not expose the
installation credential to an individual mini-store owner in a shared deployment.

## Persistent settings

`admin/store-settings.ts` owns a versioned record in the existing `AdminSetting`
table, under `store-operations-v1`. Model, daily/session estimated-spend budgets,
and new-visitor draft limits are allowlisted and validated. Changes use a
serializable transaction to save settings and their audit event together.
Optimistic revisions reject stale browser writes. Failure to persist is an error.
The existing RLS migration protects both settings and audit tables from public
Data API access; the server accesses them through its deployment database role.

Each artwork request reads one settings snapshot and carries it through
AsyncLocalStorage. That snapshot supplies both the budget authorization and
provider request. Changing the model during an in-flight generation cannot change
its print preparation halfway through. Settings are fetched for subsequent
requests, so replicas and cold starts do not retain stale process-local choices.

Without a database, non-production operation is explicitly a local demo. It
survives browser reload but not server restart. Production has no memory fallback.
The setup API stays accessible during a database outage so the hosting connection
can be repaired. No new schema migration is required.

Environment values remain the initial defaults until a settings record is saved.
Existing installations keep GPT Image 2 until an owner selects another model.
GPT Image 2.5 Sunburst and Flare use the existing Images API and 1024-square PNG
contract. Optional input fidelity is omitted for 2.x. Native transparency is
verified from image pixels; an opaque native-transparent response reports preparation
required without adding an unreserved background-removal charge. Direct uploads and
GPT Image 2 keep their separate removal path.
Image 2.5 uses provisional reservations of 50 cents for drafts/revisions and 100
cents for finals, not claimed API prices. Measure usage and latency in an approved
provider evaluation before tuning those estimates or changing output quality/size.
Budgets track estimates; they are not a guarantee about the provider's invoice.

Official model sources, checked September 10, 2026:
- https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst
- https://developers.openai.com/api/docs/models/gpt-image-2.5-flare
- https://developers.openai.com/api/docs/guides/image-generation

## Deployment-managed credentials

The UI never edits arbitrary environment variables or reads secrets back. Each
provider has a narrow allowlist. No admin code, hosting token, deployment target,
JavaScript runtime option, checkout authorization, or auto-confirm flag can be
changed through those forms. Blank fields preserve existing values. Replacement
values are sent directly to the server; secrets are stored as Vercel `sensitive`
variables. Provider response bodies are never returned or logged.

One-time bootstrap, configured outside the app in Vercel Production:

- `ADMIN_ACCESS_CODE`: a long randomly generated owner credential;
- `OMS_SETUP_VERCEL_TOKEN`: a token scoped to the installation's own team;
- `OMS_SETUP_VERCEL_PROJECT_ID`: its exact `prj_...` identifier;
- `OMS_SETUP_VERCEL_TEAM_ID`: the owning `team_...` identifier;
- `OMS_SETUP_DEPLOY_HOOK_URL`: optional hook for this project's production branch.

The bridge only activates when `VERCEL_ENV=production`. If supplied, Vercel's own
project identifier must agree. Before each write or redeploy, the adapter reads
the project with its configured team scope and verifies both project and owner.
The browser cannot supply another destination. HTTP redirects are disabled and
requests have bounded timeouts. A hook must use the official API origin and the
same project ID. It rebuilds the configured branch, including its latest commits.

A non-secret `OMS_CONNECTIONS_REVISION` marker records pending credentials in
hosting. A running deployment reports pending until it has that revision. A hook
receipt is only "deployment requested"; it is not build-success evidence. If the
hook is absent, the owner redeploys through Vercel. Other hosting providers can
implement this narrow adapter; meanwhile their owners use their host's secret UI.

Vercel references:
- https://vercel.com/docs/rest-api/projects/create-one-or-more-environment-variables
- https://vercel.com/docs/environment-variables/sensitive-environment-variables
- https://vercel.com/docs/deploy-hooks

Credential forms do not open checkout, confirm Printful production, verify sender
domains, apply migrations, or establish provider account ownership. Switching an
operating store's database/payment account needs an intentional migration. The
installation and launch guide remains authoritative for those separate operations.

## Verification

`npm test` covers denied admin requests, strict input validation, stale-write
rejection, per-request isolation, model parameters on generation and both edit
modes, alpha-channel validation, secret redaction, exact hosting targets, partial
provider failures, and deploy-hook boundaries. Tests use synthetic credentials and
stubbed provider transports; no charges or fulfillment drafts are created.

An opt-in `OMS_STORE_TEST_DATABASE_URL` targets an isolated local database named
`oms_store_admin_test`. The integration test proves readback from a new process
and rollback when the audit write fails. It must never point to production.
The admin browser harness covers phone/desktop layout, authentication, changes,
reload, request payloads, secret storage, connection failures, and deployment
status with fixture hosting responses.
