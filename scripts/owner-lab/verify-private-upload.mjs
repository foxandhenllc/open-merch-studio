import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { labEnvironment } from "./environment.mjs";
const home = resolve("artifacts/private/owner-lab");
const config = JSON.parse(readFileSync(join(home, "lab.json")));
const code = readFileSync(join(home, "access-code"), "utf8");
const origin = `http://127.0.0.1:${config.port}`;
const databaseUrl = `postgresql://oms_lab:${encodeURIComponent(code)}@127.0.0.1:${config.pgPort}/oms_owner_lab_${config.active.replaceAll("-", "_")}`;
const environment = labEnvironment({
  databaseUrl,
  origin,
  code,
  instance: join(home, "instances", config.active),
});
for (const key of Object.keys(process.env))
  if (!(key in environment)) delete process.env[key];
Object.assign(process.env, environment);
const realFetch = fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  assert.equal(
    url.origin,
    origin,
    "Private upload verification cannot call an external provider.",
  );
  return realFetch(input, init);
};
async function post(path, body) {
  const response = await fetch(`${origin}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const envelope = await response.json();
  assert.equal(response.ok, true, envelope.error);
  return envelope.data;
}
const session = await post("/api/design/sessions", {});
const image = readFileSync(join(home, "samples/artist.png"));
const auth = await post("/api/design/uploads/authorize", {
  sessionId: session.id,
  filename: "Artist original.png",
  contentType: "image/png",
  byteSize: image.length,
  purpose: "print",
});
assert.equal(
  (
    await fetch(auth.signedUrl, {
      method: "PUT",
      body: image,
      headers: { "content-type": "image/png" },
    })
  ).ok,
  true,
);
const draft = await post(`/api/design/uploads/${auth.assetId}/complete`, {
  sessionId: session.id,
  rightsConfirmed: true,
  placementCodes: ["front"],
});
assert.ok(draft.imageUrl.includes("/object/sign/"));
assert.equal(
  (await fetch(`${origin}/api/design/assets/${draft.id}.png`)).status,
  404,
);
assert.equal(
  (await fetch(`${origin}/api/design/drafts/${draft.id}`)).status,
  404,
);
assert.equal(
  (
    await fetch(
      `${origin}/api/design/drafts/${draft.id}?sessionId=another-session`,
    )
  ).status,
  404,
);
assert.equal(
  (
    await fetch(
      `${origin}/api/design/drafts/${draft.id}?sessionId=${session.id}`,
    )
  ).status,
  200,
);
const { prisma } = await import("../../backend/dist/config/database.js");
try {
  const asset = await prisma.designAsset.findUniqueOrThrow({
    where: { id: draft.id },
  });
  assert.equal(asset.imageUrl, null);
  assert.equal(asset.transparentUrl, null);
  assert.equal(asset.printStoragePath, `private-uploads/${draft.id}/print.png`);
  const { privateUploadPrintUrl } =
    await import("../../backend/dist/services/private-upload-print.js");
  const url = await privateUploadPrintUrl(asset);
  assert.ok(url.includes("/object/sign/"));
  assert.equal((await fetch(url)).status, 200);
  const { resolvePrintfulArtworkUrls } =
    await import("../../backend/dist/services/printful-order-recovery.service.js");
  const urls = await resolvePrintfulArtworkUrls({ designAssetId: draft.id });
  assert.equal((await fetch(urls[draft.id])).status, 200);
  const { checkoutDesignIssue } =
    await import("../../backend/dist/services/checkout-validation.service.js");
  assert.equal(
    checkoutDesignIssue({ ...asset, privatePrintAvailable: true }),
    null,
  );
  const beforeFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const request = new Request(input, init);
    return request.method === "DELETE"
      ? Promise.resolve(
          Response.json({ message: "Interrupted cleanup" }, { status: 503 }),
        )
      : beforeFetch(request);
  };
  const { deleteArtworkUpload } =
    await import("../../backend/dist/services/uploaded-artwork.service.js");
  await assert.rejects(
    deleteArtworkUpload({ assetId: draft.id, sessionId: session.id }),
  );
  assert.ok(await prisma.designAsset.findUnique({ where: { id: draft.id } }));
  globalThis.fetch = beforeFetch;
  console.log(
    "General uploads: private original and print, session-scoped previews, durable checkout state and fresh signed provider access verified.",
  );
} finally {
  await prisma.$disconnect();
}
