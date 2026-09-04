import type { CustomerOrderAccess } from './types/catalog';

const STORAGE_KEY = 'open-merch-studio:order-access:v1';
const PENDING_REVISIT_KEY = 'open-merch-studio:pending-order-revisit:v1';
const TOKEN_PATTERN = /^oma_[A-Za-z0-9_-]{43}$/;
const ORDER_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

type StoredAccess = Record<string, string>;

const readAll = (): StoredAccess => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([orderId, token]) =>
          ORDER_ID_PATTERN.test(orderId) && typeof token === 'string' && TOKEN_PATTERN.test(token)
      )
    );
  } catch {
    return {};
  }
};

/** Keeps the bearer value in the customer's browser; it is never placed in a query string. */
export function saveCustomerOrderAccess(access: CustomerOrderAccess | undefined): void {
  if (!access || !TOKEN_PATTERN.test(access.token)) return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...readAll(), [access.orderId]: access.token })
    );
  } catch {
    // The current confirmation remains usable even when durable browser storage is unavailable.
  }
}

export function readCustomerOrderAccess(orderId: string): string | undefined {
  return readAll()[orderId];
}

/** Parses only the exact, bounded capability format produced by OMS customer email. */
export function parseCustomerOrderAccessHash(hash: string): CustomerOrderAccess | null {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const orderId = params.get('order') ?? '';
  const token = params.get('access') ?? '';
  if (!ORDER_ID_PATTERN.test(orderId) || !TOKEN_PATTERN.test(token)) return null;
  return { orderId, token };
}

/**
 * Captures an emailed capability before React, Vercel Analytics, or Speed Insights mount.
 * The fragment is removed synchronously so it cannot linger in screenshots or copied URLs.
 */
export function captureCustomerOrderAccessHandoff(): CustomerOrderAccess | null {
  const access = parseCustomerOrderAccessHash(window.location.hash);
  if (!access) return null;
  saveCustomerOrderAccess(access);
  try {
    window.sessionStorage.setItem(PENDING_REVISIT_KEY, access.orderId);
  } catch {
    // The saved bearer still supports a manual revisit within this browser.
  }
  window.history.replaceState(
    window.history.state,
    document.title,
    `${window.location.pathname}${window.location.search}`
  );
  return access;
}

export function readPendingCustomerOrderAccess(): CustomerOrderAccess | null {
  try {
    const orderId = window.sessionStorage.getItem(PENDING_REVISIT_KEY) ?? '';
    const token = ORDER_ID_PATTERN.test(orderId) ? readCustomerOrderAccess(orderId) : undefined;
    return token ? { orderId, token } : null;
  } catch {
    return null;
  }
}

export function clearPendingCustomerOrderAccess(): void {
  try {
    window.sessionStorage.removeItem(PENDING_REVISIT_KEY);
  } catch {
    // Nothing else depends on session storage cleanup.
  }
}
