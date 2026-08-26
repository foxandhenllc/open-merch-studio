# Uploaded and Reference Artwork Flow

**Status:** Live on `openmerchstudio.com` as of August 26, 2026

**Commerce:** Public browsing, design, quote, and mockup flow; checkout and fulfillment closed

## Customer Paths

1. **Use my artwork** uploads one PNG, JPEG, or WebP and prepares it without generative image changes. Optional background removal is explicit.
2. **Use references** privately uploads up to five images, then passes them with the customer prompt to a new image-generation request.
3. **Create with AI** retains the prompt-only flow. Creating a variation now edits the selected image and preserves the prior draft in history.

Every upload requires an explicit confirmation that the customer owns or has permission to use the image. A reference-only asset can never be checked out directly.

## Storage and Processing

- The browser first requests an upload authorization from the OMS API.
- Production returns a two-hour Supabase signed upload URL so the original bypasses Vercel's request-body limit.
- Originals and WebP previews live in the private `open-merch-uploads` bucket.
- Sharp validates the decoder input, applies EXIF rotation, records dimensions and SHA-256, and creates a normalized PNG plus a bounded WebP preview.
- A random-path print PNG is written to the existing public `open-merch-artwork` bucket because Printful must fetch it to build mockups and fulfill an eventual order.
- Direct uploaded artwork carries no AI design allocation in the quote. Product margin remains unchanged.

The production Content Security Policy allows signed transfers only to the exact OMS Supabase project origin. The service-role credential stays server-side.

## Ownership, Retention, and Cleanup

`design_assets` records the guest studio session, source/purpose, storage paths, original metadata, parent references, rights timestamp, and retention deadline. Cross-session asset reads and edits are rejected.

Unpurchased uploaded assets default to 30-day retention. Removing an unused reference and choosing **Start fresh** both request cleanup. Upload authorization also opportunistically removes expired, unquoted assets. Ordered assets and assets still referenced by a derived design are preserved.

## Print Readiness

- Under 600 px on the shortest side: blocked.
- 600–1199 px: retained with a soft-print warning.
- 1200 px or more: resolution check passes.
- Placement, preparation, rights, policy, and background-removal results are stored alongside the asset.

The current checks are conservative pixel gates, not a substitute for product-specific DPI/crop tooling. Product-specific crop, bleed, safe-area, and enlargement controls are a logical later improvement.

## Verification

- Backend tests cover direct preparation, low-resolution blocking, required rights, revision history, and source-aware pricing.
- Playwright covers all three creation paths, rights gating, multi-reference input, persistence/failure behavior, and responsive fit across 11 viewports.
- `npm run smoke:live-upload` verifies signed private upload, normalization, public derivative retrieval, and cleanup.
- `npm run smoke:deployed-upload` verifies the deployed UI through a decoded Printful mockup and can assert that checkout remains closed.
