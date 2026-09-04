import type { PublicStorefront } from '../types/storefront';

export function localStorefront(
  organizationSlug: string,
  storefrontSlug: string
): PublicStorefront | null {
  if (organizationSlug !== 'fox-and-hen' || storefrontSlug !== 'one-clear-system') return null;
  return {
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
      ['workbench-tee', 'Workbench Tee', 'Heavyweight Cotton Tee', 'Black · L', 'workbench-tee-01-product-view.png'],
      ['studio-notes-tote', 'Studio Notes Tote', 'Everyday Canvas Tote', 'Natural', 'studio-notes-tote-01-product-view.png'],
      ['connected-systems-mug', 'Connected Systems Mug', 'Classic Ceramic Mug', '11 oz', 'connected-systems-mug-01-front-view-default.png'],
      ['studio-mark-sticker', 'Studio Mark Sticker', 'Kiss-Cut Vinyl Sticker', '3 × 3 in', 'studio-mark-sticker-01-product-view.png'],
      ['system-map-poster', 'System Map Poster', 'Museum Matte Poster', '12 × 18 in', 'system-map-poster.png'],
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
}
