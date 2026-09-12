import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { chromium } from "playwright";
const home = resolve("artifacts/private/owner-lab");
const origin = `http://127.0.0.1:${JSON.parse(readFileSync(join(home, "lab.json"))).port}`;
const code = readFileSync(join(home, "access-code"), "utf8");
const evidence = join(home, "evidence");
mkdirSync(evidence, { recursive: true });
async function admin(path, method = "GET", body) {
  const response = await fetch(`${origin}/api/admin${path}`, {
    method,
    headers: { "x-admin-access": code, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  assert.equal(response.ok, true, `${path}: ${result.error}`);
  return result.data;
}
const setup = await admin("/setup");
assert.equal(setup.settings.storage, "database");
assert.equal(setup.hosting.available, true);
async function upload(name) {
  const bytes = readFileSync(join(home, "samples", `${name}.png`));
  const auth = await admin("/collection-artwork/authorize", "POST", {
    filename: `${name}.png`,
    contentType: "image/png",
    byteSize: bytes.length,
    rightsConfirmed: true,
  });
  assert.equal(
    (
      await fetch(auth.signedUrl, {
        method: "PUT",
        body: bytes,
        headers: { "content-type": "image/png" },
      })
    ).ok,
    true,
  );
  await admin(`/collection-artwork/${auth.assetId}/complete`, "POST", {});
  return auth.assetId;
}
let state = await admin("/collections");
const scenarios = [
  {
    key: "community",
    title: "Community drop · generated variations",
    mode: "generate",
    product: "shirt",
  },
  {
    key: "artist",
    title: "Artist show · original artwork",
    mode: "fixed",
    product: "matte-poster",
  },
  {
    key: "coffee",
    title: "Coffee club · your artwork",
    mode: "upload",
    product: "ceramic-mug",
  },
  {
    key: "local",
    title: "Local maker · inspired designs",
    mode: "reference",
    product: "tote",
  },
];
const seeded = [];
for (const scenario of scenarios) {
  const existing = state.collections.find(
    (entry) => entry.title === scenario.title,
  );
  if (existing) {
    seeded.push({ ...scenario, id: existing.id });
    continue;
  }
  const assetId = await upload(scenario.key);
  const product = state.catalog.find((item) =>
    item.id.endsWith(scenario.product),
  );
  const placement = product.placements[0].code;
  const item = {
    id: randomUUID(),
    title: `${scenario.key} edition`,
    productId: product.id,
    variantId: product.variants[0].id,
    placementCodes: [placement],
    artworkMode: scenario.mode,
    targetPriceCents: 3500,
    artwork: [{ placementCode: placement, assetId }],
  };
  const collection = {
    id: randomUUID(),
    title: scenario.title,
    description:
      "Local owner rehearsal. Supplied sample artwork, synthetic prices and simulated ordering; review real supplier templates before selling.",
    purpose: "community",
    items: [item],
  };
  state = await admin("/collections", "PUT", {
    revision: state.revision,
    collections: [...state.collections, collection],
  });
  const printWidths = [
    { itemId: item.id, placementCode: placement, widthInches: 4 },
  ];
  const review = await admin(
    `/collection-publications/${collection.id}/review`,
    "POST",
    { draftRevision: state.revision, printWidths },
  );
  assert.equal(review.ready, true, review.issues.join(" "));
  const status = await admin("/collection-publications");
  const publication = await admin(
    `/collection-publications/${collection.id}/publish`,
    "POST",
    {
      draftRevision: state.revision,
      publicationRevision: status.revision,
      digest: review.digest,
      printWidths,
      templateConfirmed: true,
      contentConfirmed: true,
      publicPreviewConfirmed: true,
    },
  );
  await admin(
    `/collection-publications/${collection.id}/print-layouts`,
    "PUT",
    {
      version: publication.version,
      revision: 0,
      layouts: [
        {
          itemId: item.id,
          placementCode: placement,
          templateWidthInches: 8,
          templateHeightInches: 10,
          leftInches: 2,
          topInches: 2,
        },
      ],
      templateConfirmed: true,
    },
  );
  const sales = await admin(
    `/collection-publications/${collection.id}/sales`,
    "POST",
    {
      version: publication.version,
      layoutRevision: 1,
      enabled: true,
      reviewed: true,
    },
  );
  assert.equal(sales.commerceMode, "fixture");
  seeded.push({ ...scenario, id: collection.id });
}
writeFileSync(
  join(evidence, "scenarios.json"),
  JSON.stringify(seeded, null, 2),
);
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  context.setDefaultTimeout(15000);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const signIn = async () => {
    await page.getByLabel("Admin access code").fill(code);
    await page.getByRole("button", { name: "Open store admin" }).click();
    await page
      .getByRole("heading", { name: "Store overview", exact: true })
      .waitFor();
  };
  await page.goto(`${origin}/admin/`);
  await signIn();
  await page
    .getByRole("navigation", { name: "Store administration" })
    .getByRole("button", { name: /Store profile$/ })
    .click();
  await page
    .getByLabel("Store name", { exact: true })
    .fill("Fox & Hen Rehearsal");
  await page.getByLabel("Store initials").fill("F&H");
  await page
    .getByLabel("Short description", { exact: true })
    .fill("Your community. Your artwork. Your store.");
  const slot = page.getByRole("region", { name: "Store logo", exact: true });
  await slot.locator("summary").first().click();
  if (
    !(await slot
      .getByRole("button", { name: "Detach artwork", exact: true })
      .count())
  ) {
    await slot.getByText("Upload an original image", { exact: true }).click();
    await slot
      .getByLabel("Artwork file", { exact: true })
      .setInputFiles(join(home, "samples/local.png"));
    await slot.getByRole("checkbox", { name: /I have permission/ }).check();
    await slot
      .getByRole("button", { name: "Upload and attach", exact: true })
      .click();
    await slot
      .getByRole("button", { name: "Detach artwork", exact: true })
      .waitFor();
  }
  await slot
    .getByRole("button", { name: "Use as store logo", exact: true })
    .click();
  await slot
    .getByRole("img", { name: "Store logo draft", exact: true })
    .waitFor();
  await slot.locator("summary").first().click();
  await page.getByRole("button", { name: "Policy pages", exact: true }).click();
  const policyVersion = `local-owner-${Date.now()}`;
  await page.getByLabel("Policy version", { exact: true }).fill(policyVersion);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page
    .locator(".profile-editor")
    .getByRole("status")
    .filter({ hasText: "Draft saved" })
    .waitFor();
  await page
    .getByRole("button", { name: "Review & publish", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: /I reviewed all five pages/ })
    .check();
  await page
    .getByRole("button", { name: "Publish saved profile", exact: true })
    .click();
  await page
    .locator(".profile-editor")
    .getByRole("status")
    .filter({ hasText: "Profile saved to hosting" })
    .waitFor();
  await admin("/deployment", "POST", {});
  await new Promise((done) => setTimeout(done, 1500));
  // A bounded readiness poll handles the real local rebuild; no provider polling is involved.
  for (let count = 0; count < 60; count++) {
    try {
      const profile = await admin("/profile");
      if (
        profile.active.fields["brand.displayName"] === "Fox & Hen Rehearsal" &&
        profile.active.policyVersion === policyVersion
      )
        break;
    } catch {}
    if (count === 59) throw new Error("Reviewed profile did not activate.");
    await new Promise((done) => setTimeout(done, 1000));
  }
  await page.goto(`${origin}/collections/`);
  await page
    .getByText("Fox & Hen Rehearsal", { exact: true })
    .first()
    .waitFor();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto(`${origin}/lab/`);
    await page.screenshot({
      path: join(evidence, `guide-${width}.png`),
      fullPage: true,
    });
    const selected = seeded.find((entry) => entry.mode === "upload");
    await page.goto(`${origin}/collections/${selected.id}`);
    await page
      .getByRole("spinbutton", { name: `Quantity · coffee edition` })
      .fill("1");
    const uploadRegion = page.getByRole("region", {
      name: "Personalize coffee edition",
    });
    await uploadRegion
      .getByLabel("Original artwork", { exact: true })
      .setInputFiles(join(home, "samples/coffee.png"));
    await uploadRegion.getByRole("checkbox").check();
    await uploadRegion.getByRole("button", { name: "Use my original" }).click();
    await uploadRegion.getByText(/Artwork selected for this product/).waitFor();
    await page
      .getByRole("button", { name: "Review order", exact: true })
      .click();
    await page
      .getByRole("region", { name: "Saved print previews" })
      .getByRole("img")
      .waitFor();
    await page
      .getByLabel("Email for your receipt")
      .fill("owner-test@example.test");
    await page
      .getByRole("checkbox", { name: /I reviewed my saved print previews/ })
      .check();
    await page.screenshot({
      path: join(evidence, `purchase-${width}.png`),
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page
      .getByRole("button", { name: "Complete simulated checkout" })
      .click();
    await page.waitForURL("**/order/**");
    await page.screenshot({
      path: join(evidence, `order-${width}.png`),
      fullPage: true,
    });
  }
  assert.deepEqual(errors, []);
  const before = await admin("/orders");
  async function printHashes(orders) {
    const hashes = {};
    for (const order of orders) {
      const detail = await admin(`/order-operations/${order.id}`);
      for (const print of detail.prints) {
        const url = `${origin}/api/admin/order-operations/${order.id}/prints/${print.assetId}`;
        assert.equal((await fetch(url)).status, 401);
        const response = await fetch(url, {
          headers: { "x-admin-access": code },
        });
        assert.equal(response.status, 200);
        hashes[`${order.id}/${print.assetId}`] = createHash("sha256")
          .update(Buffer.from(await response.arrayBuffer()))
          .digest("hex");
      }
    }
    assert.ok(Object.keys(hashes).length >= 2);
    return hashes;
  }
  const savedPrintHashes = await printHashes(before);
  const controls = async (action) => {
    const response = await fetch(`${origin}/lab/${action}`, {
      method: "POST",
      headers: { "x-lab-code": code },
    });
    const result = await response.json();
    assert.equal(response.ok, true, result.error);
    return result;
  };
  await controls("backup");
  const settings = (await admin("/setup")).settings;
  await admin("/store-settings", "PATCH", {
    revision: settings.revision,
    values: { dailyAiBudgetCents: settings.values.dailyAiBudgetCents + 100 },
  });
  const restore = await controls("restore");
  assert.equal(
    (await admin("/setup")).settings.values.dailyAiBudgetCents,
    settings.values.dailyAiBudgetCents,
  );
  const after = await admin("/orders");
  assert.deepEqual(after, before);
  assert.deepEqual(await printHashes(after), savedPrintHashes);
  await page.goto(`${origin}/admin/`);
  await signIn();
  await page
    .getByRole("navigation", { name: "Store administration" })
    .getByRole("button", { name: /Orders & review$/ })
    .click();
  await page
    .getByRole("button", { name: /^Review order / })
    .first()
    .click();
  await page
    .getByRole("heading", { name: "Saved collection prints", exact: true })
    .waitFor();
  await page.screenshot({
    path: join(evidence, "restored-orders-390.png"),
    fullPage: true,
  });
  writeFileSync(
    join(evidence, "verification.json"),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        scenarios: seeded.length,
        viewportWidths: [1440, 390],
        persistedOrders: after.orders?.length ?? after.length,
        restoredPrintFiles: Object.keys(savedPrintHashes).length,
        restore: restore.message,
        providerCalls: "disabled",
      },
      null,
      2,
    ),
  );
  console.log(
    "Owner lab: profile activation, private uploads, simulated orders and isolated restore verified.",
  );
} finally {
  await browser.close();
}
