import { Prisma, PrismaClient } from '@prisma/client';
import {
  ownerUnavailable,
  type OwnerMembership,
  type OwnerMembershipReader,
} from './owner-access.js';

/** An explicit restricted credential is mandatory; the privileged application client is never used. */
export function openOwnerMembershipReader(
  databaseUrl: string
): OwnerMembershipReader & { close(): Promise<void> } {
  if (!databaseUrl.trim()) throw ownerUnavailable();
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } }, log: [] });
  return {
    close: () => client.$disconnect(),
    async findMembership(identity, organizationSlug) {
      try {
        return await client.$transaction(
          async (tx) => {
            await tx.$executeRaw`SET TRANSACTION READ ONLY`;
            await tx.$executeRaw`SET LOCAL statement_timeout = '4s'`;
            await assertRestrictedReader(tx);
            // Transaction-local values are bound parameters and disappear on commit/rollback in a pool.
            await tx.$queryRaw`SELECT
            set_config('oms.owner_issuer', ${identity.issuer}, true),
            set_config('oms.owner_subject', ${identity.subject}, true),
            set_config('oms.owner_organization_slug', ${organizationSlug}, true)`;
            const rows = await tx.$queryRaw<
              Array<{
                issuer: string;
                subject: string;
                id: string;
                slug: string;
                name: string;
                organizationStatus: string;
                role: string;
                status: string;
                revokedAt: Date | null;
              }>
            >`SELECT i.issuer, i.subject, o.id, o.slug, o.name, o.status AS "organizationStatus",
                     m.role, m.status, m."revokedAt"
              FROM public.owner_memberships m
              JOIN public.owner_identities i ON i.id = m."identityId"
              JOIN public.organizations o ON o.id = m."organizationId" AND o.slug = m."organizationSlug"
              WHERE i.issuer = ${identity.issuer} AND i.subject = ${identity.subject}
                AND o.slug = ${organizationSlug} AND i.status = 'active'
                AND o.status = 'active' AND m.status = 'active' AND m."revokedAt" IS NULL`;
            const row = rows[0];
            if (!row) return null;
            return {
              issuer: row.issuer,
              subject: row.subject,
              organization: {
                id: row.id,
                slug: row.slug,
                name: row.name,
                status: row.organizationStatus,
              },
              role: row.role,
              status: row.status,
              revokedAt: row.revokedAt?.toISOString() ?? null,
            } satisfies OwnerMembership;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 5000 }
        );
      } catch {
        // Never pass Prisma errors (which can contain query/connection/row details) to the API.
        throw ownerUnavailable();
      }
    },
  };
}

async function assertRestrictedReader(tx: Prisma.TransactionClient): Promise<void> {
  const [result] = await tx.$queryRaw<Array<{ safe: boolean }>>`SELECT (
    current_user = 'oms_owner_reader' AND session_user = current_user
    AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user
      AND (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication))
    AND NOT EXISTS (SELECT 1 FROM pg_auth_members WHERE member = (SELECT oid FROM pg_roles WHERE rolname = current_user))
    AND NOT has_schema_privilege(current_user, 'public', 'CREATE')
    AND (SELECT count(*) = 3 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname IN ('owner_identities', 'owner_memberships', 'organizations')
        AND c.relrowsecurity AND c.relowner <> (SELECT oid FROM pg_roles WHERE rolname = current_user))
    AND NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND (
        has_table_privilege(current_user, c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES')
        OR has_any_column_privilege(current_user, c.oid, 'INSERT,UPDATE,REFERENCES')))
  ) AS safe`;
  if (!result?.safe) throw ownerUnavailable();
}
