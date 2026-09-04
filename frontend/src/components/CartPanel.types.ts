import type { QuoteBreakdown } from '../types/catalog';
import type { SurfaceError } from '../studio-view-model.types';
import type { StudioCartItem } from '../studio-cart';

export type CartPanelProps = {
  items: StudioCartItem[];
  quote: QuoteBreakdown | null;
  quoteStale: boolean;
  quoteExpired: boolean;
  quoting: boolean;
  error?: SurfaceError;
  onQuantityChange: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  onRefreshQuote: () => void;
  onKeepShopping: () => void;
  onCheckout: () => void;
};
