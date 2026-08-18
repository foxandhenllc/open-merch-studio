export type CatalogCategory = {
  id: string;
  printfulId?: number | null;
  title: string;
  slug: string;
  imageUrl?: string | null;
  isLaunchCategory: boolean;
};

export type PlacementOption = {
  code: string;
  displayName: string;
  technique: string;
  isDefault: boolean;
  width?: number;
  height?: number;
};

export type CatalogVariant = {
  id: string;
  printfulVariantId?: number | null;
  name: string;
  size?: string | null;
  color?: string | null;
  colorCode?: string | null;
  imageUrl?: string | null;
  isAvailable: boolean;
  costCents: number;
  retailEstimateCents?: number;
};

export type StudioCapabilities = {
  ai: 'live' | 'available' | 'test' | 'demo' | 'offline';
  checkout: 'live' | 'available' | 'test' | 'demo' | 'offline';
  fulfillment: 'live' | 'available' | 'test' | 'demo' | 'offline';
};

export type CatalogProduct = {
  id: string;
  printfulId?: number | null;
  title: string;
  slug: string;
  type?: string | null;
  brand?: string | null;
  description?: string | null;
  thumbnailUrl?: string | null;
  categorySlug?: string | null;
  categoryTitle?: string | null;
  isSellable: boolean;
  variants: CatalogVariant[];
  placements: PlacementOption[];
};

export type QuoteBreakdown = {
  id: string | null;
  currency: string;
  productCostCents: number;
  shippingEstimateCents: number;
  taxEstimateCents: number;
  aiDesignFeeCents: number;
  paymentFeeCents: number;
  targetMarginCents: number;
  studioPassCreditCents: number;
  totalCents: number;
  subtotalBeforeCreditsCents: number;
  estimateFlags: {
    shipping: boolean;
    tax: boolean;
    paymentFee: boolean;
  };
  costLines: Array<{
    code: string;
    label: string;
    amountCents: number;
    kind: 'cost' | 'fee' | 'margin' | 'credit' | 'estimate';
  }>;
  expiresAt: string;
  items: Array<{
    productId: string;
    variantId: string;
    printfulVariantId?: number | null;
    title: string;
    variantName: string;
    quantity: number;
    placementCodes: string[];
    placementTechniques: Record<string, string>;
    orientation?: 'portrait' | 'landscape' | 'square';
    designAssetId?: string;
    unitCostCents: number;
    unitRetailCents: number;
  }>;
};

export type StudioPassStatus = 'not_required' | 'available' | 'required' | 'exhausted' | 'applied';

export type StudioPass = {
  id: string;
  sessionId: string;
  status: 'simulated' | 'purchased' | 'applied' | 'expired';
  priceCents: number;
  creditCents: number;
  includedRoughDrafts: number;
  includedEdits: number;
  includedFinals: number;
  roughDraftsUsed: number;
  editsUsed: number;
  finalsUsed: number;
  appliedOrderId?: string;
  createdAt: string;
  expiresAt?: string;
};

export type StudioSession = {
  id: string;
  status: 'guest' | 'claimed' | 'expired';
  freeDraftsUsed: number;
  freeDraftLimit: number;
  createdAt: string;
  updatedAt: string;
  studioPass?: StudioPass;
};

export type AllowanceState = {
  sessionId: string;
  studioPassStatus: StudioPassStatus;
  freeDraftsRemaining: number;
  roughDraftsRemaining: number;
  editsRemaining: number;
  finalsRemaining: number;
  nextAction: 'continue_free' | 'buy_studio_pass' | 'checkout' | 'contact_support';
  message: string;
};

export type DesignIdea = {
  id: string;
  sessionId: string;
  productId?: string;
  placementCodes: string[];
  originalPrompt: string;
  refinedPrompt: string;
  styleTags: string[];
  warnings: string[];
  createdAt: string;
};

export type DesignDraft = {
  id: string | null;
  sessionId?: string;
  provider: 'mock' | 'openai-ready' | 'openai';
  generationStatus: 'complete' | 'failed';
  prompt: string;
  imageUrl: string;
  qualityTier: 'rough' | 'final';
  printPreparation?: {
    status: 'transparent' | 'removed' | 'required' | 'failed';
    provider: 'openai' | 'remove-bg' | 'none';
    message: string;
  };
  allowance: AllowanceState;
  policy: {
    status: 'pass' | 'blocked' | 'needs_review';
    reasons: string[];
  };
  readiness: {
    status: 'pass' | 'warning' | 'blocked' | 'needs_review';
    checks: Array<{ label: string; result: string; severity?: 'pass' | 'warning' | 'block' }>;
  };
  createdAt: string;
};

export type DesignMockup = {
  id: string;
  status: 'queued' | 'processing' | 'complete' | 'failed';
  provider: 'fixture' | 'printful-ready' | 'printful';
  productId: string;
  variantId: string;
  placementCodes: string[];
  designAssetId?: string;
  orientation?: 'portrait' | 'landscape' | 'square';
  imageUrl: string;
  views?: Array<{ label: string; imageUrl: string }>;
  errorMessage?: string;
  createdAt: string;
};

export type CheckoutSession = {
  id: string;
  mode: 'fixture' | 'stripe-ready' | 'stripe';
  status: 'open' | 'paid' | 'cancelled' | 'blocked';
  checkoutUrl: string | null;
  quoteId?: string | null;
  studioPassId?: string;
  orderId?: string;
  message: string;
};

export type OrderSummary = {
  id: string;
  orderNumber: string;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  taxCents: number;
  refundedCents?: number;
  paidAt?: string;
  status:
    | 'draft'
    | 'quoted'
    | 'checkout_pending'
    | 'paid'
    | 'fulfillment_validating'
    | 'submitted'
    | 'in_production'
    | 'shipped'
    | 'delivered'
    | 'cancelled'
    | 'refunded'
    | 'failed'
    | 'needs_review';
  customerEmail?: string;
  totalCents: number;
  currency: string;
  quote?: QuoteBreakdown;
  designAssetId?: string;
  fulfillment: {
    provider: 'fixture' | 'printful-ready' | 'printful';
    status: 'not_submitted' | 'validated' | 'submitted' | 'failed' | 'needs_review';
    message: string;
  };
  timeline: Array<{ at: string; status: string; note: string }>;
  createdAt: string;
};

export type CustomerOrderStatus =
  | 'preparing'
  | 'awaiting_payment'
  | 'received'
  | 'under_review'
  | 'action_needed'
  | 'in_production'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type CustomerOrderConfirmation = {
  orderNumber: string;
  status: CustomerOrderStatus;
  message: string;
  totalCents: number;
  taxCents: number;
  refundedCents?: number;
  paidAt?: string;
  currency: string;
  items: Array<{
    title: string;
    variantName: string;
    quantity: number;
  }>;
  fulfillment: {
    provider: 'fixture' | 'production';
    status: CustomerOrderStatus;
    message: string;
  };
  timeline: Array<{
    at: string;
    status: CustomerOrderStatus;
    note: string;
  }>;
  support: {
    email: string;
  };
  createdAt: string;
};

export type CheckoutConfirmation = {
  state: 'processing' | 'paid' | 'needs_review' | 'failed';
  message: string;
  order?: CustomerOrderConfirmation;
};
