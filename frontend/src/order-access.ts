import type { CustomerOrderAccess } from './types/catalog';

const STORAGE_KEY = 'open-merch-studio:order-access:v1';
const TOKEN_PATTERN = /^oma_[A-Za-z0-9_-]{43}$/;

type StoredAccess = Record<string, string>;

const readAll = (): StoredAccess => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([orderId, token]) =>
          /^[A-Za-z0-9_-]{1,100}$/.test(orderId) &&
          typeof token === 'string' &&
          TOKEN_PATTERN.test(token)
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
