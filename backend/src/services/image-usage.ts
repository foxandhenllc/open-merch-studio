import { imageModelCapabilities } from '../admin/image-models.js';

export type ImageUsageReceipt = {
  model: string;
  inputTextTokens: number;
  inputImageTokens: number;
  outputImageTokens: number;
  totalTokens: number;
  estimatedCostCents: number;
  costBasis: 'uncached-token-upper-estimate';
  ratesVersion: '2026-09-12';
};
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const tokens = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 100_000_000;
/** Keep only validated numeric usage. Cache discounts are not inferred from incomplete breakdowns. */
export function imageUsageReceipt(model: string, value: unknown): ImageUsageReceipt | null {
  if (!imageModelCapabilities(model)) return null;
  const usage = record(value),
    detail = record(usage?.input_tokens_details);
  const text = detail?.text_tokens,
    images = detail?.image_tokens,
    output = usage?.output_tokens;
  const input = usage?.input_tokens,
    total = usage?.total_tokens;
  if (
    !tokens(text) ||
    !tokens(images) ||
    !tokens(output) ||
    !tokens(input) ||
    !tokens(total) ||
    output === 0 ||
    input !== text + images ||
    total !== input + output
  )
    return null;
  return {
    model,
    inputTextTokens: text,
    inputImageTokens: images,
    outputImageTokens: output,
    totalTokens: total,
    estimatedCostCents: Math.ceil((text * 5 + images * 8 + output * 30) / 10_000),
    costBasis: 'uncached-token-upper-estimate',
    ratesVersion: '2026-09-12',
  };
}
