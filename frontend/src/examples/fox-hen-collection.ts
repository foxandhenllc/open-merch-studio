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
      'A small copper ampersand on the front; the studio thesis printed large across the back.',
    suggestedRetail: '$38 suggested',
    placement: 'Front + back DTG',
    costNote: 'The second print area adds $5.95 to production cost before margin and fees.',
    mockupImage: `${assetRoot}/mockups/workbench-tee-front.png`,
    reverseMockupImage: `${assetRoot}/mockups/workbench-tee-back.png`,
    mockupClass: 'example-mockup--tee',
  },
  {
    id: 'field-notes-tote',
    name: 'Field Notes Tote',
    product: 'Organic Cotton Tote Bag',
    description:
      'The fox-and-hen field emblem leads; an operating principle lives on the reverse.',
    suggestedRetail: '$42 suggested',
    placement: 'Front + back DTG',
    costNote: 'The second print area adds $5.95 to production cost before margin and fees.',
    mockupImage: `${assetRoot}/mockups/field-notes-tote-front.png`,
    reverseMockupImage: `${assetRoot}/mockups/field-notes-tote-back.png`,
    mockupClass: 'example-mockup--tote',
  },
  {
    id: 'connected-systems-mug',
    name: 'Connected Systems Mug',
    product: 'White Glossy Mug',
    description: 'A wraparound map from the customer-facing website to the connected operation.',
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
    id: 'ampersand-sticker',
    name: 'Ampersand Sticker',
    product: 'Kiss-Cut Sticker',
    description: 'The simplest piece in the set: a durable three-inch mark for laptops and cases.',
    suggestedRetail: '$8 suggested',
    placement: 'Single kiss-cut print',
    costNote: 'One print area is included; size changes affect the base provider cost.',
    mockupImage: `${assetRoot}/mockups/ampersand-sticker.png`,
    mockupClass: 'example-mockup--sticker',
  },
];
