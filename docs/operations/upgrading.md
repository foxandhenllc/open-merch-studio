# Upgrade and recovery checklist

This is the current manual checklist. An automatic upgrader, one-click data export, and a verified
production restore workflow are not implemented. The V1 release requires an isolated upgrade and
restore rehearsal; do not describe those as complete based on a successful fresh build.

## Record the installation

Privately record the deployed commit, runtime versions, migration status, active merchant-profile
digest, model settings, and the owning hosting/database/provider accounts. Keep a secure inventory of
deployment settings and webhook configuration. Do not paste secret values into logs or Git.

The store includes more than source code: PostgreSQL records, private artwork objects, the reviewed
deployment profile, provider identities, and webhook/email configuration all affect behavior.
Back up database records and private storage through their providers and retain a matching manifest.
A database backup alone does not establish that artwork objects are recoverable.

## Rehearse a candidate

1. Review the candidate changelog, environment diff, schema migrations, and provider changes.
2. Create an isolated staging checkout and database/storage destination. Never point a fixture
   rehearsal at the live merchant's database or provider accounts.
3. Install with the declared Node/npm versions. Carry forward the merchant's reviewed profile
   through secure deployment configuration; do not merge private settings into upstream code.
4. Run the normal fixture checks. Verify brand/policy identity, saved settings, catalog assumptions,
   existing order references, and artwork access with synthetic records.
5. Rehearse migration and restore against isolated data. Record restore time and check that private
   objects, policy revisions, and order relationships still resolve. A real-data rehearsal needs an
   appropriate private environment and deliberately disabled outbound provider actions.
6. Verify staging webhooks and customer email cannot trigger production actions. Record any
   required manual migration and the permitted rollback route before promotion.

## Promote and recover

Promote a reviewed release only after those checks and the merchant's launch procedure pass.
Observe the installed profile and health after deployment; a build request is not activation.
Keep an audit of which source and settings were promoted.

If application code fails and the schema is compatible, the prior deployment may be recoverable.
Database migrations are not automatically reversible. Do not assume a code rollback can undo a
schema change. Restoring an older database can discard newer orders and cause provider-state drift;
pause affected commerce and reconcile provider events with an explicit recovery plan before any
such restore. Never recreate or confirm fulfillment merely because a browser reports success.

## Image 2 to Image 2.5 transition

New defaults select Flare. Existing OPENAI_DESIGN_MODEL values and saved admin selections take
precedence. Choose Flare or Sunburst deliberately in each existing store and verify the selected
model, costs, and print-output behavior before removing the legacy configuration. No automatic paid
test is part of switching the model. Existing artwork keeps its saved files.

Legacy Image 2 settings now migrate to Flare with durable audit coverage. Image 2 and background-removal
controls and calls are retired; no cleanup of historical original artwork is implied.
Transparent output remains subject to actual pixel validation; imported artwork is never silently
regenerated to make it transparent.

## Owner acceptance recovery rehearsal

`npm run owner:lab` creates an isolated PostgreSQL cluster and private filesystem storage, without
copying application credentials. Its guide can pause the local store, capture a paired database/files
backup, validate file hashes, and restore into a new database plus file copy on the same local origin.
The previous copy remains intact. See the [owner walkthrough](../launch/owner-acceptance-walkthrough.md).
This is a repeatable local rehearsal; validate your cloud provider's backup procedure separately.

New general-workbench uploads keep normalized print copies in private storage and resolve fresh
signed URLs when provider access is needed. No expiring signed link is persisted as the print's
identity. Historical public derivatives are neither deleted nor reclassified by this change; plan any
legacy cleanup separately after verifying order references. Cleanup failures preserve database
metadata for retry. Collection print copies retain their existing checksum-based private contract.
