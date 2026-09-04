import type { CustomerOrderAccess } from './customer-order-access.service.js';

/**
 * Builds a capability handoff without exposing the bearer in an HTTP request.
 *
 * URL fragments are handled only by the browser. The frontend captures and removes this fragment
 * before mounting analytics, then sends the token solely in an Authorization header.
 */
export function customerOrderRevisitUrl(frontendUrl: string, access: CustomerOrderAccess): string {
  const url = new URL('/', frontendUrl);
  url.hash = new URLSearchParams({ order: access.orderId, access: access.token }).toString();
  return url.toString();
}
