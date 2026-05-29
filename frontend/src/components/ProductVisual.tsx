import type { CSSProperties } from 'react';
import type { ProductVisualProps } from './ProductVisual.types';

const initials = (title: string) =>
  title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

export function ProductVisual({ category, title, color }: ProductVisualProps) {
  return (
    <div className={`product-visual product-visual--${category || 'default'}`}>
      <div className="product-visual__surface" style={{ '--swatch': color || '#14b8a6' } as CSSProperties}>
        <span>{initials(title)}</span>
      </div>
    </div>
  );
}
