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
