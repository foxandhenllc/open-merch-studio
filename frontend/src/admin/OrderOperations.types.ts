export type OperationOrder = {
  id: string;
  orderNumber: string;
  status: string;
  fulfillmentStatus: string;
  totalCents: number;
  currency: string;
  paidAt?: string;
  createdAt: string;
  reviewStatus: 'unreviewed' | 'acknowledged' | 'resolved';
};
export type OperationDetail = {
  summary: OperationOrder;
  mode: 'fixture' | 'database';
  items: Array<{ title: string; variantName: string; quantity: number }>;
  prints: Array<{ assetId: string; title: string; placementCode: string }>;
  reviews: Array<{ status: string; note?: string; createdAt: string }>;
  retryAvailable: boolean;
};

export type OperationPage = { orders: OperationOrder[]; nextCursor?: string };
