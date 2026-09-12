import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const home = "artifacts/private/owner-lab";
const { origin } = JSON.parse(readFileSync(`${home}/remote-preview.json`));
const code = readFileSync(`${home}/access-code`, "utf8");
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const exercise = process.argv.includes("--exercise-private-save");
const errors = [],
  requests = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) =>
  requests.push({
    path: new URL(request.url()).pathname,
    origin: new URL(request.url()).origin,
    method: request.method(),
  }),
);
async function signIn() {
  await page.getByLabel("Admin access code").fill(code);
  await page.getByRole("button", { name: /Open store admin/ }).click();
  await page.getByRole("region", { name: "Next setup action" }).waitFor();
}
async function api(path, method = "GET", data) {
  const response = await context.request.fetch(origin + "/api/admin" + path, {
    method,
    headers: { origin, "x-admin-access": code },
    ...(data === undefined ? {} : { data }),
  });
  assert.ok(response.ok(), `${path}: ${response.status()}`);
  return (await response.json()).data;
}
async function emptyContent() {
  assert.equal((await api("/setup")).content.empty, true);
  const profile = await api("/profile");
  for (const [key, value] of Object.entries(profile.draft.fields))
    if (!key.startsWith("brand.colors."))
      assert.equal(value, "", `Unexpected owner content: ${key}`);
  assert.equal(profile.draft.policyVersion, "");
  assert.equal(profile.draft.policyDate, "");
  for (const value of Object.values(profile.draft.pages)) {
    assert.equal(value.summary, "");
    assert.equal(value.sections[0].body, "");
  }
  assert.equal((await api("/collections")).collections.length, 0);
  assert.equal((await api("/collection-artwork")).assets.length, 0);
  assert.equal((await api("/orders")).length, 0);
  assert.deepEqual((await api("/installation-progress")).completed, []);
  return profile;
}
try {
  assert.equal(
    (await context.request.get(origin + "/api/admin/setup")).status(),
    401,
  );
  await page.goto(origin + "/admin/");
  await page.getByLabel("Access code", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Open preview", exact: true }).click();
  await signIn();
  const original = await emptyContent();
  if (exercise) {
    assert.equal(
      original.revision,
      0,
      "Private-save exercise must start on a pristine lab.",
    );
    await page
      .getByRole("region", { name: "Next setup action" })
      .getByRole("button", { name: "Continue with this step →" })
      .click();
    await page
      .getByLabel("Store name", { exact: true })
      .fill("Private save verification");
    const savedResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/admin/profile") &&
        r.request().method() === "PUT",
    );
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    const response = await savedResponse;
    assert.equal(response.status(), 200);
    const saved = (await response.json()).data;
    await page.reload();
    await signIn();
    assert.equal(
      (await api("/profile")).draft.fields["brand.displayName"],
      "Private save verification",
    );
    const publish = await context.request.post(
      origin + "/api/admin/profile/publish",
      {
        headers: { origin, "x-admin-access": code },
        data: {
          revision: saved.revision,
          digest: saved.digest,
          approved: true,
        },
      },
    );
    assert.equal(
      publish.status(),
      400,
      "An unfinished profile must never publish.",
    );
    // Optimistic revision protects edits from another owner session. Never overwrite a newer save.
    await api("/profile", "PUT", {
      draft: original.draft,
      revision: saved.revision,
      baseDigest: saved.activeDigest,
    });
    await emptyContent();
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto(origin + "/admin/");
    await signIn();
    assert.ok(
      (await page.getByText("NEXT · STEP 1 OF 8", { exact: false }).count()) ||
        (await page
          .getByRole("region", { name: "Next setup action" })
          .isVisible()),
    );
    await page.screenshot({
      path: `${home}/evidence/blank-owner-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      true,
    );
    await page
      .getByRole("region", { name: "Next setup action" })
      .getByRole("button", { name: "Continue with this step →" })
      .click();
    await page.getByLabel("Store name", { exact: true }).waitFor();
    assert.equal(
      await page.getByLabel("Store name", { exact: true }).inputValue(),
      "",
    );
    await page.screenshot({
      path: `${home}/evidence/blank-profile-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.goto(origin + "/");
    await page
      .getByRole("heading", { name: "Your storefront starts here." })
      .waitFor();
    const start = requests.length;
    await page.goto(origin + "/examples/streamer");
    await page
      .getByRole("heading", { name: "Late games. Good people." })
      .waitFor();
    await page.locator(".night-hero > img").evaluate((image) => image.decode());
    await page.screenshot({
      path: `${home}/evidence/streamer-store-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      true,
    );
    await page
      .getByRole("link", { name: "Open the read-only admin →" })
      .click();
    await page
      .getByRole("heading", { name: "How this store came together." })
      .waitFor();
    await page.getByRole("heading", { name: "No store published." }).waitFor();
    const sequence = page.getByRole("region", {
      name: "Streamer setup sequence",
    });
    for (let step = 0; step < 6; step++)
      await sequence
        .getByRole("button", { name: "Next step →", exact: true })
        .click();
    assert.equal(
      await sequence.getByRole("button", { name: "Next step →" }).isDisabled(),
      true,
    );
    const sections = page.getByRole("navigation", {
      name: "Read-only admin sections",
    });
    for (const label of [
      "Store profile",
      "Collections",
      "Connections",
      "Artwork & limits",
      "Installation",
      "Orders & review",
    ]) {
      await sections.getByRole("button", { name: label, exact: true }).click();
      await page
        .getByRole("region", { name: `${label} example values`, exact: true })
        .waitFor();
    }
    await page.locator(".night-hero > img").evaluate((image) => image.decode());
    await page.screenshot({
      path: `${home}/evidence/streamer-admin-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      true,
    );
    assert.equal(
      requests
        .slice(start)
        .filter((request) => request.path.startsWith("/api/")).length,
      0,
      "The read-only example must not call the merchant API.",
    );
    assert.equal(
      requests.slice(start).filter((request) => request.method !== "GET")
        .length,
      0,
    );
  }
  await emptyContent();
  assert.deepEqual(errors, []);
  assert.equal(
    requests.filter((request) => /127\.0\.0\.1|localhost/.test(request.origin))
      .length,
    0,
  );
  writeFileSync(
    `${home}/evidence/blank-streamer-verification${exercise ? "-exercise" : ""}.json`,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        origin,
        emptyOwnerContent: true,
        privateSaveExercised: exercise,
        readOnlyExampleWithoutApiCalls: true,
        setupSteps: 8,
        streamerSteps: 7,
        viewports: [1440, 390],
        providerCalls: 0,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(
    "Verified blank owner data, guided entry, unfinished private save/publication boundary (when requested), separate read-only streamer walkthrough, desktop and mobile, no provider calls.",
  );
} finally {
  await browser.close();
}
