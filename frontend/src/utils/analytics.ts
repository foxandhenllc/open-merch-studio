import { track } from '@vercel/analytics';

type AnalyticsValue = string | number | boolean | null;
type AnalyticsProperties = Record<string, AnalyticsValue | undefined>;

export const trackEvent = (name: string, properties: AnalyticsProperties = {}) => {
  try {
    const entries = Object.entries(properties).filter(
      (entry): entry is [string, AnalyticsValue] => entry[1] !== undefined
    );
    if (entries.length > 2 && import.meta.env.DEV) {
      console.warn(
        `[analytics] ${name} supplied ${entries.length} properties; only the first two will be sent.`
      );
    }
    track(name, Object.fromEntries(entries.slice(0, 2)));
  } catch {
    // Product actions must never depend on analytics intake.
  }
};

export const totalBand = (totalCents: number) => {
  if (totalCents < 2500) return 'under_25';
  if (totalCents < 5000) return '25_49';
  if (totalCents < 10000) return '50_99';
  return '100_plus';
};

export const revisionBand = (remaining: number) =>
  remaining <= 0 ? '0' : remaining === 1 ? '1' : '2_plus';

export const productType = (category?: string | null) => {
  if (category === 'wall-art') return 'wall_art';
  if (category?.includes('apparel') || category?.includes('shirt')) return 'apparel';
  if (category?.includes('accessor')) return 'accessory';
  return 'other';
};
