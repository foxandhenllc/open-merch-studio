# Controlled collection personalization 

Owner-approved example artwork continues defining the product, variant, print areas and bounding
box. A published item chooses fixed, upload, generate or reference mode. Fixed products reject
customer asset overrides. Personalizable products accept only completed artwork belonging to the
requesting session and matching the selected source type. Their prices, variants and layout remain
server-owned. Existing freeform studio capabilities do not change this final purchase boundary.

Upload personalization reads the verified private original; it must not print a compressed preview
or silently use AI. A separate local-only original cache makes fixture behavior faithful, with a
one-hour expiry and a 64 MB bound. Durable installations use private storage and checksums. Prepared
order copies survive deletion of a temporary upload. Generated/reference-generated sources retain
their distinct provenance and are decoded from stored image data, never fetched from a caller URL.

Customer artwork fits inside the owner's example-art box with preserved aspect ratio and centered
padding. The server rejects sources below 150 effective pixels per inch. Print copies use the same
300-PPI output and template checks as fixed collections. Submitted art does not replace the publicly
published example. Private customer preview and final quote need the same saved print bytes.

## Customer and request boundary

The UI exposes only the published source mode. Collection uploads use the explicit `collection`
purpose: the original and preview stay private, and no public workbench print derivative is created.
Reference uploads keep their distinct purpose. A raw collection upload is rejected by generic checkout;
only the collection preparation seam creates its owner-bound immutable print copies. Uploaded images
are not served by the public generated-image endpoint, including fixture images.

Customers review the saved files through a session-bound binary preview endpoint before the UI
allows checkout. That endpoint reads the quote's existing private copies and verifies their hashes;
it never rerenders a different source or returns a storage URL. A failed preview disables checkout
until retry succeeds. Price, variant, allowed mode and public example remain owner-controlled.

Generation requests inherit the owner's active model/budget settings. A durable request receipt is
written before the generation call. Repeating its ID returns the completed asset or an explicit
pending/failed response; it never starts another generation. The browser preserves pending request
identity through reload. Starting a separate request is an explicit customer action. Unknown provider
or audit failures remain pending; they cannot be declared uncharged or automatically retried. The
existing generation/spend ledger retains any completed provider result and reserved spend.

New generation and print-preparation attempts share the installation's bounded request limit
(30 per session/hour, 120 per installation/hour), in addition to AI budgets. No general-purpose API
key or cross-store workflow engine is introduced.

## Evidence and limits

Fixture integration tests exercise all four modes, cross-session/incorrect-mode rejection, minimum
resolution, unchanged original checksums and owner pricing, generated-request replay, reference
provenance, print previews and temporary-source removal. Isolated PostgreSQL tests repeat generation
and quote retrieval in fresh processes, preserve saved copies after source deletion, and inject a
completion-audit failure to prove a retry cannot generate a second time.

Desktop and phone browser contracts upload, generate, use a reference, recover a lost generation
response after reload, inspect actual request payloads, retry a failed saved-print preview and finish
a simulated checkout. Live model quality, a supplier mockup, physical print quality and independent
owner acceptance remain separate release evidence. The flat file preview is explicitly labeled and
is not presented as a product photograph. The owner still reviews production drafts.
