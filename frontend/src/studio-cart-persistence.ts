import { MAX_STUDIO_CART_LINES, type StudioCartItem } from './studio-cart';

const STORAGE_KEY = 'open-merch-studio:guest-cart:v1';

type StoredCart = {
  version: 1;
  sessionId: string;
  savedAt: string;
  items: StudioCartItem[];
};

const validItem = (value: unknown): value is StudioCartItem => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<StudioCartItem>;
  return Boolean(
    typeof item.id === 'string' &&
      typeof item.addedAt === 'string' &&
      typeof item.productTitle === 'string' &&
      typeof item.variantName === 'string' &&
      item.line &&
      typeof item.line.productId === 'string' &&
      typeof item.line.variantId === 'string' &&
      Number.isInteger(item.line.quantity) &&
      item.line.quantity >= 1 &&
      item.line.quantity <= 25 &&
      Array.isArray(item.line.placementCodes)
  );
};

/** Restores only cart lines owned by the active guest design session. */
export function readStudioCart(sessionId: string): StudioCartItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const stored = JSON.parse(raw) as Partial<StoredCart>;
    if (stored.version !== 1 || stored.sessionId !== sessionId || !Array.isArray(stored.items)) {
      return [];
    }
    return stored.items.filter(validItem).slice(0, MAX_STUDIO_CART_LINES);
  } catch {
    return [];
  }
}

export function writeStudioCart(sessionId: string, items: StudioCartItem[]): void {
  try {
    const stored: StoredCart = {
      version: 1,
      sessionId,
      savedAt: new Date().toISOString(),
      items: items.slice(0, MAX_STUDIO_CART_LINES),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // The cart remains usable in memory when browser storage is unavailable.
  }
}

export function clearStudioCart(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browsing contexts.
  }
}
