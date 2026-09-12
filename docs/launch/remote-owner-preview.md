# Private remote owner preview

Use this temporary QA bridge when the reviewer is on another computer and the persistent owner lab
is running locally. It is not a production hosting deployment. The existing production store and
its provider configuration are unchanged.

1. Start the persistent lab with `npm run owner:lab` using the Node version in `.nvmrc`.
2. Install Cloudflare's `cloudflared` CLI (`brew install cloudflared` on macOS).
3. In another terminal, run `npm run owner:lab:share`. Give the reviewer the printed HTTPS URL and
   their existing owner-lab access code, using a private channel for the code.
4. Keep both processes running and the Mac connected to the internet. The sharing process prevents
   idle system sleep on macOS; closing the lid or disconnecting the network can still interrupt it.
5. Stop sharing with Ctrl-C in the sharing terminal. Restarting creates a new URL and invalidates
   existing preview sessions. The saved lab database and private files remain in place.

The access gate protects every path, including storefront, admin, sample artwork, private storage,
and rehearsal controls. The code is exchanged for a Secure, HttpOnly, same-site cookie that expires
in eight hours. The admin still requests the same code for its own authorization. Cookies are sent
only on same-origin admin and private upload requests; the admin code is never sent to storage.

The bridge checks the public origin before forwarding mutations to the loopback-only lab and rewrites
local signed artwork URLs for the remote browser. It does not relax the backend's local rehearsal
guard or enable real providers. Sessions, code, tunnel metadata, and test evidence are not committed.

The reviewer can start at `/admin/` without a guided tour. `/lab/` provides sample artwork, persona
scenarios, and backup/recovery controls when wanted. Use sample customer details. AI, hosting changes,
payments, and fulfillment remain simulated, while settings, collections, uploads, and rehearsal
orders persist in the local lab.

A temporary Cloudflare URL depends on the connector process and is intended for testing:
[Quick Tunnel documentation](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/).
For a permanent V1 installation, follow `DEPLOYMENT.md` and the hosted acceptance gates instead.

## Verified checkpoint · September 12, 2026

The remote HTTPS preview was checked in a fresh Chromium browser at 1440px and 390px. Verification
covered wrong-code rejection, unauthenticated API/storage denial, successful gate and admin sign-in,
a model selection saved through the UI and retained after reload (then restored), a signed artwork
upload through the remote origin, private preview and saved order print retrieval, collections and
rehearsal guide access, and absence of browser requests to localhost. Screenshots were visually
reviewed. Synthetic upload bytes were removed after the check; the six existing rehearsal orders
were preserved. Evidence is private under `artifacts/private/owner-lab/evidence/remote-verification.json`.

Lint, type checking, the normal test suite, production build, the full responsive/policy/admin browser
suite, and gateway authorization tests passed. This checks the remote path from a fresh browser on
the Mac; the owner's independent Windows review is the next acceptance step.
