import { prisma } from '../config/database.js';
import { env } from '../config/env.js';

export type PublicStorefront = {
  organization: {
    name: string;
    slug: string;
    brand: {
      displayName: string;
      shortDescription?: string;
      logoUrl?: string;
      primaryColor: string;
      accentColor: string;
      websiteUrl?: string;
    };
  };
  storefront: { title: string; slug: string; publishedAt?: string };
  collection: { title: string; slug: string; description?: string; heroImageUrl?: string };
  products: Array<{
    id: string;
    title: string;
    slug: string;
    productTitle: string;
    variantName: string;
    defaultQuantity: number;
    placementCodes: string[];
    mockupUrl?: string;
  }>;
};

const validSlug = (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

export function assertStorefrontSlug(value: string, label = 'Slug'): string {
  const normalized = value.trim().toLowerCase();
  if (!validSlug(normalized) || normalized.length > 80) {
    throw new Error(`${label} must use lowercase letters, numbers, and single hyphens.`);
  }
  return normalized;
}

const publicUrl = (value: string | null | undefined): string | undefined => {
  if (!value) return undefined;
  if (value.startsWith('/')) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

const publicColor = (value: string | null | undefined, fallback: string): string =>
  value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;

const fixtureFoxHenStore: PublicStorefront = {
  organization: {
    name: 'Fox & Hen',
    slug: 'fox-and-hen',
    brand: {
      displayName: 'Fox & Hen',
      shortDescription: 'Web + Workflow Studio',
      logoUrl: '/examples/fox-and-hen/brand/fox-and-hen-logo-horizontal.svg',
      primaryColor: '#151b17',
      accentColor: '#c45a2a',
      websiteUrl: 'https://foxandhenllc.com',
    },
  },
  storefront: {
    title: 'One Clear System',
    slug: 'one-clear-system',
    publishedAt: '2026-09-01T00:00:00.000Z',
  },
  collection: {
    title: 'One Clear System',
    slug: 'one-clear-system',
    description: 'A five-piece studio collection built from the real Fox & Hen identity.',
    heroImageUrl: '/examples/fox-and-hen/collection-share.png',
  },
  products: [
    [
      'workbench-tee',
      'Workbench Tee',
      'Heavyweight Cotton Tee',
      'Black · L',
      'workbench-tee-01-product-view.png',
    ],
    [
      'studio-notes-tote',
      'Studio Notes Tote',
      'Everyday Canvas Tote',
      'Natural',
      'studio-notes-tote-01-product-view.png',
    ],
    [
      'connected-systems-mug',
      'Connected Systems Mug',
      'Classic Ceramic Mug',
      '11 oz',
      'connected-systems-mug-01-front-view-default.png',
    ],
    [
      'studio-mark-sticker',
      'Studio Mark Sticker',
      'Kiss-Cut Vinyl Sticker',
      '3 × 3 in',
      'studio-mark-sticker-01-product-view.png',
    ],
    [
      'system-map-poster',
      'System Map Poster',
      'Museum Matte Poster',
      '12 × 18 in',
      'system-map-poster.png',
    ],
  ].map(([slug, title, productTitle, variantName, mockup]) => ({
    id: `fixture-${slug}`,
    title,
    slug,
    productTitle,
    variantName,
    defaultQuantity: 1,
    placementCodes: slug === 'workbench-tee' ? ['front', 'back'] : ['default'],
    mockupUrl: `/examples/fox-and-hen/mockups/${mockup}`,
  })),
};

export async function getPublishedStorefront(
  organizationSlug: string,
  storefrontSlug: string
): Promise<PublicStorefront | null> {
  const organization = assertStorefrontSlug(organizationSlug, 'Organization slug');
  const storefront = assertStorefrontSlug(storefrontSlug, 'Storefront slug');
  const ownedFixture =
    organization === 'fox-and-hen' && storefront === 'one-clear-system' ? fixtureFoxHenStore : null;
  if (!env.databaseUrl) return ownedFixture;

  let record;
  try {
    record = await prisma.storefront.findFirst({
      where: {
        slug: storefront,
        status: 'published',
        organization: { slug: organization, status: 'active' },
      },
      include: {
        organization: { include: { brandProfile: true } },
        collection: {
          include: {
            products: {
              orderBy: { position: 'asc' },
              include: {
                savedProduct: { include: { product: true, variant: true } },
              },
            },
          },
        },
      },
    });
  } catch {
    // The owned reference storefront remains available while a new installation applies the
    // optional mini-store migration. Unknown stores never fall back to invented content.
    return ownedFixture;
  }
  if (!record) return ownedFixture;
  if (record.collection.status !== 'published') return null;
  const brand = record.organization.brandProfile;
  return {
    organization: {
      name: record.organization.name,
      slug: record.organization.slug,
      brand: {
        displayName: brand?.displayName ?? record.organization.name,
        shortDescription: brand?.shortDescription ?? undefined,
        logoUrl: publicUrl(brand?.logoUrl),
        primaryColor: publicColor(brand?.primaryColor, '#111111'),
        accentColor: publicColor(brand?.accentColor, '#d76732'),
        websiteUrl: publicUrl(brand?.websiteUrl),
      },
    },
    storefront: {
      title: record.title,
      slug: record.slug,
      publishedAt: record.publishedAt?.toISOString(),
    },
    collection: {
      title: record.collection.title,
      slug: record.collection.slug,
      description: record.collection.description ?? undefined,
      heroImageUrl: publicUrl(record.collection.heroImageUrl),
    },
    products: record.collection.products.flatMap(({ savedProduct }) =>
      savedProduct.status === 'active' &&
      savedProduct.product.isActive &&
      savedProduct.product.isSellable &&
      savedProduct.variant.isAvailable
        ? [
            {
              id: savedProduct.id,
              title: savedProduct.title,
              slug: savedProduct.slug,
              productTitle: savedProduct.product.title,
              variantName: savedProduct.variant.name,
              defaultQuantity: savedProduct.defaultQuantity,
              placementCodes: savedProduct.placementCodes,
              mockupUrl: publicUrl(savedProduct.mockupUrl),
            },
          ]
        : []
    ),
  };
}

export async function bootstrapStorefront(input: {
  organizationName: string;
  organizationSlug: string;
  displayName: string;
  shortDescription?: string;
  supportEmail?: string;
  websiteUrl?: string;
  collectionTitle: string;
  collectionSlug: string;
  storefrontTitle: string;
  storefrontSlug: string;
}) {
  if (!env.databaseUrl) throw new Error('A database is required to create an owner storefront.');
  const organizationSlug = assertStorefrontSlug(input.organizationSlug, 'Organization slug');
  const collectionSlug = assertStorefrontSlug(input.collectionSlug, 'Collection slug');
  const storefrontSlug = assertStorefrontSlug(input.storefrontSlug, 'Storefront slug');
  return prisma.$transaction(async (transaction) => {
    const organization = await transaction.organization.upsert({
      where: { slug: organizationSlug },
      update: { name: input.organizationName },
      create: { name: input.organizationName, slug: organizationSlug },
    });
    await transaction.brandProfile.upsert({
      where: { organizationId: organization.id },
      update: {
        displayName: input.displayName,
        shortDescription: input.shortDescription,
        supportEmail: input.supportEmail,
        websiteUrl: input.websiteUrl,
      },
      create: {
        organizationId: organization.id,
        displayName: input.displayName,
        shortDescription: input.shortDescription,
        supportEmail: input.supportEmail,
        websiteUrl: input.websiteUrl,
      },
    });
    const collection = await transaction.merchCollection.upsert({
      where: { organizationId_slug: { organizationId: organization.id, slug: collectionSlug } },
      update: { title: input.collectionTitle },
      create: {
        organizationId: organization.id,
        title: input.collectionTitle,
        slug: collectionSlug,
      },
    });
    const storefront = await transaction.storefront.upsert({
      where: { organizationId_slug: { organizationId: organization.id, slug: storefrontSlug } },
      update: { title: input.storefrontTitle, collectionId: collection.id },
      create: {
        organizationId: organization.id,
        collectionId: collection.id,
        title: input.storefrontTitle,
        slug: storefrontSlug,
      },
    });
    await transaction.auditLog.create({
      data: {
        action: 'storefront.bootstrap',
        target: storefront.id,
        metadata: { organizationId: organization.id, collectionId: collection.id },
      },
    });
    return {
      organizationId: organization.id,
      collectionId: collection.id,
      storefrontId: storefront.id,
    };
  });
}

export async function saveQuotedProduct(input: {
  organizationSlug: string;
  collectionSlug: string;
  quoteId: string;
  productId: string;
  variantId: string;
  designAssetId?: string;
  title: string;
  slug: string;
  mockupUrl?: string;
}) {
  if (!env.databaseUrl) throw new Error('A database is required to save owner products.');
  const productSlug = assertStorefrontSlug(input.slug, 'Product slug');
  const organization = await prisma.organization.findUnique({
    where: { slug: input.organizationSlug },
  });
  if (!organization) throw new Error('Organization not found.');
  const collection = await prisma.merchCollection.findUnique({
    where: { organizationId_slug: { organizationId: organization.id, slug: input.collectionSlug } },
  });
  if (!collection) throw new Error('Collection not found.');
  const quoteItem = await prisma.quoteItem.findFirst({
    where: {
      quoteId: input.quoteId,
      productId: input.productId,
      variantId: input.variantId,
      designAssetId: input.designAssetId,
    },
    include: { designAsset: true },
  });
  if (!quoteItem) throw new Error('The quoted product configuration was not found.');
  const sourceDesignAsset = quoteItem.designAsset;
  if (
    !sourceDesignAsset ||
    sourceDesignAsset.readinessStatus !== 'ready' ||
    sourceDesignAsset.policyStatus !== 'pass'
  ) {
    throw new Error('Only rights-cleared, print-ready artwork can be saved as an active product.');
  }
  return prisma.$transaction(async (transaction) => {
    const designSlug = `${productSlug}-design`;
    const savedDesign = await transaction.savedDesign.upsert({
      where: { organizationId_slug: { organizationId: organization.id, slug: designSlug } },
      update: { title: `${input.title} artwork`, status: 'active' },
      create: {
        organizationId: organization.id,
        title: `${input.title} artwork`,
        slug: designSlug,
      },
    });
    const latestVersion = await transaction.designVersion.aggregate({
      where: { savedDesignId: savedDesign.id },
      _max: { versionNumber: true },
    });
    const designVersion = await transaction.designVersion.create({
      data: {
        savedDesignId: savedDesign.id,
        designAssetId: sourceDesignAsset.id,
        versionNumber: (latestVersion._max.versionNumber ?? 0) + 1,
        rightsConfirmedAt: sourceDesignAsset.rightsConfirmedAt,
        provenance: {
          sourceType: sourceDesignAsset.sourceType,
          parentAssetIds: sourceDesignAsset.parentAssetIds,
          quoteId: input.quoteId,
        },
      },
    });
    const savedProduct = await transaction.savedProduct.upsert({
      where: { organizationId_slug: { organizationId: organization.id, slug: productSlug } },
      update: {
        title: input.title,
        productId: quoteItem.productId,
        variantId: quoteItem.variantId,
        designVersionId: designVersion.id,
        defaultQuantity: quoteItem.quantity,
        placementCodes: quoteItem.placementCodes,
        configuration: quoteItem.options ?? {},
        mockupUrl: input.mockupUrl,
        status: 'active',
      },
      create: {
        organizationId: organization.id,
        title: input.title,
        slug: productSlug,
        productId: quoteItem.productId,
        variantId: quoteItem.variantId,
        designVersionId: designVersion.id,
        defaultQuantity: quoteItem.quantity,
        placementCodes: quoteItem.placementCodes,
        configuration: quoteItem.options ?? {},
        mockupUrl: input.mockupUrl,
        status: 'active',
      },
    });
    const count = await transaction.collectionProduct.count({
      where: { collectionId: collection.id },
    });
    await transaction.collectionProduct.upsert({
      where: {
        collectionId_savedProductId: {
          collectionId: collection.id,
          savedProductId: savedProduct.id,
        },
      },
      update: {},
      create: { collectionId: collection.id, savedProductId: savedProduct.id, position: count },
    });
    await transaction.auditLog.create({
      data: {
        action: 'saved_product.upsert',
        target: savedProduct.id,
        metadata: { organizationId: organization.id, collectionId: collection.id },
      },
    });
    return { id: savedProduct.id, slug: savedProduct.slug, status: savedProduct.status };
  });
}

export async function publishStorefront(organizationSlug: string, storefrontSlug: string) {
  if (!env.databaseUrl) throw new Error('A database is required to publish a storefront.');
  const storefront = await prisma.storefront.findFirst({
    where: { slug: storefrontSlug, organization: { slug: organizationSlug } },
    include: {
      collection: {
        include: {
          products: {
            include: {
              savedProduct: {
                include: {
                  product: true,
                  variant: true,
                  designVersion: { include: { designAsset: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!storefront) throw new Error('Storefront not found.');
  if (!storefront.collection.products.length)
    throw new Error('Add at least one product before publishing.');
  const blocked = storefront.collection.products.some(
    ({ savedProduct }) =>
      savedProduct.status !== 'active' ||
      !savedProduct.product.isActive ||
      !savedProduct.product.isSellable ||
      !savedProduct.variant.isAvailable ||
      savedProduct.designVersion.designAsset.readinessStatus !== 'ready' ||
      savedProduct.designVersion.designAsset.policyStatus !== 'pass'
  );
  if (blocked)
    throw new Error('Every product must be available, active, rights-cleared, and print ready.');
  return prisma.$transaction([
    prisma.merchCollection.update({
      where: { id: storefront.collectionId },
      data: { status: 'published' },
    }),
    prisma.storefront.update({
      where: { id: storefront.id },
      data: { status: 'published', publishedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        action: 'storefront.publish',
        target: storefront.id,
        metadata: { organizationId: storefront.organizationId },
      },
    }),
  ]);
}
