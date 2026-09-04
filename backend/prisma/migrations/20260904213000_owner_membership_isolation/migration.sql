BEGIN;

-- A migration grants no login and promotes no legacy subject-only memberships.
-- Fail on a conflicting role name rather than inheriting unknown privileges.
CREATE ROLE oms_owner_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO oms_owner_reader;

CREATE TABLE public.owner_identities (
  id TEXT PRIMARY KEY,
  issuer TEXT NOT NULL CHECK (issuer <> '' AND issuer = btrim(issuer)),
  subject TEXT NOT NULL CHECK (subject <> '' AND subject = btrim(subject)),
  status TEXT NOT NULL DEFAULT 'disabled' CHECK (status IN ('active', 'disabled')),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "owner_identities_issuer_subject_key" ON public.owner_identities(issuer, subject);
CREATE UNIQUE INDEX "organizations_id_slug_key" ON public.organizations(id, slug);

CREATE TABLE public.owner_memberships (
  id TEXT PRIMARY KEY,
  "identityId" TEXT NOT NULL REFERENCES public.owner_identities(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "organizationId" TEXT NOT NULL,
  "organizationSlug" TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor', 'publisher', 'owner')),
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'revoked')),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT owner_membership_revocation CHECK (
    (status = 'revoked' AND "revokedAt" IS NOT NULL) OR
    (status <> 'revoked' AND "revokedAt" IS NULL)
  ),
  CONSTRAINT "owner_memberships_organizationId_organizationSlug_fkey"
    FOREIGN KEY ("organizationId", "organizationSlug") REFERENCES public.organizations(id, slug)
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "owner_memberships_organizationId_identityId_key"
  ON public.owner_memberships("organizationId", "identityId");
CREATE INDEX "owner_memberships_identityId_organizationSlug_idx"
  ON public.owner_memberships("identityId", "organizationSlug");

ALTER TABLE public.owner_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_identities, public.owner_memberships FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.organizations, public.organization_members, public.brand_profiles,
  public.saved_designs, public.design_versions, public.saved_products, public.merch_collections,
  public.collection_products, public.storefronts FROM PUBLIC, anon, authenticated;

GRANT SELECT (id, issuer, subject, status) ON public.owner_identities TO oms_owner_reader;
GRANT SELECT ("identityId", "organizationId", "organizationSlug", role, status, "revokedAt")
  ON public.owner_memberships TO oms_owner_reader;
GRANT SELECT (id, slug, name, status) ON public.organizations TO oms_owner_reader;

-- An acyclic policy graph: identity -> membership -> organization. No SECURITY DEFINER escape.
-- Missing or cleared transaction settings compare unequal and therefore deny access.
CREATE POLICY owner_identity_read ON public.owner_identities FOR SELECT TO oms_owner_reader
USING (
  status = 'active'
  AND issuer = current_setting('oms.owner_issuer', true)
  AND subject = current_setting('oms.owner_subject', true)
);
CREATE POLICY owner_membership_read ON public.owner_memberships FOR SELECT TO oms_owner_reader
USING (
  status = 'active' AND "revokedAt" IS NULL
  AND "organizationSlug" = current_setting('oms.owner_organization_slug', true)
  AND EXISTS (SELECT 1 FROM public.owner_identities i WHERE i.id = "identityId")
);
CREATE POLICY owner_organization_read ON public.organizations FOR SELECT TO oms_owner_reader
USING (
  status = 'active'
  AND slug = current_setting('oms.owner_organization_slug', true)
  AND EXISTS (SELECT 1 FROM public.owner_memberships m WHERE m."organizationId" = organizations.id)
);

-- No INSERT/UPDATE/DELETE grants or policies, even for an application-level owner.
-- Draft/publication writes require a separate transaction and audit design.
COMMIT;
