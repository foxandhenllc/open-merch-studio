import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  profileDraft,
  prepareProfilePublication,
} from "../packages/merchant-profile/index.mjs";

const root = resolve(".");
const scratch = mkdtempSync(join(tmpdir(), "oms-profile-rehearsal-"));
const base = JSON.parse(readFileSync("config/merchant.config.json", "utf8"));
const policy = JSON.parse(
  readFileSync(`config/${base.policies.contentFile}`, "utf8"),
);
const draft = profileDraft(base, policy);
Object.assign(draft.fields, {
  "brand.displayName": "Harbor Community Merch",
  "brand.shortName": "HCM",
  "brand.shortDescription": "Community artwork, made wearable.",
  "brand.colors.accent": "#315542",
  "brand.colors.background": "#f7f3e8",
  "brand.colors.foreground": "#20372e",
  "web.title": "Harbor Community Merch",
  "web.description": "An isolated store-profile build rehearsal.",
  "operator.legalName": "Example Fixtures LLC",
  "operator.disclosure": "Synthetic operator for an isolated test.",
  "operator.supportEmail": "help@example.org",
  "orders.prefix": "HCM",
  "email.senderName": "Harbor Community Merch",
  "pricing.marginLabel": "Harbor store margin",
});
draft.policyVersion = "fixture-admin-profile-v2";
for (const page of Object.values(draft.pages)) {
  page.summary = "Synthetic content for a local test, not a merchant policy.";
  page.sections = [
    {
      heading: "Local rehearsal",
      body: "This fixture confirms owner-provided text reaches the published page unchanged.",
    },
  ];
}
// Explicit test-only approval exercises the publication contract; no deployment or live provider is reachable.
const publication = prepareProfilePublication(draft, base, policy, true);
const environment = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  TMPDIR: process.env.TMPDIR,
  OMS_MERCHANT_PROFILE: JSON.stringify(publication),
  NODE_ENV: "production",
  VITE_PUBLIC_APP_MODE: "oss",
  VITE_ENABLE_LOCAL_FALLBACKS: "true",
  CHECKOUT_ACCESS_MODE: "closed",
  ENABLE_LIVE_OPENAI: "false",
  ENABLE_LIVE_PRINTFUL: "false",
  ENABLE_LIVE_STRIPE: "false",
  ALLOW_LIVE_PAYMENTS: "false",
  ALLOW_LIVE_FULFILLMENT: "false",
  PRINTFUL_AUTO_CONFIRM_ORDERS: "false",
  TRANSACTIONAL_EMAILS_ENABLED: "false",
  VITE_ENABLE_PUBLIC_CHECKOUT: "false",
  EMAIL_FROM: "Old Name <orders@example.org>",
};
async function run(args) {
  const child = spawn(process.execPath, args, {
    cwd: scratch,
    env: environment,
    stdio: "inherit",
  });
  const code = await new Promise((done) => child.once("exit", done));
  assert.equal(code, 0, `Rehearsal failed: ${args[0]}`);
}
try {
  // Only maintained source/config surfaces; no .env files, provider outputs, or database contents.
  for (const entry of [
    ".env.example",
    ".nvmrc",
    "package.json",
    "package-lock.json",
    "vercel.json",
    "config",
    "scripts",
    "packages/merchant-profile",
    "packages/collection-drafts",
    "backend/package.json",
    "backend/tsconfig.json",
    "backend/src",
    "backend/prisma",
    "frontend/package.json",
    "frontend/tsconfig.json",
    "frontend/tsconfig.node.json",
    "frontend/vite.config.ts",
    "frontend/index.html",
    "frontend/src",
    "frontend/scripts",
    "frontend/public",
  ]) {
    mkdirSync(dirname(join(scratch, entry)), { recursive: true });
    cpSync(join(root, entry), join(scratch, entry), { recursive: true });
  }
  // Exercise the documented fresh-checkout setup, not an invented local environment.
  for (const workspace of ["backend", "frontend"])
    cpSync(join(scratch, ".env.example"), join(scratch, workspace, ".env"));
  await run([process.env.npm_execpath, "ci", "--include=dev", "--no-audit"]);
  await run([process.env.npm_execpath, "run", "doctor"]);
  await run([process.env.npm_execpath, "run", "build"]);
  writeFileSync(
    join(scratch, "verify-profile.mjs"),
    `
    import assert from 'node:assert/strict';
    import { merchantConfig } from './backend/dist/generated/merchant-config.js';
    import { policyApproval } from './backend/dist/generated/policy-approval.js';
    import { env } from './backend/dist/config/env.js';
    import { renderCustomerEmail } from './backend/dist/services/customer-email-template.service.js';
    const installed = JSON.parse(process.env.OMS_MERCHANT_PROFILE);
    assert.deepEqual(merchantConfig, installed.config);
    assert.equal(env.supportEmail, 'help@example.org');
    assert.equal(env.emailFrom, 'Harbor Community Merch <orders@example.org>');
    assert.equal(env.checkoutAccessMode, 'closed');
    assert.equal(env.allowLivePayments, false);
    assert.equal(env.enableLiveOpenAi, false);
    assert.equal(policyApproval.approvedVersion, 'fixture-admin-profile-v2');
    assert.equal(merchantConfig.orders.prefix, 'HCM');
    assert.equal(merchantConfig.pricing.marginLabel, 'Harbor store margin');
    const email = renderCustomerEmail('order_received', {
      orderNumber: 'HCM-FIXTURE', support: { email: env.supportEmail }, items: [], shipments: [], totalCents: 2500, taxCents: 0, currency: 'usd',
    });
    assert.match(email.html, /Harbor Community Merch/);
    assert.match(email.text, /help@example.org/);
    console.log('Published profile reached compiled server identity, email settings, order prefix, pricing label, and policy acceptance.');
  `,
  );
  await run(["verify-profile.mjs"]);
  await run(["frontend/scripts/policy-profile-smoke.mjs"]);
  assert.equal(
    JSON.parse(
      readFileSync(join(scratch, "frontend/dist/manifest.webmanifest"), "utf8"),
    ).name,
    draft.fields["brand.displayName"],
  );
  assert.match(
    readFileSync(join(scratch, "frontend/dist/index.html"), "utf8"),
    /Harbor Community Merch/,
  );
  console.log(
    "Admin-published profile rehearsal passed; the source checkout was unchanged.",
  );
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
