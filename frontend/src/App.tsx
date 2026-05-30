import { useEffect, useMemo, useState } from 'react';
import { ProductVisual } from '@components/ProductVisual';
import { api } from '@services/api';
import type {
  AdminReport,
  CatalogCategory,
  CatalogProduct,
  CatalogVariant,
  CheckoutSession,
  DesignDraft,
  DesignIdea,
  DesignMockup,
  OrderSummary,
  PlacementOption,
  QuoteBreakdown,
  StudioPass,
  StudioSession,
} from '@app-types/catalog';

const formatMoney = (cents: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);

const firstAvailableVariant = (product: CatalogProduct): CatalogVariant | null =>
  product.variants.find((variant) => variant.isAvailable) ?? product.variants[0] ?? null;

const defaultPlacement = (product: CatalogProduct): PlacementOption | null =>
  product.placements.find((placement) => placement.isDefault) ?? product.placements[0] ?? null;

const statusLabel = (status: string) =>
  status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

function StepBadge({ index, label, active }: { index: number; label: string; active: boolean }) {
  return (
    <span className={`step-badge ${active ? 'is-active' : ''}`}>
      <b>{index}</b>
      {label}
    </span>
  );
}

export default function App() {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [session, setSession] = useState<StudioSession | null>(null);
  const [studioPass, setStudioPass] = useState<StudioPass | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [selectedPlacements, setSelectedPlacements] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('A precise geometric mark for a small business launch');
  const [revision, setRevision] = useState('Make it bolder and easier to read at small sizes');
  const [email, setEmail] = useState('');
  const [idea, setIdea] = useState<DesignIdea | null>(null);
  const [design, setDesign] = useState<DesignDraft | null>(null);
  const [mockup, setMockup] = useState<DesignMockup | null>(null);
  const [quote, setQuote] = useState<QuoteBreakdown | null>(null);
  const [checkout, setCheckout] = useState<CheckoutSession | null>(null);
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [adminReport, setAdminReport] = useState<AdminReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([api.categories(), api.products(), api.session(), api.adminReport()])
      .then(([categoryData, productData, sessionData, reportData]) => {
        if (!mounted) return;
        setCategories(categoryData);
        setProducts(productData);
        setSession(sessionData);
        setStudioPass(sessionData.studioPass ?? null);
        setAdminReport(reportData);
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
        if (firstProduct && !productData.some((product) => product.id === selectedProductId)) {
          setSelectedProductId(firstProduct.id);
          const variant = firstAvailableVariant(firstProduct);
          const placement = defaultPlacement(firstProduct);
          setSelectedVariantId(variant?.id ?? '');
          setSelectedPlacements(placement ? [placement.code] : []);
          setQuote(null);
          setMockup(null);
        }
      })
      .catch((caught: Error) => setError(caught.message));
  }, [selectedCategory, selectedProductId]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  const selectedVariant = useMemo(
    () => selectedProduct?.variants.find((variant) => variant.id === selectedVariantId) ?? null,
    [selectedProduct, selectedVariantId]
  );

  const step = quote ? 5 : mockup ? 4 : design ? 3 : idea ? 2 : selectedProduct ? 1 : 0;
  const selectedCategoryTitle =
    categories.find((category) => category.slug === selectedCategory)?.title ?? 'All products';

  const runAction = async <T,>(
    key: string,
    action: () => Promise<T>,
    done: (result: T) => void | Promise<void>
  ) => {
    setBusy(key);
    setError(null);
    try {
      const result = await action();
      await done(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Action failed.');
    } finally {
      setBusy(null);
    }
  };

  const selectProduct = (product: CatalogProduct) => {
    const variant = firstAvailableVariant(product);
    const placement = defaultPlacement(product);
    setSelectedProductId(product.id);
    setSelectedVariantId(variant?.id ?? '');
    setSelectedPlacements(placement ? [placement.code] : []);
    setQuote(null);
    setCheckout(null);
    setOrder(null);
    setMockup(null);
  };

  const togglePlacement = (code: string) => {
    setSelectedPlacements((current) => {
      if (current.includes(code)) {
        const next = current.filter((placement) => placement !== code);
        return next.length ? next : current;
      }
      return [...current, code];
    });
  };

  const refineIdea = () => {
    runAction(
      'idea',
      () =>
        api.designIdea({
          prompt,
          sessionId: session?.id,
          productId: selectedProduct?.id,
          placementCodes: selectedPlacements,
        }),
      setIdea
    );
  };

  const createDraft = () => {
    runAction(
      'draft',
      () =>
        api.designDraft({
          prompt: idea?.refinedPrompt ?? prompt,
          sessionId: session?.id,
          productId: selectedProduct?.id,
          variantId: selectedVariant?.id,
          placementCodes: selectedPlacements,
        }),
      setDesign
    );
  };

  const reviseDraft = () => {
    if (!design?.id) return;
    runAction(
      'revision',
      () =>
        api.reviseDraft({
          draftId: design.id ?? '',
          instructions: revision,
          sessionId: session?.id,
        }),
      setDesign
    );
  };

  const buyStudioPass = () => {
    if (!session) return;
    runAction(
      'pass',
      () => api.studioPassCheckout(session.id),
      (result) => {
        setCheckout(result);
        if (result.status === 'open' && result.checkoutUrl) {
          window.location.assign(result.checkoutUrl);
          return;
        }
        if (result.studioPassId) {
          setStudioPass({
            id: result.studioPassId,
            sessionId: session.id,
            status: 'simulated',
            priceCents: 500,
            creditCents: 500,
            includedRoughDrafts: 8,
            includedEdits: 2,
            includedFinals: 1,
            roughDraftsUsed: 0,
            editsUsed: 0,
            finalsUsed: 0,
            createdAt: new Date().toISOString(),
          });
        }
      }
    );
  };

  const createMockup = () => {
    if (!selectedProduct || !selectedVariant) return;
    runAction(
      'mockup',
      () =>
        api.mockup({
          sessionId: session?.id,
          productId: selectedProduct.id,
          variantId: selectedVariant.id,
          placementCodes: selectedPlacements,
          designAssetId: design?.id ?? undefined,
          imageUrl: design?.imageUrl,
        }),
      setMockup
    );
  };

  const createQuote = () => {
    if (!selectedProduct || !selectedVariant) return;
    runAction(
      'quote',
      () =>
        api.quote({
          sessionId: session?.id,
          studioPassId: studioPass?.id,
          items: [
            {
              productId: selectedProduct.id,
              variantId: selectedVariant.id,
              quantity: 1,
              placementCodes: selectedPlacements,
              designAssetId: design?.id ?? undefined,
            },
          ],
        }),
      setQuote
    );
  };

  const createCheckout = () => {
    if (!quote) return;
    runAction(
      'checkout',
      () =>
        api.checkout({
          quote,
          quoteId: quote.id,
          sessionId: session?.id,
          studioPassId: studioPass?.id,
          email: email || undefined,
          designAssetId: design?.id ?? undefined,
        }),
      async (result) => {
        setCheckout(result);
        if (result.status === 'open' && result.checkoutUrl) {
          window.location.assign(result.checkoutUrl);
          return;
        }
        const resultWithOrder = result as CheckoutSession & { order?: OrderSummary };
        if (resultWithOrder.order) {
          setOrder(resultWithOrder.order);
        } else if (result.orderId) {
          const nextOrder = await api.order(result.orderId);
          setOrder(nextOrder);
        }
      }
    );
  };

  if (loading) {
    return (
      <main className="loading-shell">
        <div>Loading Open Merch Studio...</div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">AI-first custom merch studio</p>
          <h1>Open Merch Studio</h1>
        </div>
        <nav className="top-actions" aria-label="Project links">
          <a href="https://github.com/FoxAndHenLLC/open-merch-studio">GitHub</a>
          <a href="/docs/tickets/launch/README.md">Roadmap</a>
        </nav>
      </header>

      {error && <div className="notice notice-error">{error}</div>}

      <section className="launch-strip" aria-label="Launch status">
        <div>
          <strong>Paid beta fixture mode</strong>
          <span>No live charges, generation, or fulfillment happen until private provider gates are enabled.</span>
        </div>
        <div className="launch-gates">
          {adminReport?.launchReadiness.gates.slice(0, 4).map((gate) => (
            <span key={gate.code} className={`gate gate-${gate.status}`}>
              {gate.label}
            </span>
          ))}
        </div>
      </section>

      <section className="workflow-steps" aria-label="Design workflow">
        <StepBadge index={1} label="Choose" active={step >= 1} />
        <StepBadge index={2} label="Refine" active={step >= 2} />
        <StepBadge index={3} label="Draft" active={step >= 3} />
        <StepBadge index={4} label="Mockup" active={step >= 4} />
        <StepBadge index={5} label="Checkout" active={step >= 5} />
      </section>

      <section className="shop-grid">
        <aside className="panel catalog-panel" aria-label="Catalog">
          <div className="panel-heading">
            <div>
              <h2>{selectedCategoryTitle}</h2>
              <p>{products.length} curated launch products</p>
            </div>
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
                  onClick={() => selectProduct(product)}
                  type="button"
                >
                  <ProductVisual
                    category={product.categorySlug}
                    title={product.title}
                    color={variant?.colorCode}
                  />
                  <span>
                    <strong>{product.title}</strong>
                    <small>
                      {product.categoryTitle || product.type || 'Catalog item'} |{' '}
                      {product.placements.length} placement
                      {product.placements.length === 1 ? '' : 's'}
                    </small>
                  </span>
                  <b>{variant ? formatMoney(variant.costCents) : 'Sync'}</b>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="panel studio-panel" aria-label="Design studio">
          {selectedProduct && selectedVariant ? (
            <>
              <div className="studio-layout">
                <div className="product-stage">
                  <ProductVisual
                    category={selectedProduct.categorySlug}
                    title={selectedProduct.title}
                    color={selectedVariant.colorCode}
                  />
                  {(mockup || design) && (
                    <img
                      className="draft-preview"
                      src={mockup?.imageUrl ?? design?.imageUrl}
                      alt="Generated artwork preview"
                    />
                  )}
                </div>

                <div className="studio-fields">
                  <div className="product-summary">
                    <span>{selectedProduct.categoryTitle || selectedProduct.type}</span>
                    <h2>{selectedProduct.title}</h2>
                    <p>{selectedProduct.description}</p>
                  </div>

                  <label className="field-block" htmlFor="variant">
                    <span>Variant</span>
                    <select
                      id="variant"
                      value={selectedVariantId}
                      onChange={(event) => {
                        setSelectedVariantId(event.target.value);
                        setQuote(null);
                        setMockup(null);
                      }}
                    >
                      {selectedProduct.variants.map((variant) => (
                        <option key={variant.id} value={variant.id} disabled={!variant.isAvailable}>
                          {variant.name} - {formatMoney(variant.costCents)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="field-block">
                    <span>Placement</span>
                    <div className="placement-grid">
                      {selectedProduct.placements.map((placement) => (
                        <button
                          key={placement.code}
                          className={selectedPlacements.includes(placement.code) ? 'is-active' : ''}
                          onClick={() => {
                            togglePlacement(placement.code);
                            setQuote(null);
                            setMockup(null);
                          }}
                          type="button"
                        >
                          {placement.displayName}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="field-block prompt-block" htmlFor="prompt">
                    <span>Design idea</span>
                    <textarea
                      id="prompt"
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      rows={5}
                    />
                  </label>
                </div>
              </div>

              <div className="action-row">
                <button onClick={refineIdea} disabled={busy !== null} type="button">
                  Refine idea
                </button>
                <button onClick={createDraft} disabled={busy !== null} type="button">
                  Generate rough draft
                </button>
                <button onClick={buyStudioPass} disabled={busy !== null || Boolean(studioPass)} type="button">
                  {studioPass ? 'Studio Pass active' : '$5 Studio Pass'}
                </button>
                <button onClick={createMockup} disabled={busy !== null || !design} type="button">
                  Create mockup
                </button>
                <button onClick={createQuote} disabled={busy !== null} type="button">
                  Price selection
                </button>
              </div>

              {idea && (
                <section className="insight-box">
                  <span>Refined prompt</span>
                  <p>{idea.refinedPrompt}</p>
                  {idea.warnings.map((warning) => (
                    <small key={warning}>{warning}</small>
                  ))}
                </section>
              )}

              {design && (
                <section className="readiness-grid">
                  <div className="insight-box">
                    <span>Allowance</span>
                    <p>{design.allowance.message}</p>
                    <small>
                      Free drafts: {design.allowance.freeDraftsRemaining} | Pass drafts:{' '}
                      {design.allowance.roughDraftsRemaining}
                    </small>
                  </div>
                  <div className="insight-box">
                    <span>Revision</span>
                    <textarea
                      value={revision}
                      onChange={(event) => setRevision(event.target.value)}
                      rows={3}
                    />
                    <button onClick={reviseDraft} disabled={busy !== null || !design.id} type="button">
                      Apply edit
                    </button>
                  </div>
                  <div className="readiness">
                    <h2>Print readiness</h2>
                    {design.readiness.checks.map((check) => (
                      <p key={check.label} className={`check-${check.severity ?? 'pass'}`}>
                        <strong>{check.label}</strong>
                        <span>{check.result}</span>
                      </p>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <div className="empty-state">No sellable products available.</div>
          )}
        </section>

        <aside className="panel checkout-panel" aria-label="Quote and checkout">
          <div className="panel-heading">
            <div>
              <h2>Quote</h2>
              <p>{quote?.id ? `Saved ${quote.id.slice(0, 12)}` : 'Create a price before checkout'}</p>
            </div>
          </div>

          <div className="studio-pass-card">
            <strong>$5 Studio Pass</strong>
            <span>Applied to eligible purchase</span>
            <small>
              Includes 8 rough drafts, or 4 rough drafts plus 2 edits, or 1 final-ready asset.
            </small>
          </div>

          {quote ? (
            <div className="quote-table">
              {quote.costLines.map((line) => (
                <p key={line.code} className={line.kind === 'credit' ? 'quote-credit' : ''}>
                  <span>{line.label}</span>
                  <strong>{formatMoney(line.amountCents, quote.currency)}</strong>
                </p>
              ))}
              <p className="quote-total">
                <span>Total</span>
                <strong>{formatMoney(quote.totalCents, quote.currency)}</strong>
              </p>
              <small>Shipping, tax, and payment fees are estimates until live checkout confirms them.</small>
            </div>
          ) : (
            <div className="quote-empty">
              <p>{selectedProduct?.title ?? 'Select a product'}</p>
              <strong>{selectedVariant ? formatMoney(selectedVariant.costCents) : '$0.00'}</strong>
            </div>
          )}

          <label className="field-block" htmlFor="email">
            <span>Email for confirmation</span>
            <input
              id="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <button
            className="checkout-button"
            onClick={createCheckout}
            disabled={busy !== null || !quote}
            type="button"
          >
            {checkout?.mode === 'stripe' ? 'Continue checkout' : 'Simulate checkout'}
          </button>

          {checkout && (
            <div className="notice">
              <strong>{statusLabel(checkout.status)}</strong>
              <span>{checkout.message}</span>
            </div>
          )}

          {order && (
            <section className="order-card">
              <span>Order confirmation</span>
              <h2>{order.orderNumber}</h2>
              <p>{order.fulfillment.message}</p>
              <strong>{formatMoney(order.totalCents, order.currency)}</strong>
              <div>
                {order.timeline.map((event) => (
                  <small key={`${event.at}-${event.status}`}>
                    {statusLabel(event.status)}: {event.note}
                  </small>
                ))}
              </div>
            </section>
          )}
        </aside>
      </section>

      <section className="ops-panel" aria-label="Operator readiness">
        <div>
          <p className="eyebrow">Operator controls</p>
          <h2>Launch gates stay explicit</h2>
          <p>
            Fixture mode proves the paid beta journey without creating live charges, live generated
            images, or live provider orders. Private credentials can be connected after OPS review.
          </p>
        </div>
        <div className="ops-grid">
          {adminReport?.launchReadiness.gates.map((gate) => (
            <article key={gate.code} className={`ops-card gate-${gate.status}`}>
              <span>{statusLabel(gate.status)}</span>
              <h3>{gate.label}</h3>
              <p>{gate.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
