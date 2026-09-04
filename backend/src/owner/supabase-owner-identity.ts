import { createClient } from '@supabase/supabase-js';
import {
  ownerUnauthenticated,
  ownerUnavailable,
  type VerifiedOwnerIdentity,
} from './owner-access.js';

export type OwnerIdentityVerifier = (token: string) => Promise<VerifiedOwnerIdentity>;

export function ownerBearerToken(authorization: string | undefined): string {
  // Reject multiple credentials and whitespace; no cookie, query, admin-code or session fallback.
  const match = authorization?.match(/^Bearer ([A-Za-z0-9._~+/-]+=*)$/i);
  if (!match || match[1].length > 8192) throw ownerUnauthenticated();
  return match[1];
}

/** No environment fallback: activation must explicitly supply the verified Auth project and key. */
export function createSupabaseOwnerVerifier(settings: {
  url: string;
  publishableKey: string;
  fetch?: typeof globalThis.fetch;
}): OwnerIdentityVerifier {
  const url = new URL(settings.url);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    !settings.publishableKey.trim()
  )
    throw new Error('Owner Auth requires an HTTPS project origin and a publishable key.');
  const issuer = `${url.origin}/auth/v1`;
  const transport = settings.fetch ?? globalThis.fetch;
  const client = createClient(url.origin, settings.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) =>
        transport(input, {
          ...init,
          redirect: 'error',
          signal: AbortSignal.timeout(5000),
        }),
    },
  });
  return async (token) => {
    ownerBearerToken(`Bearer ${token}`);
    // Explicit JWT argument bypasses SDK session storage; getUser verifies with Auth on every call.
    let result;
    try {
      result = await client.auth.getUser(token);
    } catch {
      throw ownerUnavailable();
    }
    if (result.error) {
      if (
        result.error.status === 401 ||
        result.error.status === 403 ||
        result.error.status === 400
      ) {
        throw ownerUnauthenticated();
      }
      throw ownerUnavailable();
    }
    const user = result.data.user;
    const bannedUntil = user?.banned_until ? Date.parse(user.banned_until) : 0;
    if (
      !user ||
      typeof user.id !== 'string' ||
      !user.id.trim() ||
      user.is_anonymous !== false ||
      user.deleted_at ||
      !Number.isFinite(bannedUntil) ||
      bannedUntil > Date.now()
    )
      throw ownerUnauthenticated();
    // Email and all metadata are deliberately discarded; they cannot establish membership.
    return Object.freeze({ issuer, subject: user.id });
  };
}
