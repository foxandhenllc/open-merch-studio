import type { CSSProperties } from 'react';
import type { CatalogProduct, CatalogVariant } from '@app-types/catalog';

const money = (cents: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);

const uniqueValues = (variants: CatalogVariant[], key: 'color' | 'size') => {
  const seen = new Set<string>();
  return variants.flatMap((variant) => {
    const value = variant[key]?.trim();
    if (!value || seen.has(value)) return [];
    seen.add(value);
    return [value];
  });
};

export function VariantSelector({
  product,
  selectedVariant,
  onChange,
}: {
  product: CatalogProduct;
  selectedVariant: CatalogVariant;
  onChange: (variantId: string) => void;
}) {
  const available = product.variants.filter((variant) => variant.isAvailable);
  const colors = uniqueValues(product.variants, 'color');
  const sizes = uniqueValues(product.variants, 'size');
  const structuredApparel =
    product.categorySlug === 'apparel' &&
    available.length > 0 &&
    colors.length > 0 &&
    sizes.length > 0 &&
    available.every((variant) => variant.color && variant.size);

  if (!structuredApparel) {
    return (
      <label className="variant-select">
        <span>Style &amp; size</span>
        <select value={selectedVariant.id} onChange={(event) => onChange(event.target.value)}>
          {product.variants.map((variant) => (
            <option key={variant.id} value={variant.id} disabled={!variant.isAvailable}>
              {variant.name} —{' '}
              {variant.isAvailable
                ? variant.retailEstimateCents
                  ? `est. ${money(variant.retailEstimateCents)}`
                  : 'estimate after selection'
                : 'unavailable'}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const selectedColor = selectedVariant.color ?? colors[0];
  const selectedSize = selectedVariant.size ?? sizes[0];
  const chooseColor = (color: string) => {
    const matching = available.filter((variant) => variant.color === color);
    const next = matching.find((variant) => variant.size === selectedSize) ?? matching[0];
    if (next) onChange(next.id);
  };
  const chooseSize = (size: string) => {
    const next = available.find(
      (variant) => variant.color === selectedColor && variant.size === size
    );
    if (next) onChange(next.id);
  };

  return (
    <div className="apparel-variants">
      <fieldset className="color-selector" aria-describedby="variant-selection-summary">
        <legend>Color</legend>
        <div className="color-options">
          {colors.map((color) => {
            const colorVariant =
              available.find(
                (variant) => variant.color === color && variant.size === selectedSize
              ) ?? available.find((variant) => variant.color === color);
            const selected = color === selectedColor;
            return (
              <button
                key={color}
                type="button"
                className="color-option"
                aria-label={color}
                aria-pressed={selected}
                disabled={!colorVariant}
                onClick={() => chooseColor(color)}
              >
                <span
                  className="color-option__swatch"
                  style={
                    {
                      '--variant-color': colorVariant?.colorCode || '#f2f1ed',
                    } as CSSProperties
                  }
                  aria-hidden="true"
                />
                <span>{color}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="size-selector" aria-describedby="variant-selection-summary">
        <legend>Size</legend>
        <div className="size-options">
          {sizes.map((size) => {
            const variant = product.variants.find(
              (candidate) => candidate.color === selectedColor && candidate.size === size
            );
            const availableForColor = Boolean(variant?.isAvailable);
            return (
              <button
                key={size}
                type="button"
                aria-pressed={size === selectedSize}
                disabled={!availableForColor}
                onClick={() => chooseSize(size)}
              >
                {size}
              </button>
            );
          })}
        </div>
      </fieldset>

      <p id="variant-selection-summary" className="variant-selection-summary" aria-live="polite">
        <strong>
          {selectedColor} · {selectedSize}
        </strong>
        <span>
          {selectedVariant.retailEstimateCents
            ? `Estimated total ${money(selectedVariant.retailEstimateCents)}`
            : 'Final estimate appears after artwork is ready.'}
        </span>
      </p>
    </div>
  );
}
