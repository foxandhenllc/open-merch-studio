import type { QuoteBreakdown } from '../types/catalog';
import type { SurfaceError } from '../studio-view-model.types';

export type CheckoutReadiness = {
  emailValid: boolean;
  canOpen: boolean;
  blocker: string;
  fulfillmentReview: string;
};

export type CheckoutPanelProps = {
  quote: QuoteBreakdown | null;
  quoting: boolean;
  quoteStale: boolean;
  quoteExpired: boolean;
  onRefreshQuote: () => void;
  email: string;
  onEmailChange: (value: string) => void;
  readiness: CheckoutReadiness;
  checkoutEnabled: boolean;
  checkoutBusy: boolean;
  checkoutError?: SurfaceError;
  onCheckout: (policyAccepted: true, policyVersion: string) => void;
  onBack: () => void;
};
