import { useEffect, useMemo, useState } from 'react';
import { api } from '@services/api';
import type {
  CatalogCategory,
  CatalogProduct,
  CatalogVariant,
  DesignDraft,
  PlacementOption,
  QuoteBreakdown,
} from '@app-types/catalog';
import { ProductVisual } from '@components/ProductVisual';

const formatMoney = (cents: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);

const firstAvailableVariant = (product: CatalogProduct): CatalogVariant | null =>
  product.variants.find((variant) => variant.isAvailable) ?? product.variants[0] ?? null;

const defaultPlacement = (product: CatalogProduct): PlacementOption | null =>
  product.placements.find((placement) => placement.isDefault) ?? product.placements[0] ?? null;

export default function App() {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [selectedPlacements, setSelectedPlacements] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('A precise geometric mark for a small business launch');
  const [design, setDesign] = useState<DesignDraft | null>(null);
  const [quote, setQuote] = useState<QuoteBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([api.categories(), api.products()])
      .then(([categoryData, productData]) => {
        if (!mounted) return;
        setCategories(categoryData);
        setProducts(productData);
        const firstProduct = productData[0];
        if (firstProduct) {
          setSelectedProductId(firstProduct.id);
          const variant = firstAvailableVariant(firstProduct);
          const placement = defaultPlacement(firstProduct);
          if (variant) setSelectedVariantId(variant.id);
          if (placement) setSelectedPlacements([placement.code]);
        }
      })
      .catch((caught: Error) => setError(caught.message))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    api
      .products(selectedCategory || undefined)
      .then((productData) => {
        setProducts(productData);
        const firstProduct = productData[0];
        if (firstProduct) {
          setSelectedProductId(firstProduct.id);
          const variant = firstAvailableVariant(firstProduct);
          const placement = defaultPlacement(firstProduct);
          setSelectedVariantId(variant?.id ?? '');
          setSelectedPlacements(placement ? [placement.code] : []);
        }
      })
      .catch((caught: Error) => setError(caught.message));
  }, [selectedCategory]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  const selectedVariant = useMemo(
    () => selectedProduct?.variants.find((variant) => variant.id === selectedVariantId) ?? null,
    [selectedProduct, selectedVariantId]
  );

  const togglePlacement = (code: string) => {
    setSelectedPlacements((current) => {
      if (current.includes(code)) {
        const next = current.filter((placement) => placement !== code);
        return next.length ? next : current;
      }
      return [...current, code];
    });
  };

  const createDraft = async () => {
    setBusy(true);
    setError(null);
    try {
      const draft = await api.designDraft(prompt);
      setDesign(draft);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to create design draft');
    } finally {
      setBusy(false);
    }
  };

  const createQuote = async () => {
    if (!selectedProduct || !selectedVariant) return;
    setBusy(true);
    setError(null);
    try {
      const nextQuote = await api.quote({
        items: [
          {
            productId: selectedProduct.id,
            variantId: selectedVariant.id,
            quantity: 1,
            placementCodes: selectedPlacements,
            designAssetId: design?.id ?? undefined,
          },
        ],
      });
      setQuote(nextQuote);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to create quote');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <main className="shell">Loading catalog...</main>;
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Open-source merch operations</p>
          <h1>Open Merch Studio</h1>
        </div>
        <a className="repo-link" href="https://github.com/FoxAndHenLLC/open-merch-studio">
          GitHub
        </a>
      </header>

      {error && <div className="notice">{error}</div>}

      <section className="workspace">
        <aside className="catalog-panel" aria-label="Catalog">
          <div className="panel-heading">
            <h2>Catalog</h2>
            <span>{products.length} products</span>
          </div>
          <div className="category-row">
            <button
              className={!selectedCategory ? 'is-active' : ''}
              onClick={() => setSelectedCategory('')}
              type="button"
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                className={selectedCategory === category.slug ? 'is-active' : ''}
                onClick={() => setSelectedCategory(category.slug)}
                type="button"
              >
                {category.title}
              </button>
            ))}
          </div>
          <div className="product-list">
            {products.map((product) => {
              const variant = firstAvailableVariant(product);
              return (
                <button
                  key={product.id}
                  className={`product-card ${selectedProductId === product.id ? 'is-selected' : ''}`}
                  onClick={() => {
                    setSelectedProductId(product.id);
                    setSelectedVariantId(variant?.id ?? '');
                    const placement = defaultPlacement(product);
                    setSelectedPlacements(placement ? [placement.code] : []);
                    setQuote(null);
                  }}
                  type="button"
                >
                  <ProductVisual
                    category={product.categorySlug}
                    title={product.title}
                    color={variant?.colorCode}
                  />
                  <span>
                    <strong>{product.title}</strong>
                    <small>{product.categoryTitle || product.type || 'Catalog item'}</small>
                  </span>
                  <b>{variant ? formatMoney(variant.costCents) : 'Sync'}</b>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="studio-panel" aria-label="Studio">
          {selectedProduct && selectedVariant ? (
            <>
              <div className="product-stage">
                <ProductVisual
                  category={selectedProduct.categorySlug}
                  title={selectedProduct.title}
                  color={selectedVariant.colorCode}
                />
                {design && <img className="draft-preview" src={design.imageUrl} alt="Generated artwork draft" />}
              </div>

              <div className="editor-grid">
                <div className="field-block">
                  <label htmlFor="variant">Variant</label>
                  <select
                    id="variant"
                    value={selectedVariantId}
                    onChange={(event) => setSelectedVariantId(event.target.value)}
                  >
                    {selectedProduct.variants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.name} - {formatMoney(variant.costCents)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-block">
                  <label>Placement</label>
                  <div className="placement-grid">
                    {selectedProduct.placements.map((placement) => (
                      <button
                        key={placement.code}
                        className={selectedPlacements.includes(placement.code) ? 'is-active' : ''}
                        onClick={() => togglePlacement(placement.code)}
                        type="button"
                      >
                        {placement.displayName}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field-block prompt-block">
                  <label htmlFor="prompt">Design prompt</label>
                  <textarea
                    id="prompt"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    rows={4}
                  />
                </div>
              </div>

              <div className="actions">
                <button onClick={createDraft} disabled={busy} type="button">
                  Generate draft
                </button>
                <button onClick={createQuote} disabled={busy} type="button">
                  Price selection
                </button>
              </div>

              {design && (
                <section className="readiness">
                  <h2>Readiness</h2>
                  {design.readiness.checks.map((check) => (
                    <p key={check.label}>
                      <strong>{check.label}</strong>
                      <span>{check.result}</span>
                    </p>
                  ))}
                </section>
              )}
            </>
          ) : (
            <div className="empty-state">No sellable products available.</div>
          )}
        </section>

        <aside className="quote-panel" aria-label="Quote">
          <div className="panel-heading">
            <h2>Quote</h2>
            <span>{quote?.id ? `Saved ${quote.id.slice(0, 8)}` : 'Draft'}</span>
          </div>
          {quote ? (
            <div className="quote-table">
              <p>
                <span>Product cost</span>
                <strong>{formatMoney(quote.productCostCents, quote.currency)}</strong>
              </p>
              <p>
                <span>AI/design fee</span>
                <strong>{formatMoney(quote.aiDesignFeeCents, quote.currency)}</strong>
              </p>
              <p>
                <span>Margin</span>
                <strong>{formatMoney(quote.targetMarginCents, quote.currency)}</strong>
              </p>
              <p>
                <span>Shipping estimate</span>
                <strong>{formatMoney(quote.shippingEstimateCents, quote.currency)}</strong>
              </p>
              <p>
                <span>Payment fee estimate</span>
                <strong>{formatMoney(quote.paymentFeeCents, quote.currency)}</strong>
              </p>
              <p className="quote-total">
                <span>Total</span>
                <strong>{formatMoney(quote.totalCents, quote.currency)}</strong>
              </p>
            </div>
          ) : (
            <div className="quote-empty">
              <p>{selectedProduct?.title ?? 'Select a product'}</p>
              <strong>{selectedVariant ? formatMoney(selectedVariant.costCents) : '$0.00'}</strong>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
