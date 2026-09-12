/** An explicit, loopback-only developer harness may persist simulated orders in PostgreSQL. */
export function ownerRehearsalEnabled(source: NodeJS.ProcessEnv = process.env): boolean {
  if (source.OMS_OWNER_REHEARSAL !== 'local-only') return false;
  try {
    const db = new URL(source.DATABASE_URL ?? '');
    const web = new URL(source.BACKEND_URL ?? '');
    return (
      source.NODE_ENV === 'development' &&
      !source.VERCEL &&
      db.hostname === '127.0.0.1' &&
      /^\/oms_owner_lab_[a-z0-9_]+$/.test(db.pathname) &&
      web.protocol === 'http:' &&
      web.hostname === '127.0.0.1' &&
      source.FRONTEND_URL === web.origin &&
      source.SUPABASE_URL === web.origin &&
      source.SUPABASE_SERVICE_ROLE_KEY === 'owner-lab-storage-only' &&
      [
        'ENABLE_LIVE_OPENAI',
        'ENABLE_LIVE_STRIPE',
        'ENABLE_LIVE_PRINTFUL',
        'ALLOW_LIVE_PAYMENTS',
        'ALLOW_LIVE_FULFILLMENT',
        'PRINTFUL_AUTO_CONFIRM_ORDERS',
        'TRANSACTIONAL_EMAILS_ENABLED',
      ].every((key) => source[key] === 'false') &&
      [
        'OPENAI_API_KEY',
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'PRINTFUL_API_KEY',
        'RESEND_API_KEY',
      ].every((key) => !source[key])
    );
  } catch {
    return false;
  }
}

/** This switch only hides preinstalled merchant content in the isolated first-owner rehearsal. */
export function emptyOwnerInstallation(): boolean {
  return (
    ownerRehearsalEnabled() &&
    process.env.OMS_LAB_START_EMPTY === '1' &&
    !process.env.OMS_MERCHANT_PROFILE
  );
}
