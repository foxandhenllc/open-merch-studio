import type { DesignDraft } from './types/catalog';
import { ApiError } from './services/api-error';
import { artworkAssignmentsForDraft } from './studio-view-model.selectors';

export const MAX_REFERENCE_ASSETS = 5;

export function selectReferenceFiles<T>(files: T[], currentCount: number): T[] {
  const remaining = Math.max(0, MAX_REFERENCE_ASSETS - currentCount);
  return files.slice(0, remaining);
}

export function appendReferenceAssets(
  current: DesignDraft[],
  incoming: DesignDraft[]
): DesignDraft[] {
  return [...current, ...incoming].slice(0, MAX_REFERENCE_ASSETS);
}

export function referenceAssetIds(assets: DesignDraft[]): string[] {
  return assets.map((asset) => asset.id).filter((id): id is string => Boolean(id));
}

export function appendDesignHistory(
  history: DesignDraft[],
  current: DesignDraft | null
): DesignDraft[] {
  if (!current?.id || history.some((item) => item.id === current.id)) return history;
  return [...history, current];
}

export function acceptArtworkDraft(params: {
  draft: DesignDraft;
  activePlacementCode: string;
  selectedPlacements: string[];
  placementArtwork: Record<string, DesignDraft>;
}): Record<string, DesignDraft> {
  return artworkAssignmentsForDraft({
    draft: params.draft,
    activePlacementCode: params.activePlacementCode,
    selectedPlacements: params.selectedPlacements,
    placementArtwork: params.placementArtwork,
  });
}

/**
 * A revision replaces only placements that used the revised asset. Independent
 * front/back artwork must survive a revision made to the other print area.
 */
export function replaceDraftAssignments(
  placementArtwork: Record<string, DesignDraft>,
  previousDraftId: string,
  replacement: DesignDraft
): Record<string, DesignDraft> {
  return Object.fromEntries(
    Object.entries(placementArtwork).map(([code, assigned]) => [
      code,
      assigned.id === previousDraftId ? replacement : assigned,
    ])
  );
}

export function undoArtworkRevision(params: {
  history: DesignDraft[];
  currentDesign: DesignDraft | null;
  placementArtwork: Record<string, DesignDraft>;
}): {
  design: DesignDraft;
  history: DesignDraft[];
  placementArtwork: Record<string, DesignDraft>;
} | null {
  const design = params.history[params.history.length - 1];
  if (!design) return null;
  return {
    design,
    history: params.history.slice(0, -1),
    placementArtwork: params.currentDesign?.id
      ? replaceDraftAssignments(params.placementArtwork, params.currentDesign.id, design)
      : params.placementArtwork,
  };
}

export function assertUsableGeneratedDraft(draft: DesignDraft): void {
  if (draft.policy.status === 'blocked') {
    throw new ApiError(
      draft.policy.reasons[0] || 'The prompt was blocked by content policy.',
      400,
      'policy_blocked'
    );
  }
  if (draft.generationStatus === 'failed') {
    throw new ApiError(
      draft.policy.reasons[0] || 'Artwork generation did not complete. Please retry.',
      503,
      'design_generation_failed'
    );
  }
}
