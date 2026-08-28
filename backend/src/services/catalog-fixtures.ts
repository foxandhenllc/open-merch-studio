import type { CatalogCategoryDto, CatalogProductDto } from '../types/catalog.js';

type FixtureProduct = CatalogProductDto & {
  categorySlug: string;
};

const defaultPlacements = (code = 'default', technique = 'digital') => [
  {
    code,
    displayName: code === 'front' ? 'Front print' : 'Default print area',
    technique,
    isDefault: true,
  },
];

export const sampleCatalog: {
  categories: CatalogCategoryDto[];
  products: FixtureProduct[];
} = {
  categories: [
    {
      id: 'fixture-category-apparel',
      title: 'Apparel',
      slug: 'apparel',
      imageUrl: null,
      isLaunchCategory: true,
    },
    {
      id: 'fixture-category-hats',
      title: 'Hats',
      slug: 'hats',
      imageUrl: null,
      isLaunchCategory: true,
    },
    {
      id: 'fixture-category-drinkware',
      title: 'Drinkware',
      slug: 'drinkware',
      imageUrl: null,
      isLaunchCategory: true,
    },
    {
      id: 'fixture-category-wall-art',
      title: 'Wall art',
      slug: 'wall-art',
      imageUrl: null,
      isLaunchCategory: true,
    },
    {
      id: 'fixture-category-bags',
      title: 'Bags',
      slug: 'bags',
      imageUrl: null,
      isLaunchCategory: true,
    },
    {
      id: 'fixture-category-stickers',
      title: 'Stickers',
      slug: 'stickers',
      imageUrl: null,
      isLaunchCategory: true,
    },
    {
      id: 'fixture-category-phone-cases',
      title: 'Phone cases',
      slug: 'phone-cases',
      imageUrl: null,
      isLaunchCategory: true,
    },
    {
      id: 'fixture-category-stationery',
      title: 'Stationery',
      slug: 'stationery',
      imageUrl: null,
      isLaunchCategory: true,
    },
  ],
  products: [
    {
      id: 'fixture-product-heavyweight-shirt',
      title: 'Heavyweight Cotton Tee',
      slug: 'heavyweight-cotton-shirt',
      type: 'apparel',
      brand: 'Fixture',
      description:
        'Premium 100% cotton with a relaxed, true-to-size fit — the everyday canvas for logos, art, and campaign drops.',
      thumbnailUrl: null,
      categorySlug: 'apparel',
      isSellable: true,
      variants: [
        {
          id: 'fixture-variant-shirt-black-m',
          name: 'Black / M',
          size: 'M',
          color: 'Black',
          colorCode: '#111827',
          imageUrl: null,
          isAvailable: true,
          costCents: 1450,
        },
        {
          id: 'fixture-variant-shirt-white-l',
          name: 'White / L',
          size: 'L',
          color: 'White',
          colorCode: '#f8fafc',
          imageUrl: null,
          isAvailable: true,
          costCents: 1450,
        },
      ],
      placements: [
        {
          code: 'front',
          displayName: 'Front print',
          technique: 'dtg',
          isDefault: true,
          width: 12,
          height: 16,
          additionalPriceCents: 595,
        },
        {
          code: 'back',
          displayName: 'Back print',
          technique: 'dtg',
          isDefault: false,
          width: 12,
          height: 16,
          additionalPriceCents: 595,
        },
      ],
    },
    {
      id: 'fixture-product-embroidered-cap',
      title: 'Structured Embroidered Cap',
      slug: 'structured-embroidered-cap',
      type: 'hat',
      brand: 'Fixture',
      description:
        'A six-panel cap with a flat front panel — built for crisp embroidered logos, badges, and short text.',
      thumbnailUrl: null,
      categorySlug: 'hats',
      isSellable: true,
      variants: [
        {
          id: 'fixture-variant-cap-navy',
          name: 'Navy',
          color: 'Navy',
          colorCode: '#172554',
          imageUrl: null,
          isAvailable: true,
          costCents: 1275,
        },
      ],
      placements: [
        {
          code: 'embroidery_front',
          displayName: 'Front embroidery',
          technique: 'embroidery',
          isDefault: true,
          width: 4,
          height: 2,
        },
      ],
    },
    {
      id: 'fixture-product-ceramic-mug',
      title: 'Classic Ceramic Mug',
      slug: 'ceramic-mug',
      type: 'drinkware',
      brand: 'Fixture',
      description:
        'A dishwasher-safe 11oz mug with a full wraparound print — a go-to gift and desk companion.',
      thumbnailUrl: null,
      categorySlug: 'drinkware',
      isSellable: true,
      variants: [
        {
          id: 'fixture-variant-mug-white-11oz',
          name: 'White / 11 oz',
          size: '11 oz',
          color: 'White',
          colorCode: '#ffffff',
          imageUrl: null,
          isAvailable: true,
          costCents: 830,
        },
      ],
      placements: defaultPlacements('default', 'sublimation'),
    },
    {
      id: 'fixture-product-matte-poster',
      title: 'Museum Matte Poster',
      slug: 'matte-poster',
      type: 'wall-art',
      brand: 'Fixture',
      description:
        'Gallery-grade matte paper with rich, fade-resistant color for art prints and event graphics.',
      thumbnailUrl: null,
      categorySlug: 'wall-art',
      isSellable: true,
      variants: [
        {
          id: 'fixture-variant-poster-12x18',
          name: '12 x 18 in',
          size: '12 x 18',
          imageUrl: null,
          isAvailable: true,
          costCents: 700,
        },
      ],
      placements: defaultPlacements('default', 'digital'),
    },
    {
      id: 'fixture-product-tote',
      title: 'Everyday Canvas Tote',
      slug: 'canvas-tote-bag',
      type: 'bag',
      brand: 'Fixture',
      description:
        'A sturdy cotton tote with a roomy print area — practical merch people actually carry every day.',
      thumbnailUrl: null,
      categorySlug: 'bags',
      isSellable: true,
      variants: [
        {
          id: 'fixture-variant-tote-natural',
          name: 'Natural',
          color: 'Natural',
          colorCode: '#d6c3a3',
          imageUrl: null,
          isAvailable: true,
          costCents: 1125,
        },
      ],
      placements: [
        {
          code: 'front',
          displayName: 'Front print',
          technique: 'dtg',
          isDefault: true,
          width: 10,
          height: 10,
          additionalPriceCents: 595,
        },
        {
          code: 'back',
          displayName: 'Back print',
          technique: 'dtg',
          isDefault: false,
          width: 10,
          height: 10,
          additionalPriceCents: 595,
        },
      ],
    },
    {
      id: 'fixture-product-vinyl-sticker',
      title: 'Kiss-Cut Vinyl Sticker',
      slug: 'kiss-cut-sticker',
      type: 'sticker',
      brand: 'Fixture',
      description:
        'Durable, weatherproof vinyl with a glossy finish — the easiest way to spread a logo or mascot.',
      thumbnailUrl: null,
      categorySlug: 'stickers',
      isSellable: true,
      variants: [
        {
          id: 'fixture-variant-sticker-3x3',
          name: '3 x 3 in',
          size: '3 x 3',
          imageUrl: null,
          isAvailable: true,
          costCents: 250,
        },
      ],
      placements: defaultPlacements('default', 'digital'),
    },
    {
      id: 'fixture-product-phone-case',
      title: 'Slim Snap Phone Case',
      slug: 'slim-phone-case',
      type: 'phone-case',
      brand: 'Fixture',
      description:
        'A lightweight snap-on case with edge-to-edge artwork and a smooth matte finish.',
      thumbnailUrl: null,
      categorySlug: 'phone-cases',
      isSellable: true,
      variants: [
        {
          id: 'fixture-variant-phone-case-iphone',
          name: 'iPhone compatible',
          imageUrl: null,
          isAvailable: true,
          costCents: 1025,
        },
      ],
      placements: defaultPlacements('default', 'sublimation'),
    },
    {
      id: 'fixture-product-notebook',
      title: 'Spiral-Bound Notebook',
      slug: 'spiral-notebook',
      type: 'stationery',
      brand: 'Fixture',
      description:
        'A wire-bound notebook with a fully custom cover — a handy giveaway or creator-bundle add-on.',
      thumbnailUrl: null,
      categorySlug: 'stationery',
      isSellable: true,
      variants: [
        {
          id: 'fixture-variant-notebook-ruled',
          name: 'Ruled pages',
          imageUrl: null,
          isAvailable: true,
          costCents: 900,
        },
      ],
      placements: defaultPlacements('default', 'digital'),
    },
  ],
};
