import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type DataSource, type Sourced } from '@services/api';
import type {
  CatalogProduct,
  CatalogVariant,
  DesignDraft,
  DesignIdea,
  PlacementLayout,
  StudioCapabilities,
} from '@app-types/catalog';
import {
  acceptArtworkDraft,
  appendDesignHistory,
  appendReferenceAssets,
  assertUsableGeneratedDraft,
  referenceAssetIds,
  replaceDraftAssignments,
  selectReferenceFiles,
  undoArtworkRevision,
} from '../studio-artwork.transitions';
import { deriveDesignAllowance, mapStudioError } from '../studio-view-model.selectors';
import type {
  CreationPath,
  FlowState,
  PreviewOrientation,
  SurfaceError,
  WorkbenchMode,
} from '../studio-view-model.types';
import { revisionBand, trackEvent } from '../utils/analytics';

export type StudioArtworkContext = {
  product: CatalogProduct;
  variant: CatalogVariant;
  selectedPlacements: string[];
  mugLayout: PlacementLayout;
  orientation?: PreviewOrientation;
};

export type ArtworkCommit = StudioArtworkContext & {
  kind: 'replacement' | 'revision' | 'undo';
  draft: DesignDraft;
  placementArtwork: Record<string, DesignDraft>;
};

type StudioArtworkOptions = {
  sessionId?: string;
  capabilities: StudioCapabilities;
  dataSource: DataSource;
  onSource: <T>(result: Sourced<T>) => T;
  onFlowChange: (flow: FlowState) => void;
  onModeChange: (mode: WorkbenchMode) => void;
  onAnnouncement: (message: string) => void;
  onRecoveryClear: () => void;
  onOperationStartedAt: (startedAt: number | null) => void;
  onArtworkCommit: (commit: ArtworkCommit) => Promise<void>;
};

const minimumGenerationDwell = (milliseconds: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, milliseconds);
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer);
        reject(new DOMException('Cancelled', 'AbortError'));
      },
      { once: true }
    );
  });

/**
 * Owns customer artwork state and provider command lifecycles. Product choice,
 * mockup transport, quoting, and checkout remain separate owners; they receive
 * one typed commit event only after artwork state has changed successfully.
 */
