import type { Publication } from './collection-publications.repository.js';
import { layoutPixels } from './collection-print-render.js';

/** Metadata-only checks. Passing them does not verify file bytes or authorize a purchase. */
export function collectionLayoutIssues(
  entry: Publication,
  itemIds = entry.collection.items.map((item) => item.id)
) {
  const issues: string[] = [];
  for (const id of itemIds) {
    const item = entry.collection.items.find((item) => item.id === id);
    if (!item) {
      issues.push('Select a product from this published collection.');
      continue;
    }
    if (item.artworkMode !== 'fixed')
      issues.push(
        `${item.title}: customer personalization is not available for collection orders yet.`
      );
    if (!item.placementCodes.length) issues.push(`${item.title}: select at least one print area.`);
    for (const code of item.placementCodes) {
      const layouts =
        entry.printLayouts?.layouts.filter(
          (layout) => layout.itemId === id && layout.placementCode === code
        ) ?? [];
      const area = entry.review.areas.find(
        (area) => area.itemId === id && area.placementCode === code
      );
      if (!entry.printLayouts?.templateConfirmedAt || layouts.length !== 1 || !area) {
        issues.push(`${item.title} · ${code}: save and confirm a print layout.`);
        continue;
      }
      try {
        layoutPixels(layouts[0], area);
      } catch {
        issues.push(`${item.title} · ${code}: correct the saved template dimensions or offsets.`);
      }
    }
  }
  return issues;
}
