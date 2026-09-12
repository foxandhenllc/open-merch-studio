export function labEnvironment({
  databaseUrl,
  origin,
  code,
  instance,
  variables = [],
  startEmpty = false,
}) {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: process.env.TMPDIR,
    NODE_ENV: "development",
    OMS_OWNER_REHEARSAL: "local-only",
    OMS_LAB_START_EMPTY: startEmpty ? "1" : "",
    VITE_OWNER_START_EMPTY:
      startEmpty &&
      !variables.some((item) => item.key === "OMS_MERCHANT_PROFILE")
        ? "true"
        : "false",
    DATABASE_URL: databaseUrl,
    BACKEND_URL: origin,
    FRONTEND_URL: origin,
    SUPABASE_URL: origin,
    SUPABASE_SERVICE_ROLE_KEY: "owner-lab-storage-only",
    SUPABASE_UPLOAD_BUCKET: "open-merch-uploads",
    ADMIN_ACCESS_CODE: code,
    OMS_LAB_INSTANCE: instance,
    ENABLE_LIVE_OPENAI: "false",
    ENABLE_LIVE_STRIPE: "false",
    ENABLE_LIVE_PRINTFUL: "false",
    ALLOW_LIVE_PAYMENTS: "false",
    ALLOW_LIVE_FULFILLMENT: "false",
    PRINTFUL_AUTO_CONFIRM_ORDERS: "false",
    TRANSACTIONAL_EMAILS_ENABLED: "false",
    OPENAI_API_KEY: "",
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: "",
    PRINTFUL_API_KEY: "",
    RESEND_API_KEY: "",
    CHECKOUT_ACCESS_MODE: "closed",
    CHECKOUT_ENABLED: "true",
    FULFILLMENT_ENABLED: "false",
    VITE_ENABLE_PUBLIC_CHECKOUT: "true",
    VITE_ENABLE_LOCAL_FALLBACKS: "false",
    VITE_PUBLIC_APP_MODE: "oss",
    VERCEL_ENV: "production",
    VERCEL_PROJECT_ID: "prj_ownerlab",
    OMS_SETUP_VERCEL_TOKEN: "lab-hosting-only",
    OMS_SETUP_VERCEL_PROJECT_ID: "prj_ownerlab",
    OMS_SETUP_VERCEL_TEAM_ID: "team_ownerlab",
    OMS_SETUP_DEPLOY_HOOK_URL:
      "https://api.vercel.com/v1/integrations/deploy/prj_ownerlab/localHook",
    ...Object.fromEntries(
      variables
        .filter((item) =>
          ["OMS_MERCHANT_PROFILE", "OMS_CONNECTIONS_REVISION"].includes(
            item.key,
          ),
        )
        .map((item) => [item.key, item.value]),
    ),
  };
}
