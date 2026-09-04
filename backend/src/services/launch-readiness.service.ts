import type { AdminSettings, LaunchReadiness } from '../types/catalog.js';

/**
 * Evaluates operator launch gates from an immutable settings snapshot. This is
 * deliberately pure: reading readiness must never enable a provider or mutate
 * checkout authorization.
 */
export function assessLaunchReadiness(settings: AdminSettings): LaunchReadiness {
  const gates: LaunchReadiness['gates'] = [
    {
      code: 'fixture-mode',
      label: 'Clean fixture mode',
      status: 'pass',
      detail:
        'Catalog, design, quote, checkout simulation, and fixture fulfillment run without live credentials.',
    },
    {
      code: 'openai-live',
      label: 'Live OpenAI generation',
      status: 'manual',
      detail: settings.liveOpenAiEnabled
        ? 'OpenAI credentials are configured, but live image generation remains blocked until provider calls and spend alerts are verified.'
        : 'Provide OpenAI credentials, model policy, spend alerts, and enable live generation after OPS review.',
    },
    {
      code: 'stripe-live',
      label: 'Production checkout',
      status: 'manual',
      detail:
        settings.liveStripeEnabled && settings.checkoutEnabled
          ? 'Stripe credentials are configured, but live checkout remains blocked until Checkout Sessions, webhooks, tax, refunds, and accounting review are verified.'
          : 'Stripe remains in fixture simulation until private setup and implementation verification are complete.',
    },
    {
      code: 'printful-live',
      label: 'Real fulfillment',
      status: 'manual',
      detail:
        settings.livePrintfulEnabled && settings.fulfillmentEnabled
          ? 'Printful credentials are configured, but real fulfillment remains blocked until live order submission and status sync are verified.'
          : 'Printful remains disabled until private store, shipping, support review, and implementation verification are complete.',
    },
    {
      code: 'ops-review',
      label: 'Private ops review',
      status: 'manual',
      detail:
        'Review OPS-001 through OPS-008 before enabling live money, generation, or fulfillment.',
    },
  ];

  return {
    readyForPaidBeta: gates.every((gate) => gate.status === 'pass'),
    gates,
  };
}
