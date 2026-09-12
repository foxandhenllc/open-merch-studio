import { env } from '../config/env.js';
import { HttpError } from '../middleware.js';

type ConnectionField = {
  key: string;
  label: string;
  secret?: boolean;
  options?: string[];
  hint?: string;
};
type ConnectionDefinition = {
  id: string;
  name: string;
  purpose: string;
  accountUrl: string;
  fields: ConnectionField[];
};

export const providerConnections: ConnectionDefinition[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    purpose: 'Generate and revise artwork.',
    accountUrl: 'https://platform.openai.com/api-keys',
    fields: [
      { key: 'OPENAI_API_KEY', label: 'API key', secret: true },
      {
        key: 'OPENAI_PROJECT_ID',
        label: 'Project ID',
        secret: true,
        hint: 'Optional, when your key needs an explicit project.',
      },
      { key: 'OPENAI_ORG_ID', label: 'Organization ID', secret: true, hint: 'Optional.' },
      { key: 'ENABLE_LIVE_OPENAI', label: 'Use OpenAI for artwork', options: ['false', 'true'] },
    ],
  },
  {
    id: 'printful',
    name: 'Printful',
    purpose: 'Product catalog, previews, and reviewed fulfillment drafts.',
    accountUrl: 'https://developers.printful.com/',
    fields: [
      { key: 'PRINTFUL_API_KEY', label: 'Private token', secret: true },
      { key: 'PRINTFUL_STORE_ID', label: 'Store ID', secret: true },
      { key: 'ENABLE_LIVE_PRINTFUL', label: 'Use Printful', options: ['false', 'true'] },
      { key: 'PRINTFUL_WEBHOOK_PUBLIC_KEY', label: 'Webhook public key', secret: true },
      { key: 'PRINTFUL_WEBHOOK_SECRET', label: 'Webhook secret', secret: true },
    ],
  },
  {
    id: 'stripe',
    name: 'Stripe',
    purpose: 'Hosted payment and signed payment notifications.',
    accountUrl: 'https://dashboard.stripe.com/apikeys',
    fields: [
      { key: 'STRIPE_SECRET_KEY', label: 'Secret key', secret: true },
      { key: 'STRIPE_WEBHOOK_SECRET', label: 'Webhook signing secret', secret: true },
      { key: 'ENABLE_LIVE_STRIPE', label: 'Use Stripe', options: ['false', 'true'] },
    ],
  },
  {
    id: 'storage',
    name: 'Database & artwork storage',
    purpose: 'Save store settings, orders, and private artwork.',
    accountUrl: 'https://supabase.com/dashboard',
    fields: [
      { key: 'DATABASE_URL', label: 'PostgreSQL connection URL', secret: true },
      { key: 'SUPABASE_URL', label: 'Supabase project URL', secret: true },
      { key: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Supabase service role key', secret: true },
      { key: 'SUPABASE_STORAGE_BUCKET', label: 'Artwork bucket' },
      { key: 'SUPABASE_UPLOAD_BUCKET', label: 'Upload bucket' },
    ],
  },
  {
    id: 'email',
    name: 'Resend',
    purpose: 'Customer receipts and shipment messages after sender verification.',
    accountUrl: 'https://resend.com/api-keys',
    fields: [
      { key: 'RESEND_API_KEY', label: 'API key', secret: true },
      { key: 'RESEND_WEBHOOK_SECRET', label: 'Webhook signing secret', secret: true },
      {
        key: 'EMAIL_FROM',
        label: 'Verified sender',
        hint: 'Store Name <receipts@your-domain.com>',
      },
      { key: 'EMAIL_REPLY_TO', label: 'Reply-to email' },
      { key: 'EMAIL_PROVIDER', label: 'Email provider', options: ['fixture', 'resend'] },
      {
        key: 'TRANSACTIONAL_EMAILS_ENABLED',
        label: 'Send customer emails',
        options: ['false', 'true'],
      },
    ],
  },
];

/** Values are inspected server-side only. Even account IDs are represented as presence flags. */
function configuredValue(key: string): unknown {
  const values: Record<string, unknown> = {
    OPENAI_API_KEY: env.openaiApiKey,
    OPENAI_PROJECT_ID: env.openaiProjectId,
    OPENAI_ORG_ID: env.openaiOrganizationId,
    ENABLE_LIVE_OPENAI: env.enableLiveOpenAi,
    PRINTFUL_API_KEY: env.printfulApiKey,
    PRINTFUL_STORE_ID: env.printfulStoreId,
    ENABLE_LIVE_PRINTFUL: env.enableLivePrintful,
    PRINTFUL_WEBHOOK_PUBLIC_KEY: env.printfulWebhookPublicKey,
    PRINTFUL_WEBHOOK_SECRET: env.printfulWebhookSecret,
    STRIPE_SECRET_KEY: env.stripeSecretKey,
    STRIPE_WEBHOOK_SECRET: env.stripeWebhookSecret,
    ENABLE_LIVE_STRIPE: env.enableLiveStripe,
    DATABASE_URL: env.databaseUrl,
    SUPABASE_URL: env.supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: env.supabaseServiceRoleKey,
    SUPABASE_STORAGE_BUCKET: env.supabaseStorageBucket,
    SUPABASE_UPLOAD_BUCKET: env.supabaseUploadBucket,
    RESEND_API_KEY: env.resendApiKey,
    RESEND_WEBHOOK_SECRET: env.resendWebhookSecret,
    EMAIL_FROM: env.emailFrom,
    EMAIL_REPLY_TO: env.emailReplyTo,
    EMAIL_PROVIDER: env.emailProvider,
    TRANSACTIONAL_EMAILS_ENABLED: env.transactionalEmailsEnabled,
  };
  return values[key];
}

export function connectionSummaries() {
  return providerConnections.map((provider) => ({
    ...provider,
    fields: provider.fields.map((field) => ({
      ...field,
      configured: Boolean(configuredValue(field.key)),
      selection: field.options ? String(configuredValue(field.key)) : undefined,
    })),
  }));
}

export function validateConnectionUpdate(id: string, input: unknown) {
  const provider = providerConnections.find((item) => item.id === id);
  if (!provider) throw new HttpError('Unknown connection.', 404, 'unknown_connection');
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new HttpError('Enter connection values to save.', 400, 'invalid_connection');
  }
  const entries = Object.entries(input);
  if (!entries.length || entries.length > provider.fields.length) {
    throw new HttpError('Enter connection values to save.', 400, 'invalid_connection');
  }
  return entries.map(([key, value]) => {
    const field = provider.fields.find((item) => item.key === key);
    if (
      !field ||
      typeof value !== 'string' ||
      !value.trim() ||
      value.length > 4096 ||
      [...value].some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
      ) ||
      (field.options && !field.options.includes(value))
    ) {
      throw new HttpError(
        'A connection value is missing, unsupported, or too long.',
        400,
        'invalid_connection'
      );
    }
    if (key === 'DATABASE_URL' && !/^postgres(?:ql)?:\/\//.test(value)) {
      throw new HttpError('Enter a PostgreSQL connection URL.', 400, 'invalid_connection');
    }
    if (key === 'SUPABASE_URL') {
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        throw new HttpError('Enter an HTTPS project URL.', 400, 'invalid_connection');
      }
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
        throw new HttpError('Enter an HTTPS project URL.', 400, 'invalid_connection');
      }
    }
    return {
      key,
      value: value.trim(),
      type: field.secret ? ('sensitive' as const) : ('encrypted' as const),
    };
  });
}
