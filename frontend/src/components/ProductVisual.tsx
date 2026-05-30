import type { CSSProperties } from 'react';
import type { ProductVisualProps } from './ProductVisual.types';

const initials = (title: string) =>
  title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

// Public-safe, product-neutral glyphs used as lightweight category signals.
const categoryIcon: Record<string, string> = {
  apparel: '👕',
  hats: '🧢',
  drinkware: '☕',
  'wall-art': '🖼️',
  bags: '👜',
  stickers: '✦',
  'phone-cases': '📱',
  stationery: '📓',
};

export function ProductVisual({ category, title, color }: ProductVisualProps) {
  const key = category || 'default';
  const icon = categoryIcon[key] ?? '✺';
  return (
    <div className={`product-visual product-visual--${key}`} aria-hidden="true">
      <div className="product-visual__glow" />
      <div
        className="product-visual__surface"
        style={{ '--swatch': color || '#7c3aed' } as CSSProperties}
      >
        <span className="product-visual__icon">{icon}</span>
        <span className="product-visual__initials">{initials(title)}</span>
      </div>
    </div>
  );
}
