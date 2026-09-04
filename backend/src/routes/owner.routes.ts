import { Router } from 'express';
import { asyncHandler } from '../middleware.js';
import {
  ownerUnavailable,
  readOwnerContext,
  type OwnerMembershipReader,
} from '../owner/owner-access.js';
import { ownerBearerToken, type OwnerIdentityVerifier } from '../owner/supabase-owner-identity.js';

/** Dependencies are supplied only by trusted server composition, never by flags or request data. */
export function createOwnerRouter(dependencies?: {
  verifyIdentity: OwnerIdentityVerifier;
  memberships: OwnerMembershipReader;
}) {
  const router = Router();
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.vary('Authorization');
    next();
  });
  router.get(
    '/organizations/:organizationSlug/context',
    asyncHandler(async (req, res) => {
      const token = ownerBearerToken(req.header('authorization'));
      // No legacy Prisma or fixture fallback. The issuer-aware database boundary must ship first.
      if (!dependencies) throw ownerUnavailable();
      const identity = await dependencies.verifyIdentity(token);
      const context = await readOwnerContext(
        dependencies.memberships,
        identity,
        req.params.organizationSlug
      );
      res.json({ success: true, data: context });
    })
  );
  router.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Owner route not found.' });
  });
  return router;
}
