/**
 * Stable Printful facade.
 *
 * Application code may keep importing this historical module while each provider concern lives in
 * an independently testable service. New domain-internal code should import its focused module.
 */
export { syncFixtureCatalog, syncPrintfulCatalog } from './printful-catalog-sync.service.js';
export { describePrintfulError } from './printful-client.service.js';
export {
  buildPrintfulMockupPayload,
  buildPrintfulMockupTaskPayload,
  extractMockupViews,
  generatePrintfulMockupPreview,
  normalizePrintfulTechnique,
} from './printful-mockup.service.js';
export {
  buildPrintfulOrderPayload,
  classifyPrintfulFailure,
  fetchPrintfulOrderByExternalId,
  fetchPrintfulOrderStatus,
  mapPrintfulOrderStatus,
  normalizeCountryCode,
  normalizeStateCode,
  submitPrintfulDraftOrder,
  submitPrintfulDraftOrderWithClient,
  type SubmitPrintfulDraftOrderParams,
} from './printful-order.service.js';
export {
  fetchPrintfulVariantPricing,
  type PrintfulVariantPricing,
} from './printful-pricing.service.js';
