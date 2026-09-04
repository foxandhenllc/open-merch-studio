import { HttpError } from '../middleware.js';

/** Constructed only after server authentication; never from request claims or guest capabilities. */
export type VerifiedOwnerIdentity = Readonly<{ issuer: string; subject: string }>;
export type OwnerRole = 'viewer' | 'editor' | 'publisher' | 'owner';
export type OwnerAction = 'read' | 'edit-draft' | 'publish' | 'manage-members';

const roleActions: Record<OwnerRole, readonly OwnerAction[]> = {
  viewer: ['read'],
  editor: ['read', 'edit-draft'],
  publisher: ['read', 'edit-draft', 'publish'],
  owner: ['read', 'edit-draft', 'publish', 'manage-members'],
};

/** This is a role policy, not a write grant: mutations still require transaction/RLS checks. */
export function ownerRoleAllows(role: string, action: OwnerAction): role is OwnerRole {
  return Object.hasOwn(roleActions, role) && roleActions[role as OwnerRole].includes(action);
}

export type OwnerMembership = Readonly<{
  issuer: string;
  subject: string;
  organization: Readonly<{ id: string; slug: string; name: string; status: string }>;
  role: string;
  status: string;
  revokedAt: string | null;
}>;

/** Implementations must query fresh, issuer-scoped membership; legacy subject-only rows are unsafe. */
export interface OwnerMembershipReader {
  findMembership(
    identity: VerifiedOwnerIdentity,
    organizationSlug: string
  ): Promise<OwnerMembership | null>;
}

export type OwnerContext = Readonly<{
  organization: Readonly<{ id: string; slug: string; name: string }>;
  role: OwnerRole;
  readOnly: true;
}>;

export const ownerUnavailable = () =>
  new HttpError('Owner access is not available.', 503, 'owner_access_unavailable');
export const ownerUnauthenticated = () =>
  new HttpError('Owner sign-in is required.', 401, 'owner_auth_required');
const ownerNotFound = () =>
  new HttpError('Organization not found.', 404, 'owner_organization_not_found');

export async function readOwnerContext(
  reader: OwnerMembershipReader,
  identity: VerifiedOwnerIdentity,
  organizationSlug: string
): Promise<OwnerContext> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(organizationSlug) || organizationSlug.length > 80) {
    throw ownerNotFound();
  }
  let membership: OwnerMembership | null;
  try {
    membership = await reader.findMembership(identity, organizationSlug);
  } catch {
    // Repository/provider errors may contain connection strings or private row values.
    throw ownerUnavailable();
  }
  if (
    !membership ||
    membership.issuer !== identity.issuer ||
    membership.subject !== identity.subject ||
    membership.organization.slug !== organizationSlug ||
    membership.organization.status !== 'active' ||
    membership.status !== 'active' ||
    membership.revokedAt !== null ||
    !ownerRoleAllows(membership.role, 'read')
  ) {
    throw ownerNotFound();
  }
  // Explicit projection prevents future membership/private fields becoming part of the API.
  return {
    organization: {
      id: membership.organization.id,
      slug: membership.organization.slug,
      name: membership.organization.name,
    },
    role: membership.role,
    readOnly: true,
  };
}
