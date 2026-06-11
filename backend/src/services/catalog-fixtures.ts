import type { CatalogCategoryDto, CatalogProductDto } from '../types/catalog.js';

type FixtureProduct = CatalogProductDto & {
  categorySlug: string;
};

const defaultPlacements = (
  code = 'default',
  options: {
    displayName?: string;
    technique?: string;
    width?: number;
    height?: number;
  } = {}
) => [
  {
    code,
    displayName: options.displayName ?? (code === 'front' ? 'Front print' : 'Default print area'),
    technique: options.technique ?? 'dtg',
    isDefault: true,
    width: options.width,
    height: options.height,
  },
];

const paidBetaCategorySlugs = ['apparel', 'drinkware', 'wall-art', 'bags', 'stickers'];

const teeColorGroups = [
  {
    color: 'Black',
    colorCode: '#0c0c0c',
    imageUrl: 'https://files.cdn.printful.com/products/71/4016_1752236278.jpg',
    variants: [
      ['S', 4016, 1169],
      ['M', 4017, 1169],
      ['L', 4018, 1169],
      ['XL', 4019, 1169],
      ['2XL', 4020, 1369],
      ['3XL', 5295, 1569],
    ],
  },
  {
    color: 'White',
    colorCode: '#ffffff',
    imageUrl: 'https://files.cdn.printful.com/products/71/4011_1752236284.jpg',
    variants: [
      ['S', 4011, 1169],
      ['M', 4012, 1169],
      ['L', 4013, 1169],
      ['XL', 4014, 1169],
      ['2XL', 4015, 1369],
      ['3XL', 5294, 1569],
    ],
  },
  {
    color: 'Navy',
    colorCode: '#212642',
    imageUrl: 'https://files.cdn.printful.com/products/71/4111_1752236282.jpg',
    variants: [
      ['S', 4111, 1169],
      ['M', 4112, 1169],
      ['L', 4113, 1169],
      ['XL', 4114, 1169],
      ['2XL', 4115, 1369],
      ['3XL', 12874, 1569],
    ],
  },
  {
    color: 'Asphalt',
    colorCode: '#52514f',
    imageUrl: 'https://files.cdn.printful.com/products/71/4031_1752236278.jpg',
    variants: [
      ['S', 4031, 1169],
      ['M', 4032, 1169],
      ['L', 4033, 1169],
      ['XL', 4034, 1169],
      ['2XL', 4035, 1369],
      ['3XL', 5297, 1569],
    ],
  },
  {
    color: 'Athletic Heather',
    colorCode: '#cececc',
    imageUrl: 'https://files.cdn.printful.com/products/71/6948_1752236278.jpg',
    variants: [
      ['S', 6948, 1169],
      ['M', 6949, 1169],
      ['L', 6950, 1169],
      ['XL', 6951, 1169],
      ['2XL', 6952, 1369],
      ['3XL', 6953, 1569],
    ],
  },
  {
    color: 'Red',
    colorCode: '#d0071e',
    imageUrl: 'https://files.cdn.printful.com/products/71/4141_1752236283.jpg',
    variants: [
      ['S', 4141, 1169],
      ['M', 4142, 1169],
      ['L', 4143, 1169],
      ['XL', 4144, 1169],
      ['2XL', 4145, 1369],
      ['3XL', 5304, 1569],
    ],
  },
] as const;

const teeVariants = teeColorGroups.flatMap(({ color, colorCode, imageUrl, variants }) =>
  variants.map(([size, printfulVariantId, costCents]) => ({
    id: `printful-variant-${printfulVariantId}`,
    printfulVariantId,
    name: `${color} / ${size}`,
    size,
    color,
    colorCode,
    imageUrl,
    isAvailable: true,
    costCents,
  }))
);

