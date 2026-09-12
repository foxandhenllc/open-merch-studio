# Owner brand assets and domain profile

Implemented for V1 owner acceptance; public release evidence remains separate.

Visual thesis: let the owner's mark and artwork supply the identity while the editor remains a quiet
workspace. Content plan: choose a logo and sharing image, inspect the prepared previews, then include
those exact assets in the normal saved-profile review. Interaction thesis: show upload/preparation
progress, retain the chosen file through retries, and update the preview without replacing the
published store until the owner reviews and applies a deployment.

Brand originals use the existing private artwork upload boundary. Prepared logo/share derivatives
are immutable and separately stored, so later source-library removal does not break a deployed
brand. Only derivatives referenced by the active reviewed installation profile are publicly served.
The profile contains paths and metadata rather than embedded image bytes or private storage URLs.

A canonical domain can be edited in the profile. It changes the policy identity and therefore needs
the existing explicit policy review and version transition. Saving a canonical URL does not attach
a domain or create DNS records; guided setup must show that separate connection requirement.

## Storage and recovery

Logo derivatives are 512 × 512 transparent PNGs; sharing images are 1200 × 630 PNGs padded with
and flattened onto the chosen store background. Neither operation calls an AI provider or crops the
original. The source library retains original bytes and the existing rights-confirmation workflow.
The derivative is separately identified by its SHA-256, stored in private artwork storage, and
verified by hash on preparation, profile save/publication, and image reads. Public responses never
contain a storage URL or original filename. Draft previews require installation-admin access.

A staged database record and redacted audit precede immutable file creation. Readback reconciles an
uncertain write. Completion and its audit share a transaction; a failed final audit leaves the staged
file recoverable without another upload. Copies survive source-library removal. Only the currently
compiled logo/share paths are served by `/api/brand-assets/:hash.png`, with no-store responses.
Replacing the compiled reference removes public access to the old copy; previously shared/downloaded
copies cannot be recalled. Private retained versions are capped at 200; deletion of brand history is
an operator task outside this UI, so pending deployments cannot lose their images through cleanup.

The shared build validator permits the two original installation asset paths or prepared hash paths,
not arbitrary URLs or user-supplied SVG. Deployment verifies prepared bytes before saving the profile.
Builds keep paths rather than copying private originals into public output. Old saved drafts gain only
the three newly editable fields from the current installation. Other missing or unsupported fields
still fail. An old draft based on a different installed digest requires review and re-save.

## Verification

`brand-assets.test.ts` exercises auth, unpublished public denial, checksum/namespace checks,
source preservation/removal, private previews, interrupted writes, and deployed-reference changes.
`brand-assets.database.integration.test.ts` repeats preparation across fresh processes with a private
filesystem and isolated PostgreSQL, including an injected audit failure. Shared profile tests cover
old draft compatibility, managed-asset builds, forbidden asset overrides and domain-policy review.
The admin browser contract uploads and prepares both image roles, checks actual request bodies,
saves/reloads them, reviews the deployment payload and confirms draft paths remain publicly denied.
