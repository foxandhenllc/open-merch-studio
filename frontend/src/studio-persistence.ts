import type { DesignMockup } from './types/catalog';

export type StudioResumeState = {
  version: 1;
  sessionId: string;
  selectedCategory: string;
  productId: string;
  variantId: string;
  placementCodes: string[];
  orientation?: 'portrait' | 'landscape' | 'square';
  prompt: string;
  designId?: string;
  mockup?: DesignMockup;
  mockupViewIndex: number;
  quoteId?: string;
};

const STORAGE_KEY = 'open-merch-studio:guest-workbench:v1';

export function readStudioResumeState(): StudioResumeState | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<StudioResumeState>;
    if (parsed.version !== 1 || typeof parsed.sessionId !== 'string' || !parsed.sessionId) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      version: 1,
      sessionId: parsed.sessionId,
      selectedCategory:
        typeof parsed.selectedCategory === 'string' ? parsed.selectedCategory : '',
      productId: typeof parsed.productId === 'string' ? parsed.productId : '',
      variantId: typeof parsed.variantId === 'string' ? parsed.variantId : '',
      placementCodes: Array.isArray(parsed.placementCodes)
        ? parsed.placementCodes.filter((value): value is string => typeof value === 'string')
        : [],
      orientation: ['portrait', 'landscape', 'square'].includes(String(parsed.orientation))
        ? parsed.orientation
        : undefined,
      prompt: typeof parsed.prompt === 'string' ? parsed.prompt : '',
      designId: typeof parsed.designId === 'string' ? parsed.designId : undefined,
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
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function writeStudioResumeState(state: StudioResumeState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // A private browsing quota failure should not interrupt the active studio session.
  }
}
