import { createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';

const TOKEN_PREFIX = 'oma_';
const TOKEN_PATTERN = /^oma_[A-Za-z0-9_-]{43}$/;

type RuntimeGrant = {
  orderId: string;
  purpose: CustomerOrderAccessPurpose;
  revokedAt?: string;
};

const runtimeGrants = new Map<string, RuntimeGrant>();

const tokenHash = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex');

const createToken = (): string => `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;

export type CustomerOrderAccess = {
  orderId: string;
  token: string;
};

export type CustomerOrderAccessPurpose = 'browser' | 'email_order_received';

/**
 * Rotates one purpose-scoped customer credential and stores only its digest.
 *
 * Browser and email credentials rotate independently. This lets repeated Stripe-session exchanges
 * replace stale browser credentials without invalidating the durable link sent in the receipt.
 */
export async function issueCustomerOrderAccess(
  orderId: string,
  purpose: CustomerOrderAccessPurpose = 'browser'
): Promise<CustomerOrderAccess> {
  const token = createToken();
  const hash = tokenHash(token);
  if (env.databaseUrl) {
    await prisma.$transaction([
      prisma.orderAccessGrant.updateMany({
        where: { orderId, purpose, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.orderAccessGrant.create({ data: { orderId, tokenHash: hash, purpose } }),
    ]);
  } else {
    for (const [storedHash, grant] of runtimeGrants) {
      if (grant.orderId === orderId && grant.purpose === purpose && !grant.revokedAt) {
        runtimeGrants.delete(storedHash);
      }
    }
    runtimeGrants.set(hash, { orderId, purpose });
  }
  return { orderId, token };
}

/** Revokes one known bearer after a definite delivery failure without affecting other channels. */
export async function revokeCustomerOrderAccessToken(
  orderId: string,
  token: string
): Promise<boolean> {
  if (!TOKEN_PATTERN.test(token)) return false;
  const hash = tokenHash(token);
  if (env.databaseUrl) {
    const result = await prisma.orderAccessGrant.updateMany({
      where: { orderId, tokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count === 1;
  }
  const grant = runtimeGrants.get(hash);
  if (!grant || grant.orderId !== orderId || grant.revokedAt) return false;
  runtimeGrants.set(hash, { ...grant, revokedAt: new Date().toISOString() });
  return true;
}

export async function customerOrderAccessIsValid(
  orderId: string,
  token: string | undefined
): Promise<boolean> {
  if (!token || !TOKEN_PATTERN.test(token)) return false;
  const hash = tokenHash(token);
  if (env.databaseUrl) {
    const grant = await prisma.orderAccessGrant.findUnique({ where: { tokenHash: hash } });
    if (!grant || grant.orderId !== orderId || grant.revokedAt) return false;
    await prisma.orderAccessGrant.update({
      where: { id: grant.id },
      data: { lastUsedAt: new Date() },
    });
    return true;
  }
  const grant = runtimeGrants.get(hash);
  return Boolean(grant && grant.orderId === orderId && !grant.revokedAt);
}

export async function revokeCustomerOrderAccess(orderId: string): Promise<number> {
  if (env.databaseUrl) {
    const result = await prisma.orderAccessGrant.updateMany({
      where: { orderId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }
  let revoked = 0;
  for (const [hash, grant] of runtimeGrants) {
    if (grant.orderId !== orderId || grant.revokedAt) continue;
    runtimeGrants.set(hash, { ...grant, revokedAt: new Date().toISOString() });
    revoked += 1;
  }
  return revoked;
}
