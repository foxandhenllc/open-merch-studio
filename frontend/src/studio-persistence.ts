import type { DesignMockup } from './types/catalog';

export type StudioResumeState = {
  version: 5;
  savedAt: string;
  sessionId: string;
  selectedCategory: string;
  productId: string;
  variantId: string;
  quantity: number;
  placementCodes: string[];
  placementDesignAssetIds: Record<string, string>;
  mugLayout?: 'center' | 'left' | 'right';
  orientation?: 'portrait' | 'landscape' | 'square';
  prompt: string;
  designId?: string;
  referenceAssetIds: string[];
  mockup?: DesignMockup;
  mockupViewIndex: number;
  quoteId?: string;
};

const STORAGE_KEY = 'open-merch-studio:guest-workbench:v1';
const RESUME_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type PersistableStudioResumeState = Omit<StudioResumeState, 'savedAt'>;
type StoredStudioResumeState = Omit<Partial<StudioResumeState>, 'version' | 'savedAt'> & {
  version?: 2 | 3 | 4 | 5;
  savedAt?: unknown;
};

const removeSavedState = () => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browsing contexts.
  }
};

const isCurrentSavedAt = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const savedAt = Date.parse(value);
  if (!Number.isFinite(savedAt)) return false;
  const age = Date.now() - savedAt;
  return age >= 0 && age <= RESUME_TTL_MS;
};

export function readStudioResumeState(): StudioResumeState | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as StoredStudioResumeState;
    if (
      ![2, 3, 4, 5].includes(Number(parsed.version)) ||
      typeof parsed.sessionId !== 'string' ||
      !parsed.sessionId
    ) {
      removeSavedState();
      return null;
    }
    if (!isCurrentSavedAt(parsed.savedAt)) {
      removeSavedState();
      return null;
    }
    const restored: StudioResumeState = {
      version: 5,
      savedAt: parsed.savedAt,
      sessionId: parsed.sessionId,
      selectedCategory: typeof parsed.selectedCategory === 'string' ? parsed.selectedCategory : '',
      productId: typeof parsed.productId === 'string' ? parsed.productId : '',
      variantId: typeof parsed.variantId === 'string' ? parsed.variantId : '',
      quantity:
        typeof parsed.quantity === 'number' && Number.isInteger(parsed.quantity)
          ? Math.min(25, Math.max(1, parsed.quantity))
          : 1,
      placementCodes: Array.isArray(parsed.placementCodes)
        ? parsed.placementCodes.filter((value): value is string => typeof value === 'string')
        : [],
      placementDesignAssetIds:
        parsed.placementDesignAssetIds &&
        typeof parsed.placementDesignAssetIds === 'object' &&
        !Array.isArray(parsed.placementDesignAssetIds)
          ? Object.fromEntries(
              Object.entries(parsed.placementDesignAssetIds).filter(
                (entry): entry is [string, string] =>
                  typeof entry[0] === 'string' && typeof entry[1] === 'string'
              )
            )
          : {},
      mugLayout: ['center', 'left', 'right'].includes(String(parsed.mugLayout))
        ? (parsed.mugLayout as 'center' | 'left' | 'right')
        : undefined,
      orientation: ['portrait', 'landscape', 'square'].includes(String(parsed.orientation))
        ? parsed.orientation
        : undefined,
      prompt: typeof parsed.prompt === 'string' ? parsed.prompt : '',
      designId: typeof parsed.designId === 'string' ? parsed.designId : undefined,
      referenceAssetIds: Array.isArray(parsed.referenceAssetIds)
        ? parsed.referenceAssetIds.filter((value): value is string => typeof value === 'string').slice(0, 5)
        : [],
      mockup:
        parsed.mockup &&
        typeof parsed.mockup === 'object' &&
        parsed.mockup.status === 'complete' &&
        typeof parsed.mockup.imageUrl === 'string'
          ? (parsed.mockup as DesignMockup)
          : undefined,
      mockupViewIndex:
        typeof parsed.mockupViewIndex === 'number' && parsed.mockupViewIndex >= 0
          ? Math.floor(parsed.mockupViewIndex)
          : 0,
      quoteId: typeof parsed.quoteId === 'string' ? parsed.quoteId : undefined,
    };
    return restored;
  } catch {
    removeSavedState();
    return null;
  }
}

export function writeStudioResumeState(state: PersistableStudioResumeState): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...state, savedAt: new Date().toISOString() } satisfies StudioResumeState)
    );
  } catch {
    // A private browsing quota failure should not interrupt the active studio session.
  }
}

export function clearStudioResumeState(): void {
  removeSavedState();
}
