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
      'Set your brand, logo, sharing image and contact details. Review all five policy pages, then publish and redeploy. Check the resulting storefront.',
    section: 'profile',
  },
  {
    id: 'domain',
    title: 'Connect your store address',
    detail:
      'Attach the domain in your hosting account and follow the DNS records it provides. Open your HTTPS address and confirm it reaches this store, including a direct visit to /collections.',
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
      'Upload rights-cleared artwork, choose products and prices, review print dimensions and layouts, then publish a collection. Enable sales only after reviewing its readiness checks.',
    section: 'collections',
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