export function useStudioArtwork(options: StudioArtworkOptions) {
  const [prompt, setPrompt] = useState('');
  const [creationPath, setCreationPath] = useState<CreationPath>('generate');
  const [referenceAssets, setReferenceAssets] = useState<DesignDraft[]>([]);
  const [revision, setRevision] = useState('');
  const [idea, setIdea] = useState<DesignIdea | null>(null);
  const [design, setDesign] = useState<DesignDraft | null>(null);
  const [placementArtwork, setPlacementArtwork] = useState<Record<string, DesignDraft>>({});
  const [activePlacementCode, setActivePlacementCode] = useState('');
  const [designHistory, setDesignHistory] = useState<DesignDraft[]>([]);
  const [generationPhase, setGenerationPhase] = useState('Queued');
  const [refining, setRefining] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [revising, setRevising] = useState(false);
  const [error, setError] = useState<SurfaceError>();
  const generationController = useRef<AbortController | null>(null);
  const { canGenerateAnother, canRevise } = deriveDesignAllowance(design);

  const clearError = useCallback(() => setError(undefined), []);
  const fail = useCallback(
    (requestError: unknown) => setError(mapStudioError(requestError, 'generation')),
    []
  );

  const updatePrompt = useCallback(
    (value: string) => {
      setPrompt(value);
      if (idea) setIdea(null);
    },
    [idea]
  );

  const uploadArtwork = useCallback(
    async (file: File, removeBackground: boolean, context: StudioArtworkContext) => {
      options.onRecoveryClear();
      setGenerating(true);
      options.onFlowChange('generating');
      options.onModeChange('generating');
      setGenerationPhase('Uploading artwork');
      options.onOperationStartedAt(Date.now());
      clearError();
      try {
        const result = await api.uploadArtwork({
          file,
          sessionId: options.sessionId,
          purpose: 'print',
          rightsConfirmed: true,
          placementCodes: context.selectedPlacements,
          removeBackground,
        });
        const draft = options.onSource(result);
        const nextPlacementArtwork = acceptArtworkDraft({
          draft,
          activePlacementCode,
          selectedPlacements: context.selectedPlacements,
          placementArtwork,
        });
        if (design?.id) setDesignHistory((current) => appendDesignHistory(current, design));
        setPrompt(draft.prompt);
        setDesign(draft);
        setPlacementArtwork(nextPlacementArtwork);
        setActivePlacementCode('');
        options.onFlowChange('drafted');
        options.onAnnouncement('Your artwork is prepared. Building the product preview now.');
        trackEvent('design_generation_completed', { result: 'success', source: 'upload' });
        setGenerating(false);
        options.onOperationStartedAt(null);
        await options.onArtworkCommit({
          ...context,
          kind: 'replacement',
          draft,
          placementArtwork: nextPlacementArtwork,
        });
      } catch (requestError) {
        fail(requestError);
        options.onFlowChange('configuring');
        options.onModeChange('describe');
      } finally {
        setGenerating(false);
        options.onOperationStartedAt(null);
      }
    },
    [activePlacementCode, clearError, design, fail, options, placementArtwork]
  );

  const addReferenceImages = useCallback(
    async (files: File[], selectedPlacements: string[]) => {
      const selectedFiles = selectReferenceFiles(files, referenceAssets.length);
      if (!selectedFiles.length) return;
      setGenerating(true);
      setGenerationPhase('Uploading references');
      clearError();
      try {
        const results: DesignDraft[] = [];
        for (const file of selectedFiles) {
          const result = await api.uploadArtwork({
            file,
            sessionId: options.sessionId,
            purpose: 'reference',
            rightsConfirmed: true,
            placementCodes: selectedPlacements,
          });
          results.push(options.onSource(result));
        }
        setReferenceAssets((current) => appendReferenceAssets(current, results));
        options.onAnnouncement(
          `${results.length} reference image${results.length === 1 ? '' : 's'} ready.`
        );
      } catch (requestError) {
        fail(requestError);
      } finally {
        setGenerating(false);
      }
    },
    [clearError, fail, options, referenceAssets.length]
  );

  const removeReferenceAsset = useCallback(
    (assetId: string | null) => {
      setReferenceAssets((current) => current.filter((asset) => asset.id !== assetId));
      if (assetId && options.sessionId) void api.deleteUploadAsset(assetId, options.sessionId);
    },
    [options.sessionId]
  );

  const refineIdea = useCallback(
    async (product: CatalogProduct | null, selectedPlacements: string[]) => {
      if (!prompt.trim()) return;
      options.onFlowChange('refining');
      setRefining(true);
      clearError();
      try {
        const result = await api.designIdea({
          prompt,
          sessionId: options.sessionId,
          productId: product?.id,
          placementCodes: selectedPlacements,
        });
        setIdea(options.onSource(result));
        trackEvent('design_idea_refined', {
          result: result.source === 'live' ? 'success' : 'fixture',
          source: result.source === 'live' ? 'api' : 'fallback',
        });
        options.onFlowChange('configuring');
        options.onAnnouncement('Prompt refined. Review it, then generate your draft.');
      } catch (requestError) {
        trackEvent('design_idea_refined', {
          result: 'failed',
          source: options.dataSource === 'live' ? 'api' : 'fallback',
        });
        fail(requestError);
        options.onFlowChange('configuring');
      } finally {
        setRefining(false);
      }
    },
    [clearError, fail, options, prompt]
  );

  const generate = useCallback(
    async (context: StudioArtworkContext) => {
      if (!prompt.trim()) return;
      if (creationPath === 'reference' && !referenceAssets.some((asset) => asset.id)) return;
      options.onRecoveryClear();
      const controller = new AbortController();
      generationController.current = controller;
      setGenerating(true);
      options.onFlowChange('generating');
      options.onModeChange('generating');
      setGenerationPhase('Queued');
      options.onOperationStartedAt(Date.now());
      clearError();
      trackEvent('design_generation_started', {
        quality: 'standard',
        source: options.capabilities.ai === 'live' ? 'api' : 'fixture',
      });
      const phaseOne = window.setTimeout(() => setGenerationPhase('Generating artwork'), 1000);
      const phaseTwo = window.setTimeout(
        () => setGenerationPhase('Preparing the print file'),
        10000
      );
      let completionSource = options.capabilities.ai === 'live' ? 'api' : 'fixture';
      try {
        const [result] = await Promise.all([
          creationPath === 'reference'
            ? api.designFromReferences(
                {
                  prompt,
                  referenceAssetIds: referenceAssetIds(referenceAssets),
                  sessionId: options.sessionId,
                  productId: context.product.id,
                  variantId: context.variant.id,
                  placementCodes: context.selectedPlacements,
                },
                controller.signal
              )
            : api.designDraft(
                {
                  prompt: idea?.refinedPrompt ?? prompt,
                  sessionId: options.sessionId,
                  productId: context.product.id,
                  variantId: context.variant.id,
                  placementCodes: context.selectedPlacements,
                },
                controller.signal
              ),
          // Avoid flashing a completed progress screen on very fast fixture responses.
          minimumGenerationDwell(1500, controller.signal),
        ]);
        completionSource = result.source === 'live' ? 'api' : 'fixture';
        const draft = options.onSource(result);
        assertUsableGeneratedDraft(draft);
        const nextPlacementArtwork = acceptArtworkDraft({
          draft,
          activePlacementCode,
          selectedPlacements: context.selectedPlacements,
          placementArtwork,
        });
        if (design?.id) setDesignHistory((current) => appendDesignHistory(current, design));
        setDesign(draft);
        setPlacementArtwork(nextPlacementArtwork);
        setActivePlacementCode('');
        options.onFlowChange('drafted');
        options.onAnnouncement('Artwork ready. Building your product mockup now.');
        trackEvent('design_generation_completed', {
          result: 'success',
          source: result.source === 'live' ? 'api' : 'fixture',
        });
        setGenerating(false);
        options.onOperationStartedAt(null);
        await options.onArtworkCommit({
          ...context,
          kind: 'replacement',
          draft,
          placementArtwork: nextPlacementArtwork,
        });
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') {
          trackEvent('design_generation_completed', {
            result: 'cancelled',
            source: completionSource,
          });
          options.onFlowChange('configuring');
          options.onModeChange('describe');
          options.onAnnouncement(
            'Generation cancelled on this screen. Your prompt is unchanged. If provider processing already started, a draft may still be counted.'
          );
        } else {
          trackEvent('design_generation_completed', {
            result: 'failed',
            source: completionSource,
          });
          fail(requestError);
          options.onFlowChange('configuring');
          options.onModeChange('describe');
        }
      } finally {
        window.clearTimeout(phaseOne);
        window.clearTimeout(phaseTwo);
        setGenerating(false);
        options.onOperationStartedAt(null);
        generationController.current = null;
      }
    },
    [
      activePlacementCode,
      clearError,
      creationPath,
      design,
      fail,
      idea?.refinedPrompt,
      options,
      placementArtwork,
      prompt,
      referenceAssets,
    ]
  );

  const cancelGeneration = useCallback(() => generationController.current?.abort(), []);

  const reviseDraft = useCallback(
    async (context: StudioArtworkContext) => {
      if (!design?.id || !revision.trim()) return;
      options.onRecoveryClear();
      if (!canRevise) {
        setError({
          cause: 'revision_allowance_required',
          title: 'No more variations are available in this studio session',
          message: 'This session has no revision allowance remaining.',
          recovery: 'Your current artwork, product preview, and price are unchanged.',
          retryable: false,
        });
        options.onAnnouncement('Revision blocked. Your current artwork is unchanged.');
        return;
      }
      setRevising(true);
      options.onModeChange('generating');
      clearError();
      try {
        const result = await api.reviseDraft({
          draftId: design.id,
          instructions: revision,
          sessionId: options.sessionId,
        });
        const revised = options.onSource(result);
        const nextPlacementArtwork = replaceDraftAssignments(placementArtwork, design.id, revised);
        setDesignHistory((current) => appendDesignHistory(current, design));
        setDesign(revised);
        setPlacementArtwork(nextPlacementArtwork);
        setRevision('');
        options.onFlowChange('drafted');
        options.onAnnouncement('New variation ready. Rebuilding your product mockup.');
        trackEvent('design_revision_completed', {
          result: 'success',
          remaining: revisionBand(revised.allowance.editsRemaining),
        });
        setRevising(false);
        await options.onArtworkCommit({
          ...context,
          kind: 'revision',
          draft: revised,
          placementArtwork: nextPlacementArtwork,
        });
        options.onModeChange('review');
      } catch (requestError) {
        trackEvent('design_revision_completed', {
          result: 'failed',
          remaining: revisionBand(design.allowance.editsRemaining),
        });
        fail(requestError);
        options.onModeChange('review');
      } finally {
        setRevising(false);
      }
    },
    [canRevise, clearError, design, fail, options, placementArtwork, revision]
  );

  const undoDraft = useCallback(
    async (context: StudioArtworkContext) => {
      const undone = undoArtworkRevision({
        history: designHistory,
        currentDesign: design,
        placementArtwork,
      });
      if (!undone) return;
      setDesignHistory(undone.history);
      setDesign(undone.design);
      setPlacementArtwork(undone.placementArtwork);
      setRevision('');
      options.onAnnouncement('Previous artwork restored. Rebuilding its product preview.');
      trackEvent('design_revision_completed', {
        result: 'undone',
        remaining: revisionBand(undone.design.allowance.editsRemaining),
      });
      await options.onArtworkCommit({
        ...context,
        kind: 'undo',
        draft: undone.design,
        placementArtwork: undone.placementArtwork,
      });
    },
    [design, designHistory, options, placementArtwork]
  );

  useEffect(
    () => () => {
      generationController.current?.abort();
    },
    []
  );

  return {
    prompt,
    setPrompt,
    updatePrompt,
    creationPath,
    setCreationPath,
    referenceAssets,
    setReferenceAssets,
    revision,
    setRevision,
    idea,
    setIdea,
    design,
    setDesign,
    placementArtwork,
    setPlacementArtwork,
    activePlacementCode,
    setActivePlacementCode,
    designHistory,
    setDesignHistory,
    generationPhase,
    busy: { refining, generating, revising },
    error,
    clearError,
    canGenerateAnother,
    canRevise,
    uploadArtwork,
    addReferenceImages,
    removeReferenceAsset,
    refineIdea,
    generate,
    cancelGeneration,
    reviseDraft,
    undoDraft,
  };
}
