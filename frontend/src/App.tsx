import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { ProductVisual } from '@components/ProductVisual';
import { canUseCustomerCheckout, publicConfig } from './config';
import { api } from '@services/api';
import {
  deriveStudioCanvasState,
  findVariantForOption,
  groupVariantOptions,
} from './studio-view-model';
import type { StudioCanvasState, VariantOptionGroups } from './studio-view-model';
import type {
  AdminReport,
  CatalogCategory,
  CatalogProduct,
  CatalogVariant,
  CheckoutSession,
  DesignDraft,
  DesignIdea,
  DesignMockup,
  ManualReviewOrder,
  OrderSummary,
  PlacementOption,
  QuoteBreakdown,
  StudioPass,
  StudioSession,
} from '@app-types/catalog';
import type { CanvasView, ImageViewerState, PolicyRoute } from './App.types';

const formatMoney = (cents: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);

const firstAvailableVariant = (product: CatalogProduct): CatalogVariant | null =>
  product.variants.find((variant) => variant.isAvailable) ?? product.variants[0] ?? null;

const defaultPlacement = (product: CatalogProduct): PlacementOption | null =>
  product.placements.find((placement) => placement.isDefault) ?? product.placements[0] ?? null;

const statusLabel = (status: string) =>
  status.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());

const shortId = (id?: string | null) => (id ? id.slice(0, 12) : 'Not set');

const storedAdminAccessCode = () => {
  try {
    return window.sessionStorage.getItem('oms-admin-access') ?? '';
  } catch {
    return '';
  }
};

function buildMockupCacheKey(params: {
  designAssetId?: string | null;
  productId?: string | null;
  variantId?: string | null;
  placementCodes: string[];
}): string {
  if (!params.designAssetId || !params.productId || !params.variantId || !params.placementCodes.length) {
    return '';
  }
  return [
    params.designAssetId,
    params.productId,
    params.variantId,
    [...params.placementCodes].sort().join(','),
  ].join('|');
}

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

const minimumBusyMs: Record<string, number> = {
  draft: 1400,
  revision: 1100,
  mockup: 1200,
};

const delay = (durationMs: number) =>
  new Promise((resolve) => window.setTimeout(resolve, durationMs));

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

