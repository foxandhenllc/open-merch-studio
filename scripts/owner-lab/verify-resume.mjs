import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
const home = resolve("artifacts/private/owner-lab");
const origin = `http://127.0.0.1:${JSON.parse(readFileSync(join(home, "lab.json"))).port}`;
const code = readFileSync(join(home, "access-code"), "utf8");
const expected = JSON.parse(
  readFileSync(join(home, "evidence/verification.json")),
);
async function get(path) {
  const response = await fetch(`${origin}/api/admin${path}`, {
    headers: { "x-admin-access": code },
  });
  assert.equal(response.status, 200);
  return (await response.json()).data;
}
const orders = await get("/orders");
assert.equal(orders.length, expected.persistedOrders);
const profile = await get("/profile");
assert.equal(profile.active.fields["brand.displayName"], "Fox & Hen Rehearsal");
assert.equal((await get("/setup")).hosting.pending, false);
const hashes = {};
for (const order of orders) {
  const detail = await get(`/order-operations/${order.id}`);
  for (const print of detail.prints) {
    const response = await fetch(
      `${origin}/api/admin/order-operations/${order.id}/prints/${print.assetId}`,
      { headers: { "x-admin-access": code } },
    );
    assert.equal(response.status, 200);
    hashes[`${order.id}/${print.assetId}`] = createHash("sha256")
      .update(Buffer.from(await response.arrayBuffer()))
      .digest("hex");
  }
}
assert.equal(Object.keys(hashes).length, expected.restoredPrintFiles);
const image = await fetch(
  `${origin}${profile.active.fields["brand.logoPath"]}`,
);
assert.equal(image.status, 200);
writeFileSync(
  join(home, "evidence/restart-verification.json"),
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      orders: orders.length,
      savedPrintFiles: Object.keys(hashes).length,
      profileActive: true,
      publicLogoActive: true,
      printHashes: hashes,
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log(
  "Restart verified: reviewed profile, published logo, saved orders and all private print downloads survived.",
);
