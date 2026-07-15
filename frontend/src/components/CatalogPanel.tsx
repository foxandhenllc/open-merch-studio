import type { Ref } from 'react';
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
  selectedVariantId,
  onCategory,
  onSelect,
  onClose,
  headingRef,
}: {
  categories: CatalogCategory[];
  products: CatalogProduct[];
  category: string;
  loading: boolean;
  selectedProductId: string;
  selectedVariantId?: string;
  onCategory: (category: string) => void;
  onSelect: (product: CatalogProduct) => void;
  onClose?: () => void;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <section className="catalog" aria-labelledby="catalog-title" aria-busy={loading}>
      <div className="section-heading">
        <div>
          <h1 id="catalog-title" tabIndex={-1} ref={headingRef}>
            Choose a product
          </h1>
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
            <p>Try another category, or browse every product currently available.</p>
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
            const selected = selectedProductId === product.id;
            const variant =
              (selected
                ? product.variants.find((item) => item.id === selectedVariantId && item.isAvailable)
                : undefined) ??
              product.variants.find((item) => item.isAvailable) ??
              product.variants[0];
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
                  <small>{product.categoryTitle || product.type || 'Catalog item'}</small>
                </span>
                <span className="product-row__price">
                  <small>{selected ? 'current estimate' : 'from'}</small>
                  <b>
                    {variant?.retailEstimateCents
                      ? money(variant.retailEstimateCents)
                      : 'After sync'}
                  </b>
                </span>
              </button>
            );
          })}
      </div>
    </section>
  );
}
