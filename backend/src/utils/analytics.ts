import { track } from '@vercel/analytics/server';

type AnalyticsValue = string | number | boolean | null;

export async function trackServerEvent(
  name: string,
  properties: Record<string, AnalyticsValue | undefined>,
  headers: Record<string, string | string[] | undefined>
) {
  try {
    const entries = Object.entries(properties).filter(
      (entry): entry is [string, AnalyticsValue] => entry[1] !== undefined
    );
    await track(name, Object.fromEntries(entries.slice(0, 2)), { headers });
  } catch {
    // Webhook and order success must not depend on analytics intake.
  }
}
