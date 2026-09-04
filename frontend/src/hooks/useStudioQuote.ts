import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type Sourced } from '@services/api';
import type {
  CatalogProduct,
  CatalogVariant,
  DesignDraft,
  PlacementLayout,
  QuoteBreakdown,
} from '@app-types/catalog';
import { totalBand, trackEvent } from '../utils/analytics';
import { prepareQuoteRequest, quoteAnnouncement } from '../studio-quote';
import { mapStudioError } from '../studio-view-model.selectors';
import type { FlowState, PreviewOrientation, SurfaceError } from '../studio-view-model.types';

export type StudioQuoteRequest = {
  product: CatalogProduct;
  variant: CatalogVariant;
  selectedPlacements: string[];
  design: DesignDraft;
  placementArtwork: Record<string, DesignDraft>;
  quantity: number;
  mugLayout: PlacementLayout;
  orientation?: PreviewOrientation;
  automatic?: boolean;
};

type StudioQuoteOptions = {
  sessionId?: string;
  studioPassId?: string;
  onSource: <T>(result: Sourced<T>) => T;
  onFlowChange: (flow: FlowState) => void;
  onAnnouncement: (message: string) => void;
};

/**
 * Owns quote freshness and the single-active-request rule for one configured
 * product. Guest-cart pricing has a separate owner because its persistence and
 * multi-line invalidation rules are intentionally different.
 */
export function useStudioQuote(options: StudioQuoteOptions) {
  const [quote, setQuote] = useState<QuoteBreakdown | null>(null);
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SurfaceError>();
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    requestId.current += 1;
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
  }, []);

  const clear = useCallback(() => {
    cancel();
    setQuote(null);
    setStale(false);
    setError(undefined);
  }, [cancel]);

  const invalidate = useCallback(() => {
    cancel();
    setStale((current) => current || Boolean(quote));
  }, [cancel, quote]);

  const clearError = useCallback(() => setError(undefined), []);

  const request = useCallback(
    async (params: StudioQuoteRequest) => {
      const body = prepareQuoteRequest({
        sessionId: options.sessionId,
        studioPassId: options.studioPassId,
        product: params.product,
        variant: params.variant,
        selectedPlacements: params.selectedPlacements,
        design: params.design,
        placementArtwork: params.placementArtwork,
        quantity: params.quantity,
        mugLayout: params.mugLayout,
        orientation: params.orientation,
      });
      if (!body) return;

      const currentRequestId = ++requestId.current;
      controller.current?.abort();
      const nextController = new AbortController();
      controller.current = nextController;
      setBusy(true);
      clearError();

      try {
        const sourced = await api.quote(body, nextController.signal);
        const result = options.onSource(sourced);
        if (currentRequestId !== requestId.current) return;

        setQuote(result);
        setStale(false);
        options.onFlowChange('quoted');
        trackEvent('quote_created', {
          source: sourced.source,
          total_band: totalBand(result.totalCents),
        });
        options.onAnnouncement(quoteAnnouncement(result, Boolean(params.automatic)));
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
        if (currentRequestId !== requestId.current) return;
        setError(mapStudioError(requestError, 'quote'));
      } finally {
        if (currentRequestId === requestId.current) {
          setBusy(false);
          controller.current = null;
        }
      }
    },
    [clearError, options]
  );

  useEffect(
    () => () => {
      controller.current?.abort();
    },
    []
  );

  return {
    quote,
    setQuote,
    stale,
    setStale,
    expired: Boolean(quote && new Date(quote.expiresAt).getTime() <= Date.now()),
    busy,
    error,
    clearError,
    cancel,
    clear,
    invalidate,
    request,
  };
}
