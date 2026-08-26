import dotenv from 'dotenv';

dotenv.config();

const numberFromEnv = (name: string, fallback: number): number => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

const booleanFromValue = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const booleanFromEnv = (name: string, fallback = false): boolean =>
  booleanFromValue(process.env[name], fallback);

export type CheckoutAccessMode = 'closed' | 'allowlist' | 'public';
export type EmailProvider = 'fixture' | 'resend';

export const checkoutAccessModeFromEnv = (value?: string): CheckoutAccessMode => {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'allowlist' || normalized === 'public' ? normalized : 'closed';
};

export const checkoutAllowedEmailsFromEnv = (value?: string): string[] =>
  (value || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export const emailProviderFromEnv = (value?: string): EmailProvider =>
  value?.trim().toLowerCase() === 'resend' ? 'resend' : 'fixture';

const normalizedOrigin = (value: string): string => value.trim().replace(/\/+$/, '');

export const transactionalEmailSettingsFromEnv = (source: NodeJS.ProcessEnv) => ({
  enabled: booleanFromValue(source.TRANSACTIONAL_EMAILS_ENABLED, false),
  provider: emailProviderFromEnv(source.EMAIL_PROVIDER),
  from: source.EMAIL_FROM?.trim() || undefined,
  replyTo: source.EMAIL_REPLY_TO?.trim() || undefined,
  supportEmail: source.SUPPORT_EMAIL?.trim() || 'support@openmerchstudio.com',
  resendApiKey: source.RESEND_API_KEY?.trim() || undefined,
  resendWebhookSecret: source.RESEND_WEBHOOK_SECRET?.trim() || undefined,
});

export const backendUrlFromEnv = (source: NodeJS.ProcessEnv): string => {
  if (source.BACKEND_URL) return normalizedOrigin(source.BACKEND_URL);
  const vercelHost = source.VERCEL_PROJECT_PRODUCTION_URL || source.VERCEL_URL;
  return vercelHost ? `https://${vercelHost}` : 'http://localhost:5001';
};

export const frontendUrlFromEnv = (source: NodeJS.ProcessEnv): string =>
  normalizedOrigin(source.FRONTEND_URL || 'http://localhost:5173');

const transactionalEmail = transactionalEmailSettingsFromEnv(process.env);

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: numberFromEnv('PORT', 5001),
  frontendUrl: frontendUrlFromEnv(process.env),
  backendUrl: backendUrlFromEnv(process.env),
  databaseUrl: process.env.DATABASE_URL,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'open-merch-artwork',
  supabaseUploadBucket: process.env.SUPABASE_UPLOAD_BUCKET || 'open-merch-uploads',
  uploadMaxBytes: numberFromEnv('UPLOAD_MAX_BYTES', 20 * 1024 * 1024),
  uploadMaxFilesPerSession: numberFromEnv('UPLOAD_MAX_FILES_PER_SESSION', 12),
  uploadRetentionDays: numberFromEnv('UPLOAD_RETENTION_DAYS', 30),
  printfulApiKey: process.env.PRINTFUL_API_KEY,
  printfulStoreId: process.env.PRINTFUL_STORE_ID,
  printfulSellingRegion: process.env.PRINTFUL_SELLING_REGION || 'north_america',
  printfulCuratedProductIds: (process.env.PRINTFUL_CURATED_PRODUCT_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  printfulMaxLaunchProducts: numberFromEnv('PRINTFUL_MAX_LAUNCH_PRODUCTS', 6),
  printfulMockupTimeoutMs: numberFromEnv('PRINTFUL_MOCKUP_TIMEOUT_MS', 180000),
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiOrganizationId:
    process.env.OPENAI_ORG_ID?.trim() || process.env.OPENAI_ORGANIZATION_ID?.trim() || undefined,
  openaiProjectId: process.env.OPENAI_PROJECT_ID?.trim() || undefined,
  openaiDesignModel: process.env.OPENAI_DESIGN_MODEL || 'gpt-image-2',
  openaiTextModel: process.env.OPENAI_TEXT_MODEL || 'gpt-5-nano',
  removeBgApiKey: process.env.REMOVE_BG_API_KEY,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  transactionalEmailsEnabled: transactionalEmail.enabled,
  emailProvider: transactionalEmail.provider,
  emailFrom: transactionalEmail.from,
  emailReplyTo: transactionalEmail.replyTo,
  supportEmail: transactionalEmail.supportEmail,
  resendApiKey: transactionalEmail.resendApiKey,
  resendWebhookSecret: transactionalEmail.resendWebhookSecret,
  adminAccessCode: process.env.ADMIN_ACCESS_CODE,
  allowLivePayments: booleanFromEnv('ALLOW_LIVE_PAYMENTS', false),
  checkoutAccessMode: checkoutAccessModeFromEnv(process.env.CHECKOUT_ACCESS_MODE),
  checkoutAllowedEmails: checkoutAllowedEmailsFromEnv(process.env.CHECKOUT_ALLOWED_EMAILS),
  allowLiveFulfillment: booleanFromEnv('ALLOW_LIVE_FULFILLMENT', false),
  printfulAutoConfirmOrders: booleanFromEnv('PRINTFUL_AUTO_CONFIRM_ORDERS', false),
  defaultCurrency: process.env.DEFAULT_CURRENCY || 'USD',
  targetMarginPercent: numberFromEnv('TARGET_MARGIN_PERCENT', 30),
  minMarginCents: numberFromEnv('MIN_MARGIN_CENTS', 500),
  aiDesignFeeCents: numberFromEnv('AI_DESIGN_FEE_CENTS', 300),
  paymentFeePercent: numberFromEnv('PAYMENT_FEE_PERCENT', 2.9),
  paymentFeeFixedCents: numberFromEnv('PAYMENT_FEE_FIXED_CENTS', 30),
  studioPassPriceCents: numberFromEnv('STUDIO_PASS_PRICE_CENTS', 500),
  studioPassEnabled: booleanFromEnv('STUDIO_PASS_ENABLED', false),
  freeDraftLimit: numberFromEnv('FREE_DRAFT_LIMIT', 3),
  dailyAiBudgetCents: numberFromEnv('DAILY_AI_BUDGET_CENTS', 2500),
  perSessionBudgetCents: numberFromEnv('PER_SESSION_AI_BUDGET_CENTS', 800),
  removeBgEstimatedCostCents: numberFromEnv('REMOVE_BG_ESTIMATED_COST_CENTS', 200),
  enableLiveOpenAi: booleanFromEnv('ENABLE_LIVE_OPENAI', false),
  enableLiveStripe: booleanFromEnv('ENABLE_LIVE_STRIPE', false),
  enableLivePrintful: booleanFromEnv('ENABLE_LIVE_PRINTFUL', false),
  checkoutEnabled: booleanFromEnv('CHECKOUT_ENABLED', true),
  fulfillmentEnabled: booleanFromEnv('FULFILLMENT_ENABLED', false),
};
