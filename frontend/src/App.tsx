import { useEffect, useMemo, useState } from 'react';
import { ProductVisual } from '@components/ProductVisual';
import { canUseCustomerCheckout, publicConfig } from './config';
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
  status.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

// Public-safe, product-neutral category signals.
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

const WORKFLOW = [
  { label: 'Pick a product', hint: 'Choose what to make' },
  { label: 'Describe it', hint: 'Tell us your idea' },
  { label: 'Generate', hint: 'AI drafts your art' },
  { label: 'Preview', hint: 'See it on a mockup' },
  { label: 'Checkout', hint: 'Transparent price' },
] as const;

type PolicyRoute = {
  title: string;
  eyebrow: string;
  summary: string;
  sections: Array<{ heading: string; body: string }>;
};

const policyRoutes: Record<string, PolicyRoute> = {
  '/privacy': {
    eyebrow: 'Privacy',
    title: 'Privacy Policy',
    summary:
      'Open Merch Studio is designed to keep early design exploration lightweight and avoid unnecessary private data collection.',
    sections: [
      {
        heading: 'What we collect',
        body:
          'You can browse products, draft ideas, and preview the studio without creating an account. When paid checkout is enabled, the app may collect the contact, shipping, order, and payment information needed to complete and support an order.',
      },
      {
        heading: 'Provider processing',
        body:
          'Production orders may use providers such as Stripe for payment, Printful for fulfillment, OpenAI for optional design assistance, and email delivery services for confirmations. Provider credentials and private account data are managed outside the public repository.',
      },
      {
        heading: 'Customer data',
        body:
          'Do not enter private customer records, secrets, account IDs, payment data, or sensitive personal information into design prompts. Public demo and fixture flows use synthetic data only.',
      },
    ],
  },
  '/terms': {
    eyebrow: 'Terms',
    title: 'Terms of Use',
    summary:
      'Use Open Merch Studio to create original, rights-cleared merchandise designs and review all generated output before ordering.',
    sections: [
      {
        heading: 'Design rights',
        body:
          'You are responsible for making sure your prompts, uploaded materials, and final designs are original or properly licensed. Do not request trademarked logos, copyrighted characters, or designs that impersonate another brand.',
      },
      {
        heading: 'Generated output',
        body:
          'AI-assisted drafts are starting points. Designs may need human review, print-readiness checks, and provider mockup confirmation before production.',
      },
      {
        heading: 'Orders',
        body:
          'Final prices, shipping, taxes, availability, production timelines, and fulfillment eligibility are confirmed during checkout once live provider integrations are enabled.',
      },
    ],
  },
  '/returns': {
    eyebrow: 'Support',
    title: 'Returns And Cancellations',
    summary:
      'Custom print-on-demand products require a clear review step before production because each item is made for the order.',
    sections: [
      {
        heading: 'Before fulfillment',
        body:
          'If an order has not entered production, contact support as quickly as possible so the order can be reviewed or cancelled when provider status allows.',
      },
      {
        heading: 'Custom products',
        body:
          'Because custom merchandise is produced for a specific design and recipient, buyer-remorse returns may not be available once production begins.',
      },
      {
        heading: 'Defects or mistakes',
        body:
          'If an item arrives damaged, misprinted, or materially different from the approved order, contact support with the order number and clear photos so the issue can be reviewed with the fulfillment provider.',
      },
    ],
  },
  '/content-policy': {
    eyebrow: 'Safety',
    title: 'Content Policy',
    summary:
      'The studio is for original, safe, rights-cleared designs that can be responsibly printed and fulfilled.',
    sections: [
      {
        heading: 'Disallowed requests',
        body:
          'Do not submit requests involving stolen IP, impersonation, hateful content, harassment, explicit sexual content, illegal goods or services, private personal data, or instructions that would create real-world harm.',
      },
      {
        heading: 'Brand and IP review',
        body:
          'The studio may block or flag references to well-known brands, characters, teams, public figures, or other protected marks unless the customer can show appropriate rights.',
      },
      {
        heading: 'Production review',
        body:
          'Open Merch Studio may refuse, pause, or request revision for any design that appears unsafe, infringing, unprintable, or outside fulfillment-provider rules.',
      },
    ],
  },
  '/support': {
    eyebrow: 'Help',
    title: 'Support',
    summary: `For launch questions, order help, or production review, contact ${publicConfig.supportEmail}.`,
    sections: [
      {
        heading: 'Before checkout is live',
        body:
          'You can use the studio to browse the catalog, explore ideas, and review transparent price estimates. Paid checkout opens after provider gates and launch operations are verified.',
      },
      {
        heading: 'What to include',
        body:
          'For order support, include the order number, email used at checkout, product, design issue, and any relevant photos. Do not send API keys, passwords, tokens, invoices, or private provider account data.',
      },
    ],
  },
};

