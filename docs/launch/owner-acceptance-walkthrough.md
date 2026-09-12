> For the current blank-start review, use [Blank owner test and streamer example](blank-owner-and-streamer-review.md).
> The scenario-filled rehearsal below is separate; do not seed its sample content into the blank owner test.

# Owner acceptance: Open Merch Studio V1 candidate

This is the hands-on acceptance checkpoint before a V1 release decision. It exercises the supported
single-owner product using persistent local data and simulated providers. It is not a public V1 tag,
production deployment, physical sample, or proof of an independent customer's setup time.

## Open the prepared installation

On Chris's Mac, open **http://127.0.0.1:5188/lab/**. The local guide links to admin, collections,
the general workbench, four persona examples, supplied artwork, backup, and restore.

The admin code is in `artifacts/private/owner-lab/ACCESS.md`. It controls this local installation only.
Do not copy it into an issue or commit it. If the server is stopped, run from the repository:

```sh
nvm use
npm ci
npm run owner:lab
```

The launcher uses Node 22 and a locally installed PostgreSQL binary set. It detects common Homebrew
and Linux paths; set `OMS_POSTGRES_BIN` to the PostgreSQL `bin` directory if needed. It never uses the
repository's `.env` or a supplied production database URL. On first use it installs dependencies in
an isolated source copy, initializes a password-protected loopback database, applies the real
migration chain, and builds the application. Later starts keep your saved data. Stop with Ctrl-C.
Use the same port when resuming; changing the storage origin changes the private-file namespace.

The prepared installation contains Fox & Hen rehearsal branding, four synthetic collections and
simulated orders. A fresh invocation in a new checkout starts empty. The optional maintainer command
`node scripts/owner-lab/verify.mjs` seeds those examples and performs a full destructive-to-the-lab
recovery exercise in separate copies; do not rerun it casually after making your own test changes.

## What is real here

- Private draft persistence, artwork bytes and checksums, collection publication, owner prices,
  print layout checks, saved print copies, order records, review notes and backup/restore.
- Profile publication writes a reviewed local profile and rebuilds both applications. A saved draft
  does not alter the storefront; publishing and redeploying are separate steps.
- The same application routes enforce artwork mode, session ownership, revisions and checkout gates.

AI art, catalog/provider metadata, prices/templates in the examples, payments, emails, production,
provider credentials and hosting account operations are simulated. No external provider request is
made by the running lab. Connection forms accept only example values beginning `lab-`; do not enter
real account keys. The production-hosting wording in admin describes the real workflow, while the
persistent banner identifies this local simulation. Cloud signup, DNS, account verification, billing
and migrations on a real hosting account remain part of the supported installation guide.

## Try it as each customer

| Persona | Starting point | What to evaluate |
| --- | --- | --- |
| Creator / community brand | Community drop | Generate a design within one owner-approved product. Product, price and print area stay fixed. A lost response can check the previous generation without requesting another paid image. |
| Independent artist | Artist show | Upload finished art unchanged in admin, attach it to a collection, review print dimensions, publish and later withdraw it. Link an existing artist/membership website where appropriate. |
| Coffee shop | Coffee club | Use the customer upload option, inspect the exact saved print and complete simulated checkout. This does not provide a competition/submissions platform or roll-label production. |
| Specialty local business | Local maker | Use the installation checklist, save branding, try reference-led artwork, review an order, and restore an isolated copy. Evaluate where a Fox & Hen build or care package would save effort. |

Twitch/YouTube ingestion, automatic clip scanning, community voting, subscription billing, POS and
scenario-specific automation belong in later client-style forks. These examples demonstrate the
base capabilities without claiming those extensions exist.

## Acceptance checklist

1. **Resume setup.** Open admin → Installation, choose your persona, read a task and mark it done.
   Refresh, sign in again and confirm progress remains. These are your confirmations; automatic
   checks distinguish database/storage access from unverified provider account access.
2. **Make it yours.** Change store name, initials, colors, support information and labels in Store
   profile. Upload a logo and sharing image, prepare their copies and save the draft. Change identity
   or policy content with a new policy version; inspect all five pages and approve the exact draft.
3. **Activate the profile.** Publish, then use Connections → Redeploy with saved values. Wait for the
   local rebuild and refresh. Confirm header, logo, metadata, policies and order labels agree. A failed
   rebuild leaves the lab guide reachable; use Retry local rebuild after the underlying issue is fixed.
4. **Run a drop.** Create or edit a collection. Choose product, variant, print area, owner price and
   Customer artwork option. Attach owner example artwork even when personalization is enabled. Review
   and publish, prepare print layouts, inspect the saved canvas, then enable simulated ordering.
   The supplied sample's 4-inch art in an 8 × 10-inch canvas is a synthetic test, not a supplier template.
5. **Become the customer.** Open the collection in a new tab, select quantity and provide allowed
   artwork. Review the exact saved print, use an example receipt address, accept policies and complete
   simulated checkout. Revisit the order. Test phone-width behavior as well as desktop.
6. **Operate the order.** In Orders & review, find it, open every saved print and record an acknowledgment
   or resolution note. Notes never approve production, refund a payment or send email. Search and
   filters apply across the complete order history. Live draft retries stay disabled in this lab.
7. **Change your mind safely.** Pause ordering, edit and republish, or withdraw the collection. An old
   estimate should require a refresh. Existing order print copies should remain available.
8. **Recover.** In the lab guide, enter the code and Create backup. Change one setting. Restore latest
   backup to a separate copy, then confirm the earlier setting, published profile, collections,
   orders and downloaded print files. The original database/file copy remains in `instances/`.

Record the task, expected outcome, actual outcome, assistance needed and elapsed time. An unfamiliar
label, missing next step or confusing recovery message is useful feedback. Do not include credentials,
private artwork links, addresses or payment identifiers in screenshots or public issue reports.

## Before calling the release shipped

Close issues found during this owner test, observe an independent nontechnical owner, and verify
one real installation with its own accounts and domain. Separately authorize and observe a physical
sample and the payment/refund/fulfillment/email lifecycle. Calibrate the selected model's actual
quality and invoices. Rehearse the chosen cloud backup procedure as well as this local paired restore.
Complete release review, then bump versions and tag V1.0.0. Public persona forks and marketing claims
should point to the verified release and actual evidence.

## Review from a different computer

Use the [private remote owner preview](remote-owner-preview.md) to access the persistent lab through
an HTTPS URL with the existing access code. The Mac must remain online; live providers stay disabled.
