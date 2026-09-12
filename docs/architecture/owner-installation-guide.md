# Resumable owner installation guide

The Installation page pairs a saved owner checklist with explicitly requested read-only checks.
The visual approach is a compact working list: clear next action, task context, one-click navigation
into the relevant admin section, and visible save/retry feedback. Selecting creator/community,
artist, coffee/community space or local/specialty business changes the setup guidance. It does not
claim a vertical integration or generate a public case study.

`installation-progress-v1` stores the selected persona, confirmed task IDs, revision and an opaque
configuration digest. Save and redacted audit share a PostgreSQL transaction. Conflicting revisions
or a changed deployed configuration reject stale saves. A changed identity, provider credential or
commerce setting clears old confirmations in the returned view until reviewed again. The digest
never exposes its source values. Account tokens and connection strings are not stored in this record,
audit or browser state. Database-free local progress is explicitly server-session-only; production
cannot silently fall back to it.

Checkmarks are owner attestations, not verified launch gates. They never activate checkout or
production. The separate check action reads required Prisma migration history and application-table
access, verifies the configured upload bucket reports private, and reports the presence of provider
values. It neither applies a migration nor writes a test file, generates artwork, sends an email,
charges a card or creates a fulfillment order. Presence of credentials does not verify their scope,
account access or live behavior. A checked private bucket still needs upload/readback testing.

The required migration list is checked against committed migration directories by a source test.
A missing or unfinished migration reports an action, including when an older database is reachable.
A failed database/storage read yields concise recovery guidance without raw provider errors. Checks
remain available independently of whether persisted checklist progress can be loaded.

The public installation checklist supplies the one-time hosting bootstrap, supported migration
commands, domain/account steps and recovery boundaries. Account signup, identity checks, billing and
first-time host configuration still require the owner or an operator; the V1 guide does not claim
that an unknown cloud account can be provisioned automatically.

Verification: unit tests cover migration coverage, unfinished history, authentication, stale writes,
configuration changes and private responses. Isolated PostgreSQL tests cover fresh-process readback
and injected audit rollback. Browser checks at 1440 and 390 pixels select a persona, confirm a task,
run safe checks, reload/re-authenticate, recover saved progress and navigate to collection work.