const rawSampleCatalog: {
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
      printfulId: 71,
      title: 'Bella + Canvas 3001 Tee',
      slug: 'heavyweight-cotton-shirt',
      type: 'apparel',
      brand: 'Bella + Canvas',
      description:
        'Soft unisex jersey tee with a reliable Printful catalog variant matrix for paid-beta art drops.',
      thumbnailUrl: 'https://files.cdn.printful.com/products/71/4016_1752236278.jpg',
      categorySlug: 'apparel',
      isSellable: true,
      variants: teeVariants,
      placements: defaultPlacements('front', { width: 12, height: 16 }),
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
      printfulId: 19,
      title: 'White Glossy Mug',
      slug: 'ceramic-mug',
      type: 'drinkware',
      brand: 'Printful',
      description: 'Glossy white ceramic mug with wraparound sublimation artwork support.',
      thumbnailUrl: 'https://files.cdn.printful.com/products/19/1320_1663762583.jpg',
      categorySlug: 'drinkware',
      isSellable: true,
      variants: [
        {
          id: 'printful-variant-1320',
          printfulVariantId: 1320,
          name: 'White / 11 oz',
          size: '11 oz',
          color: 'White',
          colorCode: '#ffffff',
          imageUrl: 'https://files.cdn.printful.com/products/19/1320_1663762583.jpg',
          isAvailable: true,
          costCents: 595,
        },
        {
          id: 'printful-variant-4830',
          printfulVariantId: 4830,
          name: 'White / 15 oz',
          size: '15 oz',
          color: 'White',
          colorCode: '#ffffff',
          imageUrl: 'https://files.cdn.printful.com/products/19/4830_1519394046.jpg',
          isAvailable: true,
          costCents: 795,
        },
        {
          id: 'printful-variant-16586',
          printfulVariantId: 16586,
          name: 'White / 20 oz',
          size: '20 oz',
          color: 'White',
          colorCode: '#ffffff',
          imageUrl: 'https://files.cdn.printful.com/products/19/16586_1680616351.jpg',
          isAvailable: true,
          costCents: 950,
        },
      ],
      placements: defaultPlacements('default', {
        displayName: 'Wraparound print',
        technique: 'sublimation',
        width: 9,
        height: 3.5,
      }),
    },
    {
      id: 'fixture-product-matte-poster',
      printfulId: 1,
      title: 'Enhanced Matte Paper Poster',
      slug: 'matte-poster',
      type: 'wall-art',
      brand: 'Printful',
      description: 'Matte paper poster for art prints, event graphics, and decor-oriented drops.',
      thumbnailUrl: 'https://files.cdn.printful.com/products/1/3876_1527678813.jpg',
      categorySlug: 'wall-art',
      isSellable: true,
      variants: [
        {
          id: 'printful-variant-3876',
          printfulVariantId: 3876,
          name: '12 x 18 in',
          size: '12 x 18 in',
          imageUrl: 'https://files.cdn.printful.com/products/1/3876_1527678813.jpg',
          isAvailable: true,
          costCents: 1139,
        },
        {
          id: 'printful-variant-3877',
          printfulVariantId: 3877,
          name: '16 x 20 in',
          size: '16 x 20 in',
          imageUrl: 'https://files.cdn.printful.com/products/1/3877_1527678896.jpg',
          isAvailable: true,
          costCents: 1189,
        },
        {
          id: 'printful-variant-1',
          printfulVariantId: 1,
          name: '18 x 24 in',
          size: '18 x 24 in',
          imageUrl: 'https://files.cdn.printful.com/products/1/1_1527683474.jpg',
          isAvailable: true,
          costCents: 1289,
        },
        {
          id: 'printful-variant-2',
          printfulVariantId: 2,
          name: '24 x 36 in',
          size: '24 x 36 in',
          imageUrl: 'https://files.cdn.printful.com/products/1/2_1527678974.jpg',
          isAvailable: true,
          costCents: 1789,
        },
      ],
      placements: defaultPlacements('default', {
        displayName: 'Print file',
        technique: 'digital',
        width: 12,
        height: 18,
      }),
    },
    {
      id: 'fixture-product-tote',
      printfulId: 367,
      title: 'Organic Cotton Tote Bag',
      slug: 'canvas-tote-bag',
      type: 'bag',
      brand: 'Econscious',
      description:
        'Organic cotton tote with a practical front print area for logos, mascots, and simple art.',
      thumbnailUrl: 'https://files.cdn.printful.com/products/367/10457_1582200790.jpg',
      categorySlug: 'bags',
      isSellable: true,
      variants: [
        {
          id: 'printful-variant-10457',
          printfulVariantId: 10457,
          name: 'Black / One size',
          size: 'One size',
          color: 'Black',
          colorCode: '#101010',
          imageUrl: 'https://files.cdn.printful.com/products/367/10457_1582200790.jpg',
          isAvailable: true,
          costCents: 1556,
        },
        {
          id: 'printful-variant-10458',
          printfulVariantId: 10458,
          name: 'Oyster / One size',
          size: 'One size',
          color: 'Oyster',
          colorCode: '#edcea5',
          imageUrl: 'https://files.cdn.printful.com/products/367/10458_1642499411.jpg',
          isAvailable: true,
          costCents: 1556,
        },
      ],
      placements: defaultPlacements('front', { width: 10, height: 10 }),
    },
    {
      id: 'fixture-product-vinyl-sticker',
      printfulId: 358,
      title: 'Kiss-Cut Sticker',
      slug: 'kiss-cut-sticker',
      type: 'sticker',
      brand: 'Printful',
      description:
        'White kiss-cut sticker in small-format sizes for logos, mascots, and campaign marks.',
      thumbnailUrl: 'https://files.cdn.printful.com/products/358/10163_1553083889.jpg',
      categorySlug: 'stickers',
      isSellable: true,
      variants: [
        {
          id: 'printful-variant-10163',
          printfulVariantId: 10163,
          name: '3 x 3 in',
          size: '3 x 3 in',
          color: 'White',
          colorCode: '#ffffff',
          imageUrl: 'https://files.cdn.printful.com/products/358/10163_1553083889.jpg',
          isAvailable: true,
          costCents: 229,
        },
        {
          id: 'printful-variant-10164',
          printfulVariantId: 10164,
          name: '4 x 4 in',
          size: '4 x 4 in',
          color: 'White',
          colorCode: '#ffffff',
          imageUrl: 'https://files.cdn.printful.com/products/358/10164_1553083894.jpg',
          isAvailable: true,
          costCents: 249,
        },
        {
          id: 'printful-variant-10165',
          printfulVariantId: 10165,
          name: '5.5 x 5.5 in',
          size: '5.5 x 5.5 in',
          color: 'White',
          colorCode: '#ffffff',
          imageUrl: 'https://files.cdn.printful.com/products/358/10165_1553083897.jpg',
          isAvailable: true,
          costCents: 269,
        },
      ],
      placements: defaultPlacements('default', {
        displayName: 'Print file',
        technique: 'digital',
        width: 3,
        height: 3,
      }),
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
      placements: defaultPlacements(),
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
      placements: defaultPlacements(),
    },
  ],
};

export const sampleCatalog: {
  categories: CatalogCategoryDto[];
  products: FixtureProduct[];
} = {
  categories: rawSampleCatalog.categories.filter((category) =>
    paidBetaCategorySlugs.includes(category.slug)
  ),
  products: rawSampleCatalog.products.filter((product) =>
    product.categorySlug ? paidBetaCategorySlugs.includes(product.categorySlug) : false
  ),
};