function normalizedPathname() {
  const pathname = window.location.pathname.replace(/\/+$/, '');
  return pathname || '/';
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav aria-label="Footer links">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/returns">Returns</a>
        <a href="/content-policy">Content policy</a>
        <a href="/support">Support</a>
        {!publicConfig.isProductionMode && (
          <>
            <a href="https://github.com/foxandhenllc/open-merch-studio">GitHub</a>
            <a href="https://github.com/foxandhenllc/open-merch-studio/blob/main/docs/tickets/launch/README.md">
              Roadmap
            </a>
          </>
        )}
      </nav>
      <span>{publicConfig.appName}</span>
    </footer>
  );
}

function PolicyPage({ route }: { route: PolicyRoute }) {
  return (
    <main className="policy-shell">
      <section className="policy-hero">
        <a className="back-link" href="/">
          Back to studio
        </a>
        <p className="eyebrow">{route.eyebrow}</p>
        <h1>{route.title}</h1>
        <p>{route.summary}</p>
      </section>
      <section className="policy-content">
        {route.sections.map((section) => (
          <article key={section.heading}>
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </section>
      <SiteFooter />
    </main>
  );
}

function StepBadge({
  index,
  label,
  hint,
  state,
}: {
  index: number;
  label: string;
  hint: string;
  state: 'done' | 'active' | 'todo';
}) {
  return (
    <li className={`step-badge is-${state}`}>
      <b aria-hidden="true">{state === 'done' ? '✓' : index}</b>
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
    </li>
  );
}

export default function App() {
  const policyRoute = policyRoutes[normalizedPathname()];
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [session, setSession] = useState<StudioSession | null>(null);
  const [studioPass, setStudioPass] = useState<StudioPass | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [selectedPlacements, setSelectedPlacements] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('A bold retro sunburst badge for a neighborhood coffee shop');
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
    if (policyRoute) return undefined;
    let mounted = true;
    Promise.all([
      api.categories(),
      api.products(),
      api.session(),
      publicConfig.isProductionMode ? Promise.resolve(null) : api.adminReport(),
    ])
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
  }, [policyRoute]);

  useEffect(() => {
    if (policyRoute) return undefined;
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
    return undefined;
  }, [policyRoute, selectedCategory, selectedProductId]);

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
  const checkoutUnavailable =
    publicConfig.isProductionMode && !publicConfig.enablePublicCheckout
      ? 'Paid checkout opens after final provider and support review.'
      : null;

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
    if (!canUseCustomerCheckout) {
      setCheckout({
        id: 'checkout-disabled',
        mode: 'stripe-ready',
        status: 'blocked',
        checkoutUrl: null,
        message: checkoutUnavailable ?? 'Checkout is not available yet.',
      });
      return;
    }
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
    if (!canUseCustomerCheckout) {
      setCheckout({
        id: 'checkout-disabled',
        mode: 'stripe-ready',
        status: 'blocked',
        checkoutUrl: null,
        quoteId: quote.id,
        studioPassId: studioPass?.id,
        message: checkoutUnavailable ?? 'Checkout is not available yet.',
      });
      return;
    }
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

  if (policyRoute) {
    return <PolicyPage route={policyRoute} />;
  }

  if (loading) {
    return (
      <main className="loading-shell">
        <div className="loading-card">
          <span className="brand-mark brand-mark--lg" aria-hidden="true">
            ◓
          </span>
          <p className="loading-title">Open Merch Studio</p>
          <p className="loading-sub">Warming up your design studio…</p>
          <div className="loading-bars" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      </main>
    );
  }

  const passActive = Boolean(studioPass);
  const passBenefits = [
    'Counts as a $5 credit toward your order',
    'Up to 8 AI rough drafts to explore',
    '2 guided edits to refine your favorite',
    '1 final, print-ready artwork file',
  ];

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="hero-top">
          <div className="hero-brand">
            <span className="brand-mark" aria-hidden="true">
              ◓
            </span>
            <div>
              <p className="eyebrow">AI design studio · print-on-demand</p>
              <h1>Open Merch Studio</h1>
            </div>
          </div>
          <nav className="top-actions" aria-label="Project links">
            <a href="/support">Support</a>
            <a href="/privacy">Privacy</a>
            {!publicConfig.isProductionMode && (
              <>
                <a href="https://github.com/foxandhenllc/open-merch-studio">GitHub</a>
                <a href="https://github.com/foxandhenllc/open-merch-studio/blob/main/docs/tickets/launch/README.md">
                  Roadmap
                </a>
              </>
            )}
          </nav>
        </div>
        <p className="hero-tagline">
          {checkoutUnavailable
            ? 'Dream it, generate it, and price it before the paid beta opens. Pick a product, describe your idea, and preview the path from concept to merch.'
            : 'Dream it, generate it, wear it. Pick a product, describe your idea, and watch AI turn it into print-ready art on a real mockup.'}{' '}
          <strong>Free to start — no account needed.</strong>
        </p>
        <ul className="value-pills" aria-label="What to expect">
          <li>
            <span aria-hidden="true">✨</span> Start free
          </li>
          <li>
            <span aria-hidden="true">🎟️</span>{' '}
            {checkoutUnavailable ? '$5 Studio Pass · opening soon' : "$5 Studio Pass when you're ready"}
          </li>
          <li>
            <span aria-hidden="true">📦</span> 8 product types &amp; growing
          </li>
          <li>
            <span aria-hidden="true">💸</span> See the full price before you pay
          </li>
        </ul>
      </header>

      {error && (
        <div className="notice notice-error" role="alert">
          <strong>Something needs another try</strong>
          <span>{error}</span>
        </div>
      )}

      {checkoutUnavailable && (
        <section className="customer-note" aria-label="Checkout status">
          <strong>Paid checkout is not open yet.</strong>
          <span>
            You can still browse products, shape a design prompt, preview mockups, and review
            pricing. Live payment and fulfillment will open after final provider review.
          </span>
        </section>
      )}

      {!publicConfig.isProductionMode && (
        <section className="launch-strip" aria-label="Launch status">
        <div className="launch-strip__lead">
          <span className="launch-dot" aria-hidden="true" />
          <div>
            <strong>Public beta · fixture mode</strong>
            <span>
              Explore the whole journey safely. No live charges, AI generation, or fulfillment run
              until private provider gates are switched on.
            </span>
          </div>
        </div>
        <div className="launch-gates">
          {adminReport?.launchReadiness.gates.slice(0, 4).map((gate) => (
            <span key={gate.code} className={`gate gate-${gate.status}`}>
              {gate.label}
            </span>
          ))}
        </div>
        </section>
      )}

      <ol className="workflow-steps" aria-label="How it works">
        {WORKFLOW.map((item, index) => (
          <StepBadge
            key={item.label}
            index={index + 1}
            label={item.label}
            hint={item.hint}
            state={step > index ? 'done' : step === index ? 'active' : index === 0 ? 'active' : 'todo'}
          />
        ))}
      </ol>

      <section className="shop-grid">
        <aside className="panel catalog-panel" aria-label="Catalog">
          <div className="panel-heading">
            <div>
              <h2>{selectedCategoryTitle}</h2>
              <p>
                {products.length} {products.length === 1 ? 'product' : 'products'} ready to customize
              </p>
            </div>
          </div>
          <div className="category-row" role="group" aria-label="Product categories">
            <button
              className={`category-chip ${!selectedCategory ? 'is-active' : ''}`}
              onClick={() => setSelectedCategory('')}
              type="button"
            >
              <span aria-hidden="true">✺</span> All
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                className={`category-chip ${selectedCategory === category.slug ? 'is-active' : ''}`}
                onClick={() => setSelectedCategory(category.slug)}
                type="button"
              >
                <span aria-hidden="true">{categoryIcon[category.slug] ?? '✺'}</span> {category.title}
              </button>
            ))}
          </div>
          <div className="product-list">
            {products.length === 0 && (
              <div className="empty-state empty-state--inline">
                <strong>No products in this category yet</strong>
                <p>Pick a different category to keep browsing.</p>
              </div>
            )}
            {products.map((product) => {
              const variant = firstAvailableVariant(product);
              const selected = selectedProductId === product.id;
              return (
                <button
                  key={product.id}
                  className={`product-card ${selected ? 'is-selected' : ''}`}
                  onClick={() => selectProduct(product)}
                  type="button"
                  aria-pressed={selected}
                >
                  <ProductVisual
                    category={product.categorySlug}
                    title={product.title}
                    color={variant?.colorCode}
                  />
                  <span className="product-card__body">
                    <strong>{product.title}</strong>
                    <small>
                      {product.categoryTitle || product.type || 'Catalog item'} ·{' '}
                      {product.placements.length} placement
                      {product.placements.length === 1 ? '' : 's'}
                    </small>
                  </span>
                  <span className="product-card__meta">
                    <em>from</em>
                    <b>{variant ? formatMoney(variant.costCents) : 'Sync'}</b>
                    {selected && <span className="product-card__tick" aria-hidden="true">✓</span>}
                  </span>
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
                  <span className="stage-tag">
                    {mockup ? 'Mockup preview' : design ? 'Artwork draft' : 'Live preview'}
                  </span>
                  <ProductVisual
                    category={selectedProduct.categorySlug}
                    title={selectedProduct.title}
                    color={selectedVariant.colorCode}
                  />
                  {(mockup || design) && (
                    <img
                      className="draft-preview"
                      src={mockup?.imageUrl ?? design?.imageUrl}
                      alt={`Generated artwork preview for ${selectedProduct.title}`}
                    />
                  )}
                  {!design && !mockup && (
                    <span className="stage-hint">
                      Generate a draft to see your artwork land here.
                    </span>
                  )}
                </div>

                <div className="studio-fields">
                  <div className="product-summary">
                    <span>{selectedProduct.categoryTitle || selectedProduct.type}</span>
                    <h2>{selectedProduct.title}</h2>
                    <p>{selectedProduct.description}</p>
                  </div>

                  <label className="field-block" htmlFor="variant">
                    <span>Color &amp; size</span>
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
                          {variant.name} — {formatMoney(variant.costCents)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="field-block">
                    <span>Where it prints</span>
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
                          aria-pressed={selectedPlacements.includes(placement.code)}
                        >
                          {placement.displayName}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="field-block prompt-block" htmlFor="prompt">
                    <span>Describe your design</span>
                    <textarea
                      id="prompt"
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      rows={5}
                      placeholder="e.g. A minimalist mountain range at sunrise, two-color, vintage feel"
                    />
                    <small className="field-hint">
                      The more specific the vibe, colors, and style — the better the draft.
                    </small>
                  </label>
                </div>
              </div>

              <div className="action-row" aria-label="Studio actions">
                <button
                  className="btn btn-primary"
                  onClick={createDraft}
                  disabled={busy !== null}
                  type="button"
                >
                  {busy === 'draft' ? 'Generating…' : '✨ Generate rough draft'}
                </button>
                <button className="btn" onClick={refineIdea} disabled={busy !== null} type="button">
                  {busy === 'idea' ? 'Refining…' : 'Refine my idea'}
                </button>
                <button
                  className="btn"
                  onClick={createMockup}
                  disabled={busy !== null || !design}
                  type="button"
                >
                  {busy === 'mockup' ? 'Building…' : 'Preview on product'}
                </button>
                <button className="btn" onClick={createQuote} disabled={busy !== null} type="button">
                  {busy === 'quote' ? 'Pricing…' : 'See the price'}
                </button>
              </div>

              {idea && (
                <section className="insight-box insight-box--idea">
                  <span>Refined prompt</span>
                  <p>{idea.refinedPrompt}</p>
                  {idea.styleTags.length > 0 && (
                    <div className="tag-row">
                      {idea.styleTags.map((tag) => (
                        <span key={tag} className="tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {idea.warnings.map((warning) => (
                    <small key={warning} className="insight-warning">
                      {warning}
                    </small>
                  ))}
                </section>
              )}

              {design && (
                <section className="readiness-grid">
                  <div className="insight-box">
                    <span>Your allowance</span>
                    <p>{design.allowance.message}</p>
                    <small>
                      Free drafts left: {design.allowance.freeDraftsRemaining} · Studio Pass drafts:{' '}
                      {design.allowance.roughDraftsRemaining}
                    </small>
                  </div>
                  <div className="insight-box">
                    <span>Refine this draft</span>
                    <textarea
                      value={revision}
                      onChange={(event) => setRevision(event.target.value)}
                      rows={3}
                      aria-label="Revision instructions"
                    />
                    <button
                      className="btn btn-soft"
                      onClick={reviseDraft}
                      disabled={busy !== null || !design.id}
                      type="button"
                    >
                      {busy === 'revision' ? 'Applying…' : 'Apply edit'}
                    </button>
                  </div>
                  <div className="readiness">
                    <h2>Print readiness</h2>
                    {design.readiness.checks.map((check) => (
                      <p key={check.label} className={`check-row check-${check.severity ?? 'pass'}`}>
                        <span className="check-icon" aria-hidden="true">
                          {check.severity === 'block'
                            ? '✕'
                            : check.severity === 'warning'
                              ? '!'
                              : '✓'}
                        </span>
                        <strong>{check.label}</strong>
                        <span>{check.result}</span>
                      </p>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <div className="empty-state">
              <span className="empty-state__art" aria-hidden="true">
                🎨
              </span>
              <strong>Pick a product to start designing</strong>
              <p>Choose anything from the catalog and your creative workspace opens up here.</p>
            </div>
          )}
        </section>

        <aside className="panel checkout-panel" aria-label="Quote and checkout">
          <div className="panel-heading">
            <div>
              <h2>Your order</h2>
              <p>
                {quote?.id
                  ? `Quote ${quote.id.slice(0, 12)} · locked in`
                  : 'Transparent pricing — nothing hidden'}
              </p>
            </div>
          </div>

          <div className={`studio-pass-card ${passActive ? 'is-active' : ''}`}>
            <div className="studio-pass-card__head">
              <div>
                <span className="studio-pass-card__kicker">
                  {passActive ? '🎟️ Studio Pass active' : '🎟️ $5 Studio Pass'}
                </span>
                <strong>{passActive ? 'Ready on this session' : 'Optional — unlock when ready'}</strong>
              </div>
              <span className="studio-pass-card__price">$5</span>
            </div>
            <ul className="studio-pass-card__list">
              {passBenefits.map((benefit) => (
                <li key={benefit}>
                  <span aria-hidden="true">✓</span> {benefit}
                </li>
              ))}
            </ul>
            <button
              className="btn btn-primary btn-block"
              onClick={buyStudioPass}
              disabled={busy !== null || passActive || !canUseCustomerCheckout}
              type="button"
            >
              {passActive
                ? 'Pass active ✓'
                : checkoutUnavailable
                  ? 'Pass checkout opens soon'
                  : busy === 'pass'
                    ? 'Activating…'
                    : 'Get the Studio Pass'}
            </button>
            <small className="studio-pass-card__note">
              {checkoutUnavailable
                ? 'Your first draft stays free while we finish live checkout and fulfillment review.'
                : 'Your first draft is always free. The pass only matters once you want to explore more.'}
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
              <small>
                Shipping, tax, and payment fees are estimates until live checkout confirms them.
              </small>
            </div>
          ) : (
            <div className="quote-empty">
              <div>
                <small>Selected</small>
                <p>{selectedProduct?.title ?? 'Pick a product'}</p>
              </div>
              <div className="quote-empty__price">
                <small>from</small>
                <strong>{selectedVariant ? formatMoney(selectedVariant.costCents) : '$0.00'}</strong>
              </div>
            </div>
          )}

          {canUseCustomerCheckout && (
            <label className="field-block" htmlFor="email">
              <span>Email for confirmation</span>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>
          )}

          <button
            className="btn btn-primary btn-block checkout-button"
            onClick={createCheckout}
            disabled={busy !== null || !quote || !canUseCustomerCheckout}
            type="button"
          >
            {checkoutUnavailable
              ? 'Checkout opens soon'
              : !quote
              ? 'Add a price to check out'
              : checkout?.mode === 'stripe'
                ? 'Continue to secure checkout'
                : busy === 'checkout'
                  ? 'Processing…'
                  : 'Place order (simulated)'}
          </button>

          {checkout && (
            <div className="notice notice-info">
              <strong>{statusLabel(checkout.status)}</strong>
              <span>{checkout.message}</span>
            </div>
          )}

          {order && (
            <section className="order-card">
              <span>🎉 Order confirmation</span>
              <h2>{order.orderNumber}</h2>
              <p>{order.fulfillment.message}</p>
              <strong>{formatMoney(order.totalCents, order.currency)}</strong>
              <div className="order-timeline">
                {order.timeline.map((event) => (
                  <small key={`${event.at}-${event.status}`}>
                    <b>{statusLabel(event.status)}:</b> {event.note}
                  </small>
                ))}
              </div>
            </section>
          )}
        </aside>
      </section>

      {!publicConfig.isProductionMode && (
        <section className="ops-panel" aria-label="Operator readiness">
        <div className="ops-intro">
          <p className="eyebrow">Operator controls</p>
          <h2>Launch gates stay explicit</h2>
          <p>
            Fixture mode proves the full paid-beta journey without creating live charges, generated
            images, or provider orders. Private credentials connect only after OPS review.
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
      )}

      <SiteFooter />
    </main>
  );
}
