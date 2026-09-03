import { VariantSelector } from './VariantSelector';
import type { ConfigurationPanelProps } from './ConfigurationPanel.types';
import { formatMoney } from '../utils/currency';

export function ConfigurationPanel({
  product,
  variant,
  selectedPlacements,
  quote,
  quoteStale,
  mugLayout,
  orientation,
  onVariantChange,
  onTogglePlacement,
  onMugLayoutChange,
  onOrientationChange,
  onContinue,
}: ConfigurationPanelProps) {
  const quoteItem = quote?.items[0];

  const placementPrice = (code: string, fallbackCents?: number) => {
    const quotedCents = quoteItem?.placements.find(
      (placement) => placement.code === code
    )?.additionalCostCents;
    if (selectedPlacements.includes(code) && !quoteStale && quotedCents) {
      return `+${formatMoney(quotedCents, quote?.currency)} production`;
    }
    return fallbackCents
      ? `About +${formatMoney(fallbackCents)} when added`
      : 'Additional print charge when added';
  };

  return (
    <div className="panel-stack">
      <VariantSelector product={product} selectedVariant={variant} onChange={onVariantChange} />
      {product.placements.length > 1 && (
        <fieldset className="print-area-picker">
          <legend>Print areas</legend>
          <p className="selection-help">
            Your first print is included in the product price. Add the other side for a second
            production charge.
          </p>
          <div className="placement-options compact-options print-area-options">
            {product.placements.map((placement) => (
              <button
                key={placement.code}
                type="button"
                aria-pressed={selectedPlacements.includes(placement.code)}
                onClick={() => onTogglePlacement(placement.code)}
              >
                <b>{placement.displayName}</b>
                <small>
                  {selectedPlacements[0] === placement.code
                    ? 'First print included'
                    : placementPrice(placement.code, placement.additionalPriceCents)}
                </small>
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {product.categorySlug === 'drinkware' && (
        <fieldset className="mug-layout-picker">
          <legend>Artwork position around the mug</legend>
          <p className="selection-help">
            This moves one design inside the mug’s wraparound print area and does not add another
            print charge.
          </p>
          <div className="placement-options compact-options">
            {(
              [
                ['center', 'Centered'],
                ['left', 'Shift left'],
                ['right', 'Shift right'],
              ] as const
            ).map(([layout, label]) => (
              <button
                key={layout}
                type="button"
                aria-pressed={mugLayout === layout}
                onClick={() => onMugLayoutChange(layout)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {product.categorySlug === 'wall-art' && (
        <fieldset>
          <legend>Orientation</legend>
          <div className="placement-options compact-options">
            {orientation === 'square' ? (
              <button type="button" aria-pressed="true">
                Square
              </button>
            ) : (
              <>
                <button
                  type="button"
                  aria-pressed={orientation === 'landscape'}
                  onClick={() => onOrientationChange('landscape')}
                >
                  Landscape
                </button>
                <button
                  type="button"
                  aria-pressed={orientation === 'portrait'}
                  onClick={() => onOrientationChange('portrait')}
                >
                  Portrait
                </button>
              </>
            )}
          </div>
        </fieldset>
      )}
      <button className="button button--primary button--wide" type="button" onClick={onContinue}>
        Continue
      </button>
    </div>
  );
}
