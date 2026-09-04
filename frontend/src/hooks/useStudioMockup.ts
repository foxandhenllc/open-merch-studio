import { useCallback, useRef, useState } from 'react';
import { api, type DataSource, type Sourced } from '@services/api';
import type {
  CatalogProduct,
  CatalogVariant,
  DesignDraft,
  DesignMockup,
  PlacementLayout,
} from '@app-types/catalog';
import { trackEvent } from '../utils/analytics';
import { classifyMockupResult, prepareMockupRequest } from '../studio-mockup';
import { mapStudioError } from '../studio-view-model.selectors';
import type {
  FlowState,
  PreviewOrientation,
  SurfaceError,
  WorkbenchMode,
} from '../studio-view-model.types';

export type StudioMockupRequest = {
  product: CatalogProduct;
  variant: CatalogVariant;
  placements: string[];
  draft: DesignDraft;
  artworkByCode: Record<string, DesignDraft>;
  mugLayout: PlacementLayout;
  orientation?: PreviewOrientation;
  revealReview?: boolean;
};

type StudioMockupOptions = {
  sessionId?: string;
  quotePresent: boolean;
  dataSource: DataSource;
  onSource: <T>(result: Sourced<T>) => T;
  onFlowChange: (flow: FlowState) => void;
  onModeChange: (mode: WorkbenchMode) => void;
  onAnnouncement: (message: string) => void;
  onOperationStartedAt: (startedAt: number | null) => void;
};

/**
 * Owns the complete mockup request lifecycle: deduplication, cache identity,
 * stale-response protection, progress, errors, and the selected provider view.
 *
 * Product configuration deliberately remains in the parent studio model. That
 * boundary lets configuration transitions invalidate a preview without making
 * this hook responsible for unrelated quote, checkout, or artwork state.
 */
export function useStudioMockup(options: StudioMockupOptions) {
  const [mockup, setMockup] = useState<DesignMockup | null>(null);
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SurfaceError>();
  const [activeViewIndex, setActiveViewIndex] = useState(0);
  const requestId = useRef(0);
  const cache = useRef(new Map<string, DesignMockup>());

  const cacheMockup = useCallback((key: string, value: DesignMockup) => {
    cache.current.set(key, value);
  }, []);

  const clearError = useCallback(() => setError(undefined), []);

  const request = useCallback(
    async (params: StudioMockupRequest) => {
      const prepared = prepareMockupRequest(params, options.sessionId);
      if (!prepared) return;

      const currentRequestId = ++requestId.current;
      const cached = cache.current.get(prepared.cacheKey);
      if (cached) {
        setBusy(false);
        options.onOperationStartedAt(null);
        setMockup(cached);
        setActiveViewIndex(0);
        setStale(false);
        clearError();
        options.onFlowChange(options.quotePresent ? 'quote_stale' : 'drafted');
        options.onAnnouncement('Saved product mockup restored.');
        trackEvent('mockup_completed', { result: 'success', source: 'fallback' });
        if (params.revealReview !== false) options.onModeChange('review');
        return;
      }

      // Keep the last successful image visible while clearly marking it stale.
      // A slow response must never overwrite a newer placement selection.
      if (mockup) setStale(true);
      setBusy(true);
      options.onFlowChange('previewing');
      options.onOperationStartedAt(Date.now());
      clearError();

      try {
        const sourced = await api.mockup(prepared.body);
        const result = options.onSource(sourced);
        if (currentRequestId !== requestId.current) return;

        setMockup(result);
        setActiveViewIndex(0);
        setStale(false);
        const outcome = classifyMockupResult(result, sourced.source);
        trackEvent('mockup_completed', {
          result: outcome.failed ? 'failed' : 'success',
          source: outcome.analyticsSource,
        });

        if (outcome.failed) setError(mapStudioError(outcome.error, 'mockup'));
        else cache.current.set(prepared.cacheKey, result);

        options.onFlowChange(options.quotePresent ? 'quote_stale' : 'drafted');
        options.onAnnouncement(outcome.announcement);
        if (params.revealReview !== false) options.onModeChange('review');
      } catch (requestError) {
        if (currentRequestId !== requestId.current) return;
        trackEvent('mockup_completed', {
          result: 'failed',
          source: options.dataSource === 'live' ? 'printful' : 'fallback',
        });
        setError(mapStudioError(requestError, 'mockup'));
        options.onFlowChange(options.quotePresent ? 'quote_stale' : 'drafted');
        options.onAnnouncement(
          'The product preview failed. Your artwork is safe; retry the preview or continue without it.'
        );
        if (params.revealReview !== false) options.onModeChange('review');
      } finally {
        if (currentRequestId === requestId.current) {
          setBusy(false);
          options.onOperationStartedAt(null);
        }
      }
    },
    [clearError, mockup, options]
  );

  return {
    mockup,
    setMockup,
    stale,
    setStale,
    busy,
    error,
    clearError,
    activeViewIndex,
    setActiveViewIndex,
    cacheMockup,
    request,
  };
}
