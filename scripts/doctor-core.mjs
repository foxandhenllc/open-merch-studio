const truthy = (value) =>
  ["1", "true", "yes", "on"].includes(String(value ?? "").toLowerCase());
const present = (source, name) => Boolean(String(source[name] ?? "").trim());
const validUrl = (value) => {
  try {
    const url = new URL(String(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const check = (label, ok, detail) => ({
  label,
  status: ok ? "pass" : "fail",
  detail,
});

/** Returns redacted diagnostics: messages may name variables but never include their values. */
export function diagnoseConfiguration(source, runtime = process.versions) {
  const checks = [];
  const nodeMajor = Number(String(runtime.node ?? "").split(".")[0]);
  checks.push(
    check(
      "Node.js",
      nodeMajor === 22,
      "Use the Node 22 version declared in .nvmrc.",
    ),
  );
  checks.push(
    check(
      "Frontend URL",
      !present(source, "FRONTEND_URL") || validUrl(source.FRONTEND_URL),
      "FRONTEND_URL must be an HTTP(S) URL when set.",
    ),
  );
  checks.push(
    check(
      "Backend URL",
      !present(source, "BACKEND_URL") || validUrl(source.BACKEND_URL),
      "BACKEND_URL must be an HTTP(S) URL when set.",
    ),
  );

  const databaseReady = present(source, "DATABASE_URL");
  const openAiEnabled = truthy(source.ENABLE_LIVE_OPENAI);
  const stripeEnabled = truthy(source.ENABLE_LIVE_STRIPE);
  const printfulEnabled = truthy(source.ENABLE_LIVE_PRINTFUL);
  const emailEnabled = truthy(source.TRANSACTIONAL_EMAILS_ENABLED);
  const paymentsEnabled = truthy(source.ALLOW_LIVE_PAYMENTS);
  const fulfillmentEnabled = truthy(source.ALLOW_LIVE_FULFILLMENT);

  checks.push(
    check(
      "OpenAI provider",
      !openAiEnabled || present(source, "OPENAI_API_KEY"),
      "ENABLE_LIVE_OPENAI requires OPENAI_API_KEY.",
    ),
  );
  checks.push(
    check(
      "Stripe provider",
      !stripeEnabled ||
        (present(source, "STRIPE_SECRET_KEY") &&
          present(source, "STRIPE_WEBHOOK_SECRET") &&
          databaseReady),
      "Live Stripe requires STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and DATABASE_URL.",
    ),
  );
  checks.push(
    check(
      "Printful provider",
      !printfulEnabled || present(source, "PRINTFUL_API_KEY"),
      "ENABLE_LIVE_PRINTFUL requires PRINTFUL_API_KEY.",
    ),
  );
  checks.push(
    check(
      "Transactional email",
      !emailEnabled ||
        (source.EMAIL_PROVIDER === "resend" &&
          present(source, "RESEND_API_KEY") &&
          present(source, "EMAIL_FROM")),
      "Transactional email requires EMAIL_PROVIDER=resend, RESEND_API_KEY, and EMAIL_FROM.",
    ),
  );
  checks.push(
    check(
      "Payment authorization",
      !paymentsEnabled ||
        (stripeEnabled &&
          databaseReady &&
          source.CHECKOUT_ACCESS_MODE !== "closed"),
      "Live payments require Stripe, DATABASE_URL, and an explicit non-closed CHECKOUT_ACCESS_MODE.",
    ),
  );
  checks.push(
    check(
      "Fulfillment authorization",
      !fulfillmentEnabled || (printfulEnabled && databaseReady),
      "Live fulfillment requires Printful and DATABASE_URL.",
    ),
  );
  checks.push(
    check(
      "Manual fulfillment review",
      !truthy(source.PRINTFUL_AUTO_CONFIRM_ORDERS),
      "Keep PRINTFUL_AUTO_CONFIRM_ORDERS=false until a separately approved production design exists.",
    ),
  );

  return {
    mode:
      paymentsEnabled || fulfillmentEnabled
        ? "live-authorized"
        : openAiEnabled || stripeEnabled || printfulEnabled
          ? "providers-configured"
          : "fixture-ready",
    checks,
    ok: checks.every(({ status }) => status === "pass"),
  };
}
