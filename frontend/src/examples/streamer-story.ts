// Fictional example data only. Never seeded into an installation or passed to an admin API.
export const streamerSteps = [
  {
    title: 'Start with a blank store',
    where: 'Overview',
    action: 'Choose a focused channel drop: three pieces featuring the same original emote.',
    before: 'No merchant, artwork, collection, or orders.',
    after: 'A plan for one collection. Nothing is published.',
    visible: 'No storefront yet',
    stage: 0,
  },
  {
    title: 'Give it the channel’s identity',
    where: 'Store profile',
    action:
      'Enter Night Shift, choose a lime accent, upload the moon logo, and supply support and policy content. Save a private draft.',
    before: 'Empty identity fields and neutral software colors.',
    after: 'The owner sees a branded draft preview. Fans still see the previous version.',
    visible: 'Private identity preview',
    stage: 1,
  },
  {
    title: 'Connect the owner’s accounts',
    where: 'Connections',
    action:
      'Connect private storage, Printful and Stripe; save values, redeploy, then verify account access. AI is optional and stays off for this original-emote drop.',
    before: 'No provider values entered.',
    after:
      'The example represents verified accounts. The appearance of the storefront does not change.',
    visible: 'No visible store change',
    stage: 1,
  },
  {
    title: 'Upload the emote & build the drop',
    where: 'Collections',
    action:
      'Upload the creator-owned moon emote as original artwork. Attach it to a tee, mug and sticker, choose variants, and save target prices.',
    before: 'No collection or artwork library.',
    after:
      'One private collection with three products. Upload preserves the original; it does not generate a replacement.',
    visible: 'Private collection preview',
    stage: 2,
  },
  {
    title: 'Review the exact prints',
    where: 'Collections → Print layouts',
    action:
      'Check supplier templates and print sizes, prepare each placement, and inspect the saved print PNGs. Review a physical sample before a real launch.',
    before: 'Product choices with artwork attached.',
    after: 'Reviewed layouts tied to this collection version. Fans still cannot buy.',
    visible: 'Ready for owner review',
    stage: 2,
  },
  {
    title: 'Publish, then open ordering',
    where: 'Profile → Publish; Collections → Publish & ordering',
    action:
      'Approve and publish the profile, redeploy it, and inspect the storefront. Publish the collection preview separately. After readiness checks, approve prices and layouts for ordering.',
    before: 'Private drafts; sales closed.',
    after:
      'Fans see the branded drop. This illustration shows the finished result; it never accepts payment.',
    visible: 'Finished storefront',
    stage: 3,
  },
  {
    title: 'Operate the first drop',
    where: 'Orders & review',
    action:
      'Review each paid order’s immutable print files, handle exceptions, and confirm production manually in Printful. A note in admin does not start manufacturing.',
    before: 'A published store with no orders.',
    after: 'An example order awaiting owner review. No revenue or conversion claim is implied.',
    visible: 'Storefront unchanged',
    stage: 3,
  },
] as const;
export const streamerProducts = [
  {
    name: 'After Hours Tee',
    price: '$32',
    detail: 'Original moon emote · front print',
    position: '62% 62%',
    size: '185%',
  },
  {
    name: 'One More Game Mug',
    price: '$19',
    detail: 'Original moon emote · wrap print',
    position: '100% 46%',
    size: '260%',
  },
  {
    name: 'Night Owl Sticker',
    price: '$5',
    detail: 'Original moon emote · die-cut illustration',
    position: '100% 80%',
    size: '320%',
  },
];
export const streamerPanels = [
  {
    id: 'profile',
    title: 'Store profile',
    rows: [
      ['Store name', 'Night Shift'],
      ['Short description', 'Late games. Good people.'],
      ['Accent color', '#D9EF78'],
      ['Artwork identity', 'Creator-owned moon mascot'],
      [
        'Support & policies',
        'Owner-supplied pages represented; no live support address in this mock',
      ],
      ['Publication', 'Finished example: saved → reviewed → published → redeployed'],
    ],
    impact:
      'The store name, logo, color and sharing preview come from the profile. A private save only changes the owner preview.',
  },
  {
    id: 'collections',
    title: 'Collections',
    rows: [
      ['Collection', 'The After Hours Drop'],
      ['Products', 'Tee $32 · Mug $19 · Sticker $5 — illustrative prices'],
      ['Artwork', 'Original upload; no AI or background-removal step'],
      ['Personalization', 'Approved artwork only'],
      ['Print layouts', 'One reviewed placement per product, represented for the mock'],
      ['Ordering', 'Illustrated as ready; checkout is disabled throughout this demo'],
    ],
    impact:
      'A collection publication fixes the product and artwork version fans see. Editing its draft does not alter the public version.',
  },
  {
    id: 'connections',
    title: 'Connections',
    rows: [
      ['Hosting & database', 'Represented as configured; no connected account'],
      ['Private storage', 'Represented as verified; no bucket or credentials'],
      ['Printful', 'Represented as connected; manual production confirmation'],
      ['Stripe', 'Represented as verified; no payment calls'],
      ['Customer email', 'Not promised by this example'],
      ['Twitch / YouTube', 'No automatic ingestion; creator supplies their own artwork'],
    ],
    impact:
      'Connections make the workflow possible; they do not add products or change the store design. Save, redeploy, and verify are separate steps.',
  },
  {
    id: 'artwork',
    title: 'Artwork & limits',
    rows: [
      ['Creation method', 'Upload original artwork'],
      ['AI provider', 'Optional; off for this collection'],
      ['Model preference', 'Owner-selectable when AI is connected'],
      ['Spending limits', 'Owner sets limits before enabling generation'],
      ['Existing print files', 'Remain unchanged when the model changes'],
    ],
    impact:
      'Changing a model affects new AI requests only. The existing uploaded moon artwork remains the same.',
  },
  {
    id: 'installation',
    title: 'Installation',
    rows: [
      ['Store identity', 'Represented as reviewed'],
      ['Provider verification', 'Represented as completed'],
      [
        'Supplier templates & physical sample',
        'Required before a real launch; not evidence supplied by this mock',
      ],
      ['Checkout & event delivery', 'Required live evidence; no real transaction here'],
      ['Recovery', 'Database and private artwork must be backed up together'],
      [
        'Operating owner',
        'Channel owner reviews orders; Fox & Hen care can cover agreed technical tasks',
      ],
    ],
    impact:
      'Checklist completion is an owner attestation. It cannot switch on payments or certify a provider by itself.',
  },
  {
    id: 'orders',
    title: 'Orders & review',
    rows: [
      ['Example order', 'NS-EXAMPLE-001 · illustrative, not a real order'],
      ['Contents', '1 × After Hours Tee'],
      ['Payment', 'Represented as paid; no card was charged'],
      ['Print file', 'Exact version saved at checkout'],
      ['Next action', 'Inspect artwork and review the fulfillment draft'],
      ['Production', 'Manual confirmation required in Printful'],
    ],
    impact:
      'The owner operates the store here. Review notes have no effect on product listings, refunds or production approval.',
  },
] as const;
