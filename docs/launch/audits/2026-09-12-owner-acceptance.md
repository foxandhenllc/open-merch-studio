# Owner acceptance checkpoint — September 12, 2026

Source checkpoint: `83aeb3a`, following `585c4f6`, `82cc414`, `e0e9989`, and `68861e0`.
The V1 candidate is ready for Chris's hands-on owner acceptance in the local rehearsal. Package
versions remain 0.1.0. No V1 tag, push, public deployment, live payment, paid generation, fulfillment
submission, customer email, or production storage deletion was performed for this work.

Start with the [owner acceptance walkthrough](../owner-acceptance-walkthrough.md).

## Delivered owner outcomes

- Search and page through the complete order history, including unresolved older exceptions.
- Prepare private logo/share-image copies, edit the store URL and publish a reviewed brand/profile.
- Choose a persona and resume installation confirmations; read-only checks distinguish configuration,
  reached services, and remaining owner verification.
- Publish fixed/upload/generate/reference artwork choices per collection item. Server checks bind the
  source session, original checksum, product, price and print layout. Generation request receipts
  recover uncertain responses without silently requesting another paid image.
- Review the actual saved print before checkout. Order-linked copies survive source changes and
  remain privately downloadable by the owner after a restore.
- Rehearse the product with an isolated PostgreSQL cluster and private filesystem storage, four
  synthetic persona collections and simulated orders. Profile redeployment rebuilds the local store.
- Back up the paused local database and private files together, verify their hashes, and restore into
  a separate database/file copy while preserving the prior copy. Resume after a full process restart.

The acceptance run found and fixed three additional issues: JSONB key ordering invalidated an
immediately saved profile's review digest; build verification rejected an ampersand in the 404 title
and managed PNG brand assets; general uploads still created public print derivatives. New uploaded
print copies are private with fresh signed provider access. Cleanup failure preserves database
metadata. Historical public derivatives are retained for a separately planned legacy transition.

## Verification receipts

All local commands used Node 22.12.0 and npm 10.9.2. Database tests used new local PostgreSQL clusters;
no installed merchant database was used. The owner lab uses password-protected loopback PostgreSQL
and a local implementation of the pinned storage transport, with external provider fetches blocked.

| Check | Result |
| --- | --- |
| Lint, TypeScript, build and static route verification | Passed. |
| Unit/contract suite | 132 backend tests passed; 15 database-only tests skipped in the ordinary run. 20 root tests and both frontend fixture/selector contracts passed. |
| Installation/admin/artwork/purchase/model PostgreSQL suite | 10 passed, no skips. Includes a save followed by publication using the returned digest through separate JSONB transactions. |
| Database recovery and restricted-owner/RLS suite | 12 checks including nested role-isolation subtests passed, no skips. Recovery retained monotonic refund and private access behavior. |
| Responsive customer browser suite | Passed at 11 viewport sizes. |
| Policy/profile and admin browser suites | Passed at 1440px and 390px, including all three personalized collection modes, interrupted generation, print-preview retry and order review. |
| Fresh installations | Harbor Community Merch and Community Gear Lab rehearsals passed from clean dependency installs, including runtime/static identity, policies and phone/desktop checkout payload checks. |
| Persistent owner lab | Profile editing/upload/publication/rebuild, customer uploads, desktop/phone simulated checkout, paired backup and isolated restore passed. Six order records and six private print downloads were preserved; print hashes matched before/after restore. |
| Full lab restart | Active reviewed profile, published logo, six saved orders and all six private print downloads remained available. |
| General upload privacy | Public image and missing/wrong-session requests denied; original/print bytes private; no expiring print URL persisted; fresh signed provider reads and failed-cleanup metadata retention verified against local storage and PostgreSQL. |
| Production dependency audit | 152 package versions; one applicable OSV advisory, none high, critical or unclassified. This is not a zero-vulnerability claim. |

Local screenshots and detailed receipts are under ignored `artifacts/private/owner-lab/evidence/`.
Phone purchase and restored order-detail screenshots were visually inspected. The simulated print
canvas is labeled as a flat saved print, not a photograph of a finished product. The launcher guide,
credentials and data remain local; they are not committed or public case-study evidence.

The fresh dependency installs report a transitive development-tool engine warning under the current
Node pin, but the maintained install, compile, lint and test gates pass. This receipt does not claim
verification on every operating system; the persistent lab was exercised on macOS with PostgreSQL 14.

## Release boundary

This closes the planned locally actionable preparation for owner testing. It does not replace:

1. Chris's review and an independent nontechnical owner's observed setup, publishing and recovery.
2. A verified hosted installation with owned accounts, domain/DNS and cloud backup procedures.
3. An explicitly authorized physical sample and real payment/refund/fulfillment/email lifecycle.
4. Account-specific Image 2.5 quality and invoice calibration.
5. Release review, version bump, tag and public proof based on the approved release.

Use the [V1 release contract](../v1-release-contract.md) to make that decision. Later persona forks
remain client-style builds pinned to the release, with separately scoped integrations. Marketing can
show the demonstrated owner workflow; quick setup, automatic operation and physical quality claims
need actual pilot evidence.