function AdminPage() {
  const [accessCode, setAccessCode] = useState(storedAdminAccessCode);
  const [report, setReport] = useState<AdminReport | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ManualReviewOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOperatorData = async () => {
    const code = accessCode.trim();
    if (!code) {
      setError('Enter the admin access code.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [nextReport, nextQueue] = await Promise.all([
        api.adminReport(code),
        api.adminReviewQueue(code),
      ]);
      setReport(nextReport);
      setReviewQueue(nextQueue);
      window.sessionStorage.setItem('oms-admin-access', code);
    } catch (caught) {
      setReport(null);
      setReviewQueue([]);
      setError(caught instanceof Error ? caught.message : 'Admin data could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="admin-shell">
      <section className="admin-hero">
        <a className="back-link" href="/">
          Back to studio
        </a>
        <p className="eyebrow">Operator</p>
        <h1>Paid Beta Review</h1>
        <p>Review paid orders before any Printful draft is approved for production.</p>
      </section>

      <section className="admin-auth" aria-label="Admin access">
        <label className="field-block" htmlFor="admin-access-code">
          <span>Admin access code</span>
          <input
            id="admin-access-code"
            type="password"
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void loadOperatorData();
            }}
            placeholder="Required"
          />
        </label>
        <button className="btn btn-primary" type="button" onClick={loadOperatorData} disabled={loading}>
          {loading ? 'Loading...' : 'Load review queue'}
        </button>
      </section>

      {error && (
        <div className="notice notice-error" role="alert">
          <strong>Admin request failed</strong>
          <span>{error}</span>
        </div>
      )}

      {report && (
        <section className="admin-metrics" aria-label="Launch metrics">
          <article>
            <span>Orders</span>
            <strong>{report.orders}</strong>
          </article>
          <article>
            <span>Drafts</span>
            <strong>{report.designDrafts}</strong>
          </article>
          <article>
            <span>AI spend</span>
            <strong>{formatMoney(report.estimatedAiSpendCents)}</strong>
          </article>
          <article>
            <span>Paid beta</span>
            <strong>{report.launchReadiness.readyForPaidBeta ? 'Ready' : 'Gated'}</strong>
          </article>
        </section>
      )}

      <section className="admin-review-panel" aria-label="Orders needing review">
        <div className="panel-heading">
          <div>
            <h2>Manual review queue</h2>
            <p>{reviewQueue.length} order{reviewQueue.length === 1 ? '' : 's'} waiting</p>
          </div>
          {report && (
            <span className={`gate ${report.launchReadiness.readyForPaidBeta ? 'gate-pass' : 'gate-manual'}`}>
              {report.launchReadiness.readyForPaidBeta ? 'Paid beta ready' : 'Launch gated'}
            </span>
          )}
        </div>

        {!report && (
          <div className="empty-state empty-state--inline">
            <strong>Queue locked</strong>
            <p>Enter the admin access code to load paid orders that need operator review.</p>
          </div>
        )}

        {report && reviewQueue.length === 0 && (
          <div className="empty-state empty-state--inline">
            <strong>No orders need review</strong>
            <p>Paid orders will appear here after Stripe completion when fulfillment is gated.</p>
          </div>
        )}

        <div className="admin-order-list">
          {reviewQueue.map((item) => (
            <article className="admin-order-card" key={item.orderId}>
              <header>
                <div>
                  <span>{statusLabel(item.status)}</span>
                  <h3>{item.orderNumber}</h3>
                  <p>{item.customerEmail ?? 'No customer email'}</p>
                </div>
                <strong>{formatMoney(item.totalCents, item.currency)}</strong>
              </header>

              <div className="admin-order-meta" aria-label="Order identifiers">
                <span>Payment: {statusLabel(item.paymentStatus)}</span>
                <span>Fulfillment: {statusLabel(item.fulfillmentStatus)}</span>
                <span>Quote: {shortId(item.quoteId)}</span>
                <span>Design: {shortId(item.designAssetId)}</span>
              </div>

              <div className="admin-order-products">
                {item.items.map((line) => (
                  <p key={`${line.productId}-${line.variantId}-${line.designAssetId ?? 'design'}`}>
                    <strong>{line.productTitle}</strong>
                    <span>
                      {line.variantName} · {line.placementCodes.join(', ')} ·{' '}
                      {line.printfulVariantId ? `Printful ${line.printfulVariantId}` : 'No Printful ID'}
                    </span>
                  </p>
                ))}
              </div>

              {item.recipient && (
                <address className="admin-recipient">
                  <strong>{item.recipient.name}</strong>
                  <span>
                    {item.recipient.address1}, {item.recipient.city}
                    {item.recipient.stateCode ? `, ${item.recipient.stateCode}` : ''}{' '}
                    {item.recipient.zip}
                  </span>
                  <span>{item.recipient.countryCode}</span>
                </address>
              )}

              <div className="admin-asset-links">
                <a className={!item.artworkUrl ? 'is-disabled' : ''} href={item.artworkUrl ?? '#'} target="_blank" rel="noreferrer">
                  Artwork
                </a>
                <a className={!item.mockupUrl ? 'is-disabled' : ''} href={item.mockupUrl ?? '#'} target="_blank" rel="noreferrer">
                  Mockup
                </a>
              </div>

              <div className={`admin-readiness ${item.payloadReady ? 'is-ready' : 'needs-review'}`}>
                {item.checks.map((check) => (
                  <p key={check.code} className={`check-${check.status}`}>
                    <span aria-hidden="true">{check.status === 'pass' ? '✓' : '!'}</span>
                    <strong>{check.label}</strong>
                    <small>{check.detail}</small>
                  </p>
                ))}
              </div>
            </article>
          ))}
        </div>
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

function CanvasTabs({
  view,
  hasArtwork,
  hasMockup,
  onChange,
}: {
  view: CanvasView;
  hasArtwork: boolean;
  hasMockup: boolean;
  onChange: (view: CanvasView) => void;
}) {
  return (
    <div className="canvas-tabs" role="tablist" aria-label="Preview view">
      <button
        className={view === 'artwork' ? 'is-active' : ''}
        type="button"
        role="tab"
        aria-selected={view === 'artwork'}
        onClick={() => onChange('artwork')}
      >
        <span>Artwork</span>
        {hasArtwork && <b aria-hidden="true">✓</b>}
      </button>
      <button
        className={view === 'product' ? 'is-active' : ''}
        type="button"
        role="tab"
        aria-selected={view === 'product'}
        onClick={() => onChange('product')}
      >
        <span>On product</span>
        {hasMockup && <b aria-hidden="true">✓</b>}
      </button>
    </div>
  );
}

function CanvasStateCard({ state }: { state: StudioCanvasState }) {
  return (
    <aside className={`canvas-state-card tone-${state.tone}`} aria-live="polite">
      <div>
        <h3>{state.title}</h3>
        <p>{state.detail}</p>
      </div>
      {state.scene === 'drafting' && (
        <ol className="canvas-progress" aria-label="Artwork generation progress">
          {state.progressSteps.map((step) => (
            <li key={step.label} className={`is-${step.state}`}>
              <span aria-hidden="true">
                {step.state === 'done' ? '✓' : step.state === 'active' ? '●' : '○'}
              </span>
              <strong>{step.label}</strong>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

function MakeItYoursPanel({
  product,
  selectedVariant,
  options,
  selectedPlacements,
  onSelectColor,
  onSelectSize,
  onTogglePlacement,
}: {
  product: CatalogProduct;
  selectedVariant: CatalogVariant;
  options: VariantOptionGroups;
  selectedPlacements: string[];
  onSelectColor: (colorKey: string) => void;
  onSelectSize: (sizeKey: string) => void;
  onTogglePlacement: (code: string) => void;
}) {
  return (
    <section className="make-panel" aria-label="Customize product">
      <div className="section-kicker">
        <span>02</span>
        <div>
          <strong>Make it yours</strong>
          <small>Choose the variant and print area before previewing.</small>
        </div>
      </div>

      {options.colorOptions.length > 0 && (
        <div className="option-group">
          <span>Color</span>
          <div className="swatch-grid" role="group" aria-label="Color options">
            {options.colorOptions.map((option) => (
              <button
                key={option.key}
                className={option.key === options.selectedColorKey ? 'is-active' : ''}
                style={{ '--swatch': option.colorCode ?? '#f8fafc' } as CSSProperties}
                type="button"
                aria-pressed={option.key === options.selectedColorKey}
                disabled={!option.available}
                onClick={() => onSelectColor(option.key)}
              >
                <span className="swatch-dot" aria-hidden="true" />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {options.sizeOptions.length > 0 && (
        <div className="option-group">
          <span>Size</span>
          <div className="size-grid" role="group" aria-label="Size options">
            {options.sizeOptions.map((option) => (
              <button
                key={option.key}
                className={option.key === options.selectedSizeKey ? 'is-active' : ''}
                type="button"
                aria-pressed={option.key === options.selectedSizeKey}
                disabled={!option.available}
                onClick={() => onSelectSize(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="variant-summary">
        <span>Selected</span>
        <strong>{selectedVariant.name}</strong>
        <small>{formatMoney(selectedVariant.costCents)} base cost</small>
      </div>

      <div className="option-group">
        <span>Where it prints</span>
        <div className="placement-grid placement-grid--panel">
          {product.placements.map((placement) => (
            <button
              key={placement.code}
              className={selectedPlacements.includes(placement.code) ? 'is-active' : ''}
              onClick={() => onTogglePlacement(placement.code)}
              type="button"
              aria-pressed={selectedPlacements.includes(placement.code)}
            >
              <strong>{placement.displayName}</strong>
              <small>{placement.technique.toUpperCase()}</small>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const pathname = normalizedPathname();
  const policyRoute = policyRoutes[pathname];
  const isAdminRoute = pathname === '/admin';
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
  const [mockupsByKey, setMockupsByKey] = useState<Record<string, DesignMockup>>({});
  const [canvasView, setCanvasView] = useState<CanvasView>('artwork');
  const [imageViewer, setImageViewer] = useState<ImageViewerState>(null);
  const [quote, setQuote] = useState<QuoteBreakdown | null>(null);
  const [checkout, setCheckout] = useState<CheckoutSession | null>(null);
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [adminReport, setAdminReport] = useState<AdminReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (policyRoute || isAdminRoute) return undefined;
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
  }, [isAdminRoute, policyRoute]);

  useEffect(() => {
    if (policyRoute || isAdminRoute) return undefined;
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
  }, [isAdminRoute, policyRoute, selectedCategory, selectedProductId]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  const selectedVariant = useMemo(
    () => selectedProduct?.variants.find((variant) => variant.id === selectedVariantId) ?? null,
    [selectedProduct, selectedVariantId]
  );

  const selectedPlacementsKey = useMemo(
    () => [...selectedPlacements].sort().join(','),
    [selectedPlacements]
  );

  const selectedPlacementCodes = useMemo(
    () => (selectedPlacementsKey ? selectedPlacementsKey.split(',') : []),
    [selectedPlacementsKey]
  );

  const selectedMockupKey = useMemo(
    () =>
      buildMockupCacheKey({
        designAssetId: design?.id,
        productId: selectedProduct?.id,
        variantId: selectedVariant?.id,
        placementCodes: selectedPlacementCodes,
      }),
    [design?.id, selectedProduct?.id, selectedVariant?.id, selectedPlacementCodes]
  );

  const cachedMockup = selectedMockupKey ? mockupsByKey[selectedMockupKey] : undefined;

  const variantOptions = useMemo(
    () => (selectedProduct ? groupVariantOptions(selectedProduct, selectedVariantId) : null),
    [selectedProduct, selectedVariantId]
  );

  const step = quote ? 5 : mockup ? 4 : design ? 3 : idea ? 2 : selectedProduct ? 1 : 0;
  const selectedCategoryTitle =
    categories.find((category) => category.slug === selectedCategory)?.title ?? 'All products';
  const hasQuote = Boolean(quote);
  const checkoutUnavailable =
    publicConfig.isProductionMode && !publicConfig.enablePublicCheckout
      ? 'Paid checkout opens after final provider and support review.'
      : null;
  const canvasState = useMemo(
    () =>
      deriveStudioCanvasState({
        busy,
        design,
        mockup,
        quoteReady: hasQuote,
        checkoutUnavailable,
      }),
    [busy, checkoutUnavailable, design, hasQuote, mockup]
  );

  useEffect(() => {
    if (policyRoute || isAdminRoute) return undefined;
    if (!selectedMockupKey || !selectedProduct || !selectedVariant || !design?.id) {
      setMockup(null);
      return undefined;
    }
    if (cachedMockup) {
      setMockup(cachedMockup);
      return undefined;
    }

    let cancelled = false;
    setMockup(null);
    api
      .latestMockup({
        productId: selectedProduct.id,
        variantId: selectedVariant.id,
        placementCodes: selectedPlacementCodes,
        designAssetId: design.id,
      })
      .then((storedMockup) => {
        if (cancelled || !storedMockup) return;
        setMockupsByKey((current) => ({ ...current, [selectedMockupKey]: storedMockup }));
        setMockup(storedMockup);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [
    cachedMockup,
    design?.id,
    isAdminRoute,
    policyRoute,
    selectedMockupKey,
    selectedPlacementCodes,
    selectedProduct,
    selectedVariant,
  ]);

  useEffect(() => {
    if (!imageViewer) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setImageViewer(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [imageViewer]);

  const runAction = async <T,>(
    key: string,
    action: () => Promise<T>,
    done: (result: T) => void | Promise<void>
  ) => {
    const startedAt = window.performance.now();
    setBusy(key);
    setError(null);
    try {
      const result = await action();
      const remaining = (minimumBusyMs[key] ?? 0) - (window.performance.now() - startedAt);
      if (remaining > 0) await delay(remaining);
      await done(result);
    } catch (caught) {
      const remaining = (minimumBusyMs[key] ?? 0) - (window.performance.now() - startedAt);
      if (remaining > 0) await delay(remaining);
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

  const selectVariant = (variantId: string) => {
    if (variantId === selectedVariantId) return;
    setSelectedVariantId(variantId);
    setQuote(null);
    setCheckout(null);
    setOrder(null);
    setMockup(null);
  };

  const selectVariantOption = (updates: { colorKey?: string; sizeKey?: string }) => {
    if (!selectedProduct) return;
    const nextVariant = findVariantForOption(selectedProduct, selectedVariantId, updates);
    if (nextVariant) selectVariant(nextVariant.id);
  };

  const togglePlacement = (code: string) => {
    setSelectedPlacements((current) => {
      if (current.includes(code)) {
        const next = current.filter((placement) => placement !== code);
        return next.length ? next : current;
      }
      return [...current, code];
    });
    setQuote(null);
    setCheckout(null);
    setOrder(null);
    setMockup(null);
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
    setCanvasView('artwork');
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
      (result) => {
        setDesign(result);
        setQuote(null);
        setCheckout(null);
        setOrder(null);
      }
    );
  };

  const reviseDraft = () => {
    if (!design?.id) return;
    setCanvasView('artwork');
    runAction(
      'revision',
      () =>
        api.reviseDraft({
          draftId: design.id ?? '',
          instructions: revision,
          sessionId: session?.id,
        }),
      (result) => {
        setDesign(result);
        setQuote(null);
        setCheckout(null);
        setOrder(null);
      }
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
    setCanvasView('product');
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
      (result) => {
        setMockup(result);
        const cacheKey = buildMockupCacheKey({
          designAssetId: result.designAssetId ?? design?.id,
          productId: result.productId,
          variantId: result.variantId,
          placementCodes: result.placementCodes,
        });
        if (cacheKey) {
          setMockupsByKey((current) => ({ ...current, [cacheKey]: result }));
        }
      }
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

  if (isAdminRoute) {
    return <AdminPage />;
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
  const hasArtwork = Boolean(design?.imageUrl);
  const hasProductMockup = Boolean(mockup?.imageUrl && mockup.status === 'complete');
  const isDraftingArtwork = busy === 'draft' || busy === 'revision';
  const isBuildingMockup =
    busy === 'mockup' || mockup?.status === 'queued' || mockup?.status === 'processing';
  const canvasImageUrl =
    canvasView === 'product' ? (mockup?.imageUrl ?? '') : (design?.imageUrl ?? '');
  const canvasTitle =
    canvasView === 'product'
      ? `${selectedProduct?.title ?? 'Product'} mockup`
      : 'Generated artwork';
  const canvasDetail =
    canvasView === 'product'
      ? mockup
        ? `${statusLabel(mockup.status)} ${mockup.provider === 'printful' ? 'Printful' : 'provider'} preview`
        : 'Product preview'
      : design
        ? `${statusLabel(design.qualityTier)} draft artwork`
        : 'Artwork preview';
  return (
    <main className="app-shell">
      <header className="hero hero-compact">
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
        {!publicConfig.isProductionMode && (
          <ul className="value-pills" aria-label="What to expect">
            <li>
              <span aria-hidden="true">✨</span> Start free
            </li>
            <li>
              <span aria-hidden="true">🎟️</span>{' '}
              {checkoutUnavailable ? '$5 Studio Pass · opening soon' : "$5 Studio Pass when you're ready"}
            </li>
            <li>
              <span aria-hidden="true">📦</span> 5 launch products &amp; growing
            </li>
            <li>
              <span aria-hidden="true">💸</span> See the full price before you pay
            </li>
          </ul>
        )}
      </header>

      {error && (
        <div className="notice notice-error" role="alert">
          <strong>Something needs another try</strong>
          <span>{error}</span>
        </div>
      )}

      {checkoutUnavailable && (
        <section className="customer-note customer-note--quiet" aria-label="Checkout status">
          <strong>Checkout opens soon.</strong>
          <span>
            Browse products, shape a design, and get a transparent estimate while live payment and
            fulfillment finish review.
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

      <section className={`shop-grid ${hasQuote ? 'has-quote' : 'is-guided'}`}>
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
                <div className={`product-stage proof-stage scene-${canvasState.scene} tone-${canvasState.tone}`}>
                  <div className="stage-toolbar">
                    <span className="stage-tag">{canvasState.title}</span>
                    <CanvasTabs
                      view={canvasView}
                      hasArtwork={hasArtwork}
                      hasMockup={hasProductMockup}
                      onChange={setCanvasView}
                    />
                  </div>

                  <div className={`proof-canvas__content is-${canvasView}`}>
                    {canvasImageUrl ? (
                      <button
                        className={`preview-frame preview-frame--${canvasView}`}
                        type="button"
                        onClick={() =>
                          setImageViewer({
                            title: canvasTitle,
                            imageUrl: canvasImageUrl,
                            detail: canvasDetail,
                          })
                        }
                        aria-label={`Open ${canvasTitle} full size`}
                      >
                        <img
                          className="draft-preview"
                          src={canvasImageUrl}
                          alt={`${canvasTitle} for ${selectedProduct.title}`}
                        />
                        <span className="preview-frame__icon" aria-hidden="true">
                          ⛶
                        </span>
                      </button>
                    ) : (
                      <div className={`canvas-placeholder ${isDraftingArtwork || isBuildingMockup ? 'is-loading' : ''}`}>
                        <ProductVisual
                          category={selectedProduct.categorySlug}
                          title={selectedProduct.title}
                          color={selectedVariant.colorCode}
                        />
                        <strong>
                          {canvasView === 'product'
                            ? isBuildingMockup
                              ? 'Placing artwork on product'
                              : design
                              ? 'Preview this on product'
                              : 'Generate artwork first'
                            : isDraftingArtwork
                              ? 'Rendering your draft'
                              : 'Start with a square draft'}
                        </strong>
                        <span>
                          {canvasView === 'product'
                            ? isBuildingMockup
                              ? 'The mockup will appear here and be restored when you return to this item.'
                              : 'Your Printful mockup will persist here once generated.'
                            : isDraftingArtwork
                              ? 'Print readiness checks run as soon as the image returns.'
                              : 'Describe the design and the artwork will appear on this proof grid.'}
                        </span>
                      </div>
                    )}
                  </div>

                  <CanvasStateCard state={canvasState} />
                </div>

                <div className="studio-fields">
                  <div className="product-summary">
                    <span>01 Product</span>
                    <h2>{selectedProduct.title}</h2>
                    <p>{selectedProduct.description}</p>
                    <small>{selectedProduct.categoryTitle || selectedProduct.type}</small>
                  </div>

                  {variantOptions && (
                    <MakeItYoursPanel
                      product={selectedProduct}
                      selectedVariant={selectedVariant}
                      options={variantOptions}
                      selectedPlacements={selectedPlacements}
                      onSelectColor={(colorKey) => selectVariantOption({ colorKey })}
                      onSelectSize={(sizeKey) => selectVariantOption({ sizeKey })}
                      onTogglePlacement={togglePlacement}
                    />
                  )}

                  <label className="field-block prompt-block" htmlFor="prompt">
                    <span>03 Describe your design</span>
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
                  {busy === 'mockup' ? 'Building product preview…' : 'Preview on product'}
                </button>
                <button className="btn" onClick={createQuote} disabled={busy !== null} type="button">
                  {busy === 'quote' ? 'Pricing...' : quote ? 'Update price' : 'See the price'}
                </button>
              </div>

              {quote && (
                <section className="inline-quote" aria-live="polite">
                  <div>
                    <span>Estimated total</span>
                    <strong>{formatMoney(quote.totalCents, quote.currency)}</strong>
                  </div>
                  <button
                    className="btn btn-soft"
                    type="button"
                    onClick={() => document.querySelector('.checkout-panel')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    View details
                  </button>
                </section>
              )}

              {mockup?.status === 'failed' && (
                <div className="notice notice-error" role="status">
                  <strong>Mockup preview failed</strong>
                  <span>{mockup.errorMessage ?? 'The provider preview could not be generated.'}</span>
                </div>
              )}

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

        {quote && (
        <aside className="panel checkout-panel" aria-label="Quote and checkout">
          <div className="panel-heading">
            <div>
              <h2>Your order</h2>
              <p>{`Quote ${quote.id?.slice(0, 12) ?? 'ready'} · estimate locked in`}</p>
            </div>
          </div>

          <div className={`studio-pass-card studio-pass-card--compact ${passActive ? 'is-active' : ''}`}>
            <div>
              <span className="studio-pass-card__kicker">
                {passActive ? 'Studio Pass active' : '$5 Studio Pass'}
              </span>
              <p>
                {checkoutUnavailable
                  ? 'Applied to purchase when checkout opens.'
                  : 'Optional design credit, applied to an eligible purchase.'}
              </p>
            </div>
            <button
              className="btn btn-soft"
              onClick={buyStudioPass}
              disabled={busy !== null || passActive || !canUseCustomerCheckout}
              type="button"
            >
              {passActive
                ? 'Pass active'
                : checkoutUnavailable
                  ? 'Opening soon'
                  : busy === 'pass'
                    ? 'Activating...'
                    : 'Get pass'}
            </button>
          </div>

          <div className="quote-table quote-table--summary">
            <p className="quote-total quote-total--hero">
              <span>Estimated total</span>
              <strong>{formatMoney(quote.totalCents, quote.currency)}</strong>
            </p>
            <details className="quote-details">
              <summary>Price breakdown</summary>
              <div>
                {quote.costLines.map((line) => (
                  <p key={line.code} className={line.kind === 'credit' ? 'quote-credit' : ''}>
                    <span>{line.label}</span>
                    <strong>{formatMoney(line.amountCents, quote.currency)}</strong>
                  </p>
                ))}
              </div>
            </details>
            <small>Shipping, tax, and payment fees remain estimates until live checkout.</small>
          </div>

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
        )}
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

      {imageViewer && (
        <div
          className="image-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={imageViewer.title}
          onClick={() => setImageViewer(null)}
        >
          <div className="image-viewer__panel" onClick={(event) => event.stopPropagation()}>
            <header className="image-viewer__header">
              <div>
                <span>{imageViewer.detail}</span>
                <h2>{imageViewer.title}</h2>
              </div>
              <button
                className="image-viewer__close"
                type="button"
                onClick={() => setImageViewer(null)}
                aria-label="Close full size image"
              >
                ×
              </button>
            </header>
            <div className="image-viewer__canvas">
              <img src={imageViewer.imageUrl} alt={imageViewer.title} />
            </div>
            <footer className="image-viewer__footer">
              <a href={imageViewer.imageUrl} target="_blank" rel="noreferrer">
                Open original image
              </a>
            </footer>
          </div>
        </div>
      )}

      <SiteFooter />
    </main>
  );
}
