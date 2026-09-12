export const installationPersonas = [
  {
    id: 'creator',
    label: 'Creator or community brand',
    focus: 'Start with approved emotes or artwork for a focused community drop.',
  },
  {
    id: 'artist',
    label: 'Artist or pop-up shop',
    focus: 'Keep original artwork unchanged and prepare a small collection for your next event.',
  },
  {
    id: 'coffee',
    label: 'Coffee shop or community space',
    focus:
      'Build an owner-reviewed collection from artwork you have permission to use. Community submissions are a separate extension.',
  },
  {
    id: 'local',
    label: 'Local or specialty business',
    focus: 'Launch a small branded collection and establish a reliable order-review routine.',
  },
] as const;
export const installationTasks = [
  {
    id: 'identity',
    title: 'Make the store yours',
    detail:
      'Start in Store profile → Brand & details. Add your store name and colors, then Save draft. You can leave other fields unfinished. The preview changes as you edit; the storefront stays unchanged.',
    section: 'profile',
  },
  {
    id: 'accounts',
    title: 'Connect accounts you own',
    detail:
      'Connect private storage, printing and payments. Add AI only if you want generation. Save credentials, redeploy, and refresh the checks. A saved key is not proof of account access.',
    section: 'connections',
  },
  {
    id: 'collection',
    title: 'Prepare your first collection',
    detail:
      'In Collections, create one collection, upload artwork you can use, and choose products and prices. Save privately, review the print size, then publish its preview. Customers can see a published preview; ordering is still a separate approval.',
    section: 'collections',
  },
  {
    id: 'domain',
    title: 'Connect your store address',
    detail:
      'Attach the domain in your hosting account and follow the DNS records it provides. Open your HTTPS address and confirm it reaches this store, including a direct visit to /collections.',
    section: 'profile',
  },
  {
    id: 'publication',
    title: 'Review what customers will see',
    detail:
      'Complete your identity, contact details and policy pages. Save the profile, open Review & publish, then redeploy the saved values. Open the storefront to verify the result. Collection previews publish separately; ordering stays closed until its own approval.',
    section: 'profile',
  },
  {
    id: 'webhooks',
    title: 'Verify payment and fulfillment events',
    detail:
      'Follow the installation checklist to verify signed payment events, duplicate-event handling, customer order access and manual fulfillment review. Use test accounts first; a real charge or production sample needs a separate deliberate run.',
    section: 'connections',
  },
  {
    id: 'support',
    title: 'Choose who operates the store',
    detail:
      'Assign customer questions, refunds, artwork review, fulfillment exceptions and technical maintenance. Confirm the support address and email sender; test delivery before promising customer notifications.',
    section: 'orders',
  },
  {
    id: 'recovery',
    title: 'Rehearse recovery and handoff',
    detail:
      'Back up the database and private artwork together. Restore an isolated copy, verify saved branding and order print files, and have the person running the store practice its workflow.',
    section: 'installation',
  },
] as const;
export type InstallationPersona = (typeof installationPersonas)[number]['id'];
export type InstallationTask = (typeof installationTasks)[number]['id'];
