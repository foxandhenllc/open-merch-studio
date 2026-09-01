export type ExampleProduct = {
  id: string;
  name: string;
  product: string;
  description: string;
  suggestedRetail: string;
  placement: string;
  costNote: string;
  mockupImage: string;
  reverseMockupImage?: string;
  mockupClass: string;
};

const assetRoot = '/examples/fox-and-hen';

export const foxHenProducts: ExampleProduct[] = [
  {
    id: 'workbench-tee',
    name: 'Workbench Tee',
    product: 'Bella + Canvas 3001 Tee',
    description:
      'The approved stacked Fox & Hen lockup leads; the horizontal mark and studio thesis carry the back.',
    suggestedRetail: '$38 suggested',
    placement: 'Front + back DTG',
    costNote: 'The second print area adds $5.95 to production cost before margin and fees.',
    mockupImage: `${assetRoot}/mockups/workbench-tee-front.png`,
    reverseMockupImage: `${assetRoot}/mockups/workbench-tee-back.png`,
    mockupClass: 'example-mockup--tee',
  },
  {
    id: 'studio-notes-tote',
    name: 'Studio Notes Tote',
    product: 'Organic Cotton Tote Bag',
    description:
      'The approved stacked lockup leads; the real circular social mark and an operating principle live on the reverse.',
    suggestedRetail: '$42 suggested',
    placement: 'Front + back DTG',
    costNote: 'The second print area adds $5.95 to production cost before margin and fees.',
    mockupImage: `${assetRoot}/mockups/studio-notes-tote-front.png`,
    reverseMockupImage: `${assetRoot}/mockups/studio-notes-tote-back.png`,
    mockupClass: 'example-mockup--tote',
  },
  {
    id: 'connected-systems-mug',
    name: 'Connected Systems Mug',
    product: 'White Glossy Mug',
    description: 'The horizontal logo and circular social mark meet across a restrained full-color wrap.',
    suggestedRetail: '$24 suggested',
    placement: 'Wraparound sublimation',
    costNote: 'One print area is included; no multi-placement surcharge applies.',
    mockupImage: `${assetRoot}/mockups/connected-systems-mug-front.png`,
    mockupClass: 'example-mockup--mug',
  },
  {
    id: 'system-map-poster',
    name: 'System Map Poster',
    product: 'Enhanced Matte Paper Poster',
    description: 'The Fox & Hen method rendered as a 12 × 18 inch editorial system map.',
    suggestedRetail: '$30 suggested',
    placement: 'Single full-color print',
    costNote: 'One print area is included; larger sizes carry their catalog cost difference.',
    mockupImage: `${assetRoot}/mockups/system-map-poster.png`,
    mockupClass: 'example-mockup--poster',
  },
  {
    id: 'studio-mark-sticker',
    name: 'Studio Mark Sticker',
    product: 'Kiss-Cut Sticker',
    description: 'The exact circular social mark becomes a durable three-inch studio sticker.',
    suggestedRetail: '$8 suggested',
    placement: 'Single kiss-cut print',
    costNote: 'One print area is included; size changes affect the base provider cost.',
    mockupImage: `${assetRoot}/mockups/studio-mark-sticker.png`,
    mockupClass: 'example-mockup--sticker',
  },
];
