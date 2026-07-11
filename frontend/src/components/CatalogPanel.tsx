import type { CatalogCategory, CatalogProduct } from '@app-types/catalog';
import { ProductVisual } from './ProductVisual';

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export function CatalogPanel({
  categories,
  products,
  category,
  loading,
  selectedProductId,
  onCategory,
  onSelect,
  onClose,
}: {
  categories: CatalogCategory[];
  products: CatalogProduct[];
  category: string;
  loading: boolean;
  selectedProductId: string;
  onCategory: (category: string) => void;
  onSelect: (product: CatalogProduct) => void;
  onClose?: () => void;
}) {
  return (
    <aside className="catalog" aria-label="Product catalog" aria-busy={loading}>
      <div className="section-heading">
        <div>
          <span className="kicker">Curated catalog</span>
          <h2>Choose a product</h2>
        </div>
        {onClose && (
          <button
            className="icon-button sheet-close"
            type="button"
            onClick={onClose}
            aria-label="Close catalog"
          >
            ×
          </button>
        )}
      </div>
      <div className="category-tabs" aria-label="Product categories">
        <button type="button" aria-pressed={!category} onClick={() => onCategory('')}>
          All
        </button>
        {categories.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={category === item.slug}
            onClick={() => onCategory(item.slug)}
          >
            {item.title}
          </button>
        ))}
      </div>
      <div className="product-list">
        {loading &&
          Array.from({ length: 4 }).map((_, index) => (
            <div
              className="product-row product-row--skeleton skeleton"
              key={index}
              aria-hidden="true"
            />
          ))}
        {!loading && products.length === 0 && (
          <div className="empty-block">
            <strong>Nothing in this view yet.</strong>
            <p>
              This catalog is intentionally curated. Browse all products, or self-hosters can sync
              another Printful category.
            </p>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => onCategory('')}
            >
              Browse all products
            </button>
          </div>
        )}
        {!loading &&
          products.map((product) => {
            const variant =
              product.variants.find((item) => item.isAvailable) ?? product.variants[0];
            const selected = selectedProductId === product.id;
            return (
              <button
                className={`product-row ${selected ? 'is-selected' : ''}`}
                type="button"
                key={product.id}
                aria-pressed={selected}
                onClick={() => onSelect(product)}
              >
                <ProductVisual
                  category={product.categorySlug}
                  title={product.title}
                  color={variant?.colorCode}
                  imageUrl={product.thumbnailUrl}
                />
                <span className="product-row__copy">
                  <strong>{product.title}</strong>
                  <small>
                    {product.categoryTitle || product.type || 'Catalog item'} ·{' '}
                    {product.placements.length} placement
                    {product.placements.length === 1 ? '' : 's'}
                  </small>
                </span>
                <span className="product-row__price">
                  <small>from</small>
                  <b>{variant ? money(variant.costCents) : 'Price after sync'}</b>
                </span>
              </button>
            );
          })}
      </div>
    </aside>
  );
}
