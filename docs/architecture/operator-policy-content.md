# Operator-owned policy content

September 4, 2026. One merchant per deployment; no legal sufficiency assessment is performed.

The public manifest selects a committed JSON document under `config/policies/`. The document owns
all five policy/support pages as plain text, plus an explicit merchant identity snapshot, content
purpose, approved version, and approval date. The snapshot must match the merchant's display name,
canonical URL, legal name, disclosure, support email, and country. Project attribution stays outside
that document and continues to identify the original project, source, creator, and MIT license.

`policies.contentSha256` pins SHA-256 of `JSON.stringify(parsedDocument)`. Whitespace is irrelevant;
field order and every text character are significant. Validation rejects missing/extra fields,
invalid sections, mismatched identity or approval metadata, missing files, traversal, symlink escape,
and digest drift. It reports field paths without echoing document contents. React renders text,
never HTML or executable templates. Generation cannot create prose or update an approval pin.

The approved OMS paragraphs were extracted from `App.tsx` at `0873c08`, resolving the existing public
support address without changing any rendered wording. A regression digest freezes that original
page content. The operator explicitly reconciled version and approval date to September 3, 2026;
the existing effective-date paragraphs remain exactly as published. Both server checkout acceptance
and browser assent now use the manifest version. Generated frontend content and backend approval
metadata are checked together with merchant configuration before builds and type-checks.

Version 1 keeps `/privacy`, `/terms`, `/returns`, `/content-policy`, and `/support` fixed because Vercel
rewrites, canonical static documents, checkout links, and navigation share that deployment contract.
Unsupported path changes fail validation. Custom paths need a separate coordinated routing migration.

## Operator review procedure

1. Supply original operator-owned content and the exact merchant identity snapshot. Do not replace
   names inside OMS legal prose or assume its obligations fit another business.
2. Review the complete application experience, including checkout assent and customer promises.
   The document validator cannot evaluate legal adequacy or the truth of an operator attestation.
3. Set the document purpose to `operator-approved` only after explicit operator approval. Record the
   approved version/date in both the manifest and document. Any material assent change needs a new
   version and a coordinated review even if it does not edit this document.
4. Compute the document digest with the exported `policyDigest` helper, review the full prose diff,
   and explicitly update the manifest pin. Commit content, approval metadata, and generated output
   together. No generation command performs this approval step for the operator.
5. Run `config:validate`, `config:generate`, `config:check`, tests, and browser verification. Approval
   metadata is a review record, not a digital signature or legal certification.

Community Gear Lab includes deliberately non-legal demonstration notices marked `fixture-only`.
They carry synthetic identity and version metadata without asserting a real operator's approval.
Ordinary generation and Vercel builds reject them. The isolated rehearsal explicitly disables every
live provider/payment/fulfillment gate; the server also refuses live checkout with fixture policies.
The rehearsal never upgrades these notices into approved terms. A real fork must supply its own
reviewed content before enabling commerce.

Legacy `SUPPORT_EMAIL` and `VITE_SUPPORT_EMAIL` overrides are ignored. Public policy contact and
runtime support identity come from the same committed manifest; verified sender and Reply-To
transport configuration remain deployment-managed.
