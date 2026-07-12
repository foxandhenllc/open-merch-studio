import { useEffect, useRef, useState } from 'react';
import { AllowanceMeter } from '@components/AllowanceMeter';
import { CatalogPanel } from '@components/CatalogPanel';
import { GenerationStage } from '@components/GenerationStage';
import { OrderTimeline } from '@components/OrderTimeline';
import { ProviderChip } from '@components/ProviderChip';
import type { ProviderState } from '@components/ProviderChip.types';
import { QuoteLedger } from '@components/QuoteLedger';
import { ReadinessChecks } from '@components/ReadinessChecks';
import { StatusNote } from '@components/StatusNote';
import { StepRail } from '@components/StepRail';
import { publicConfig } from './config';
import { api } from './services/api';
import { useStudioViewModel, type SurfaceError } from './studio-view-model';
import type { OrderSummary } from './types/catalog';
import type { PolicyRoute } from './App.types';

const money = (cents: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
const normalizedPathname = () => window.location.pathname.replace(/\/+$/, '') || '/';
const providerState = (value?: string): ProviderState =>
  value === 'openai' || value === 'stripe' || value === 'printful'
    ? 'live'
    : value === 'openai-ready' || value === 'stripe-ready' || value === 'printful-ready'
      ? 'ready'
      : 'fixture';

const policyRoutes: Record<string, PolicyRoute> = {
  '/privacy': {
    eyebrow: 'Privacy',
    title: 'Privacy Policy',
    summary:
      'Open Merch Studio is designed to keep early design exploration lightweight and avoid unnecessary private data collection.',
    sections: [
      {
        heading: 'What we collect',
        body: 'You can browse products, draft ideas, and preview the studio without creating an account. When paid checkout is enabled, the app may collect the contact, shipping, order, and payment information needed to complete and support an order.',
      },
      {
        heading: 'Provider processing',
        body: 'Production orders may use providers such as Stripe for payment, Printful for fulfillment, OpenAI for optional design assistance, and email delivery services for confirmations. Provider credentials and private account data are managed outside the public repository.',
      },
      {
        heading: 'Customer data',
        body: 'Do not enter private customer records, secrets, account IDs, payment data, or sensitive personal information into design prompts. Public demo and fixture flows use synthetic data only.',
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
        body: 'You are responsible for making sure your prompts, uploaded materials, and final designs are original or properly licensed. Do not request trademarked logos, copyrighted characters, or designs that impersonate another brand.',
      },
      {
        heading: 'Generated output',
        body: 'AI-assisted drafts are starting points. Designs may need human review, print-readiness checks, and provider mockup confirmation before production.',
      },
      {
        heading: 'Orders',
        body: 'Final prices, shipping, taxes, availability, production timelines, and fulfillment eligibility are confirmed during checkout once live provider integrations are enabled.',
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
        body: 'If an order has not entered production, contact support as quickly as possible so the order can be reviewed or cancelled when provider status allows.',
      },
      {
        heading: 'Custom products',
        body: 'Because custom merchandise is produced for a specific design and recipient, buyer-remorse returns may not be available once production begins.',
      },
      {
        heading: 'Defects or mistakes',
        body: 'If an item arrives damaged, misprinted, or materially different from the approved order, contact support with the order number and clear photos so the issue can be reviewed with the fulfillment provider.',
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
        body: 'Do not submit requests involving stolen IP, impersonation, hateful content, harassment, explicit sexual content, illegal goods or services, private personal data, or instructions that would create real-world harm.',
      },
      {
        heading: 'Brand and IP review',
        body: 'The studio may block or flag references to well-known brands, characters, teams, public figures, or other protected marks unless the customer can show appropriate rights.',
      },
      {
        heading: 'Production review',
        body: 'Open Merch Studio may refuse, pause, or request revision for any design that appears unsafe, infringing, unprintable, or outside fulfillment-provider rules.',
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
        body: 'You can use the studio to browse the catalog, explore ideas, and review transparent price estimates. Paid checkout opens after provider gates and launch operations are verified.',
      },
      {
        heading: 'What to include',
        body: 'For order support, include the order number, email used at checkout, product, design issue, and any relevant photos. Do not send API keys, passwords, tokens, invoices, or private provider account data.',
      },
    ],
  },
};

function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav aria-label="Footer links">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/returns">Returns</a>
        <a href="/content-policy">Content policy</a>
        <a href="/support">Support</a>
        <a href="https://github.com/foxandhenllc/open-merch-studio">GitHub</a>
      </nav>
      <span>MIT · Open Merch Studio</span>
    </footer>
  );
}

function PolicyPage({ route }: { route: PolicyRoute }) {
  return (
    <main className="policy-shell">
      <header className="policy-hero">
        <a className="back-link" href="/">
          ← Back to studio
        </a>
        <span className="kicker">{route.eyebrow}</span>
        <h1>{route.title}</h1>
        <p>{route.summary}</p>
      </header>
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

function ErrorNote({ error, onRetry }: { error?: SurfaceError; onRetry: () => void }) {
  if (!error) return null;
  return (
    <StatusNote
      tone="error"
      title={error.title}
      primaryAction={error.retryable ? { label: 'Try again', onClick: onRetry } : undefined}
      secondaryAction={
        error.cause === 'policy_blocked'
          ? {
              label: 'Read content policy',
              onClick: () => window.location.assign('/content-policy'),
            }
          : undefined
      }
    >
      <p>{error.message}</p>
      <p>{error.recovery}</p>
    </StatusNote>
  );
}

export default function App() {
  const route = policyRoutes[normalizedPathname()];
  if (route) return <PolicyPage route={route} />;
  return <StudioApp />;
}

function StudioApp() {
  const vm = useStudioViewModel();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [checkoutReturn, setCheckoutReturn] = useState<{
    state: 'cancelled' | 'processing' | 'paid' | 'failed';
    order?: OrderSummary;
    message: string;
  } | null>(null);
  const designHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (['drafted', 'quoted', 'confirmed'].includes(vm.flow)) designHeading.current?.focus();
  }, [vm.flow]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutState = params.get('checkout');
    if (checkoutState === 'cancelled') {
      setCheckoutReturn({
        state: 'cancelled',
        message: 'No payment was made. You can return to the studio when you are ready.',
      });
      return undefined;
    }
    const stripeSessionId = params.get('session_id');
    if (checkoutState !== 'success' || !stripeSessionId) return undefined;

    let cancelled = false;
    setCheckoutReturn({
      state: 'processing',
      message: 'Stripe returned successfully. Confirming the payment and order record now.',
    });
    const confirmOrder = async () => {
      for (let attempt = 0; attempt < 10 && !cancelled; attempt += 1) {
        try {
          const result = await api.checkoutOrder(stripeSessionId);
          const order = result.data;
          if (order.status !== 'checkout_pending') {
            setCheckoutReturn({
              state: 'paid',
              order,
              message: `Payment received for ${order.orderNumber}. Real Printful fulfillment remains paused for operator review.`,
            });
            return;
          }
        } catch {
          // Stripe can redirect before the webhook and database update finish.
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }
      if (!cancelled) {
        setCheckoutReturn({
          state: 'processing',
          message:
            'Payment confirmation is taking longer than expected. Do not submit another payment; refresh this page in a moment.',
        });
      }
    };
    void confirmOrder();
    return () => {
      cancelled = true;
    };
  }, []);

  if (vm.flow === 'booting')
    return (
      <main className="loading-shell" aria-busy="true">
        <div className="loading-card">
          <span className="brand-symbol" aria-hidden="true">
            OM
          </span>
          <span className="kicker">Open source · self-hostable</span>
          <h1>Open Merch Studio</h1>
          <p>Loading the catalog and studio configuration…</p>
          <div className="loading-lines" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </div>
      </main>
    );
  if (vm.flow === 'boot_failed')
    return (
      <main className="loading-shell">
        <div className="loading-card">
          <span className="brand-symbol" aria-hidden="true">
            OM
          </span>
          <ErrorNote error={vm.errors.boot} onRetry={vm.boot} />
        </div>
      </main>
    );

  const isFixture =
    vm.dataSource === 'fixture' ||
    vm.design?.provider === 'mock' ||
    vm.checkout?.mode === 'fixture';
  const promptReason = !vm.selectedProduct
    ? 'Choose a product first.'
    : !vm.prompt.trim()
      ? 'Describe your design to generate a draft.'
      : '';
  const quoteReason =
    !vm.selectedProduct || !vm.selectedVariant ? 'Choose an available product variant first.' : '';
  const checkoutReason = vm.quoteExpired
    ? 'Refresh the expired quote before checkout.'
    : vm.quoteStale
      ? 'Update the price before checkout.'
      : !vm.quote
        ? 'Calculate the price before checkout.'
        : '';
  const showLedger = Boolean(
    vm.quote ||
    vm.busy.quoting ||
    vm.flow === 'quoted' ||
    vm.flow === 'quote_stale' ||
    vm.flow === 'quote_expired'
  );
  const firstTee =
    vm.products.find((product) => product.categorySlug === 'apparel') ?? vm.products[0];

  return (
    <main className="app-shell">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {vm.announcement}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive">
        {Object.values(vm.errors).find(Boolean)?.title}
      </div>
      <header className="app-header">
        <a className="brand" href="/" aria-label="Open Merch Studio home">
          <span className="brand-symbol" aria-hidden="true">
            OM
          </span>
          <span>
            <b>Open Merch Studio</b>
            <small>catalog-driven merch workbench</small>
          </span>
        </a>
        <div className="provider-bar" aria-label="Provider status">
          <ProviderChip
            label="AI"
            state={!vm.online ? 'offline' : providerState(vm.design?.provider)}
          />
          <ProviderChip
            label="Checkout"
            state={!vm.online ? 'offline' : providerState(vm.checkout?.mode)}
          />
          <ProviderChip
            label="Fulfillment"
            state={
              !vm.online
                ? 'offline'
                : providerState(vm.order?.fulfillment.provider || vm.mockup?.provider)
            }
          />
        </div>
        <nav className="header-links" aria-label="Project links">
          <a href="/support">Support</a>
          <a href="https://github.com/foxandhenllc/open-merch-studio">GitHub</a>
        </nav>
      </header>

      {(!vm.online || vm.fallback) && (
        <div className="connection-banner" role="status">
          <strong>
            {!vm.online
              ? 'Offline — reconnecting'
              : 'Studio server unreachable — switched to demo data'}
          </strong>
          <span>
            {vm.fallback?.reason || 'Your current work stays in this browser.'} Self-hosting? Check
            the backend and VITE_API_URL.
          </span>
          <div>
            {vm.online && (
              <button type="button" className="text-action" onClick={vm.boot}>
                Retry live server
              </button>
            )}
            {vm.fallback && (
              <button
                type="button"
                className="icon-button"
                onClick={vm.dismissFallback}
                aria-label="Dismiss connection banner"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}
      {isFixture && (
        <div className="fixture-banner">
          <span className="status-pill">Fixture mode</span>
          <p>
            <strong>Full journey, zero risk.</strong> Demo data is labeled; no real image
            generation, charge, or provider order is created.
          </p>
        </div>
      )}

      {checkoutReturn && (
        <div className="checkout-return">
          <StatusNote
            tone={
              checkoutReturn.state === 'paid'
                ? 'success'
                : checkoutReturn.state === 'failed'
                  ? 'error'
                  : checkoutReturn.state === 'cancelled'
                    ? 'warning'
                    : 'info'
            }
            title={
              checkoutReturn.state === 'paid'
                ? 'Payment received'
                : checkoutReturn.state === 'cancelled'
                  ? 'Checkout cancelled'
                  : checkoutReturn.state === 'failed'
                    ? 'Payment confirmation failed'
                    : 'Confirming your payment'
            }
          >
            <p>{checkoutReturn.message}</p>
            {checkoutReturn.order && (
              <p>
                Total: {money(checkoutReturn.order.totalCents, checkoutReturn.order.currency)} · A
                confirmation record is saved for support.
              </p>
            )}
          </StatusNote>
        </div>
      )}

      <StepRail states={vm.stepStates} onNavigate={vm.navigate} />

      <section className={`workbench ${showLedger ? 'has-ledger' : ''}`}>
        <div
          className={`sheet-backdrop ${catalogOpen || ledgerOpen ? 'is-open' : ''}`}
          onClick={() => {
            setCatalogOpen(false);
            setLedgerOpen(false);
          }}
          aria-hidden="true"
        />
        <div className={`catalog-shell ${catalogOpen ? 'is-open' : ''}`} id="step-product">
          <CatalogPanel
            categories={vm.categories}
            products={vm.products}
            category={vm.selectedCategory}
            loading={vm.busy.catalog}
            selectedProductId={vm.selectedProductId}
            onCategory={vm.setSelectedCategory}
            onSelect={(product) => {
              vm.selectProduct(product);
              setCatalogOpen(false);
            }}
            onClose={() => setCatalogOpen(false)}
          />
        </div>

        <section className="workspace" id="step-make">
          {vm.selectedProduct && (
            <button className="change-product" type="button" onClick={() => setCatalogOpen(true)}>
              <span>Product</span>
              <strong>{vm.selectedProduct.title}</strong>
              <small>Change</small>
            </button>
          )}
          <GenerationStage
            product={vm.selectedProduct}
            variant={vm.selectedVariant}
            draft={vm.design}
            mockup={vm.mockup}
            generating={vm.busy.generating}
            mockupBusy={vm.busy.mockup}
            phase={vm.generationPhase}
            startedAt={vm.operationStartedAt}
            stale={vm.mockupStale}
            onCancel={vm.cancelGeneration}
            onRetryMockup={vm.createMockup}
            onContinueWithoutMockup={vm.createQuote}
            error={vm.errors.mockup}
            orientation={vm.selectedOrientation}
          />

          {!vm.selectedProduct && (
            <div className="first-run-actions">
              <button
                className="button button--primary"
                type="button"
                disabled={!firstTee}
                onClick={() => firstTee && vm.selectProduct(firstTee)}
              >
                Start with a tee
              </button>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => setCatalogOpen(true)}
              >
                Browse the catalog
              </button>
            </div>
          )}

          {vm.selectedProduct && vm.selectedVariant && (
            <section className="controls" aria-labelledby="design-controls-title">
              <div className="section-heading">
                <div>
                  <span className="kicker">Active step</span>
                  <h2 id="design-controls-title" ref={designHeading} tabIndex={-1}>
                    {vm.design ? 'Make and refine' : 'Describe your design'}
                  </h2>
                </div>
                <span className="mono session-id">{vm.session?.id}</span>
              </div>
              <div className="selection-grid">
                <label>
                  <span>Color &amp; size</span>
                  <select
                    value={vm.selectedVariantId}
                    onChange={(event) => vm.setSelectedVariantId(event.target.value)}
                  >
                    {vm.selectedProduct.variants.map((variant) => (
                      <option key={variant.id} value={variant.id} disabled={!variant.isAvailable}>
                        {variant.name} —{' '}
                        {variant.isAvailable ? money(variant.costCents) : 'unavailable'}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset>
                  <legend>Print placement</legend>
                  <div className="placement-options">
                    {vm.selectedProduct.placements.map((placement) => (
                      <button
                        key={placement.code}
                        type="button"
                        aria-pressed={vm.selectedPlacements.includes(placement.code)}
                        onClick={() => vm.togglePlacement(placement.code)}
                      >
                        {placement.displayName}
                      </button>
                    ))}
                  </div>
                </fieldset>
                {vm.selectedProduct.categorySlug === 'wall-art' && (
                  <fieldset>
                    <legend>Poster orientation</legend>
                    <div className="placement-options">
                      {vm.selectedOrientation === 'square' ? (
                        <button type="button" aria-pressed="true">
                          Square
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            aria-pressed={vm.selectedOrientation === 'landscape'}
                            onClick={() => vm.setSelectedOrientation('landscape')}
                          >
                            Landscape
                          </button>
                          <button
                            type="button"
                            aria-pressed={vm.selectedOrientation === 'portrait'}
                            onClick={() => vm.setSelectedOrientation('portrait')}
                          >
                            Portrait
                          </button>
                        </>
                      )}
                    </div>
                  </fieldset>
                )}
              </div>
              <label className="prompt-field">
                <span>Design prompt</span>
                <textarea
                  value={vm.prompt}
                  onChange={(event) => vm.setPrompt(event.target.value)}
                  rows={4}
                  placeholder="A bold two-color sunburst badge for a neighborhood coffee shop…"
                  aria-describedby="prompt-help prompt-disabled-reason"
                />
                <small id="prompt-help">
                  Describe the subject, style, colors, and any essential words. Avoid private data
                  and unlicensed marks.
                </small>
                <b className={vm.prompt.length > 500 ? 'is-warning' : ''}>
                  {vm.prompt.length} characters
                  {vm.prompt.length > 500 ? ' · consider tightening the brief' : ''}
                </b>
              </label>
              {vm.idea && (
                <div className="refined-prompt">
                  <span className="kicker">Refined prompt</span>
                  <p>{vm.idea.refinedPrompt}</p>
                  <div>
                    {vm.idea.styleTags.map((tag) => (
                      <span className="status-pill" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="control-actions">
                <div>
                  <button
                    className="button button--primary"
                    type="button"
                    onClick={vm.generate}
                    disabled={Boolean(promptReason) || vm.busy.generating}
                  >
                    {vm.busy.generating ? 'Generating draft…' : 'Generate rough draft'}
                  </button>
                  {promptReason && <small id="prompt-disabled-reason">{promptReason}</small>}
                </div>
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={vm.refineIdea}
                  disabled={!vm.prompt.trim() || vm.busy.refining}
                >
                  {vm.busy.refining ? 'Refining…' : 'Refine prompt'}
                </button>
                <div>
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={vm.createQuote}
                    disabled={Boolean(quoteReason) || vm.busy.quoting}
                  >
                    {vm.busy.quoting
                      ? 'Calculating…'
                      : vm.quote
                        ? 'Update price'
                        : 'Calculate price'}
                  </button>
                  {quoteReason && <small>{quoteReason}</small>}
                </div>
              </div>
              <ErrorNote error={vm.errors.generation} onRetry={vm.generate} />
              {vm.design && (
                <>
                  <ReadinessChecks draft={vm.design} />
                  <AllowanceMeter
                    allowance={vm.design.allowance}
                    onBuyPass={vm.buyStudioPass}
                    busy={vm.busy.pass}
                  />
                  <label className="revision-field">
                    <span>Revision instructions</span>
                    <textarea
                      rows={3}
                      value={vm.revision}
                      onChange={(event) => vm.setRevision(event.target.value)}
                    />
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={vm.reviseDraft}
                      disabled={!vm.design.id || !vm.revision.trim() || vm.busy.revising}
                    >
                      {vm.busy.revising ? 'Applying edit…' : 'Apply edit'}
                    </button>
                  </label>
                </>
              )}
            </section>
          )}

          <ErrorNote error={vm.errors.quote} onRetry={vm.createQuote} />
          {vm.quote && (
            <button
              className="mobile-ledger-summary"
              id="step-price"
              type="button"
              onClick={() => setLedgerOpen(true)}
            >
              <span>Estimated total</span>
              <strong>{money(vm.quote.totalCents, vm.quote.currency)}</strong>
              <small>
                {vm.quoteStale || vm.quoteExpired ? 'Update required' : 'View ledger'}
              </small>
            </button>
          )}

          {vm.quote && (
            <section className="checkout-section" id="step-order">
              <div className="section-heading">
                <div>
                  <span className="kicker">Review and order</span>
                  <h2>
                    {vm.order
                      ? 'Your order'
                      : publicConfig.isProductionMode && !publicConfig.enablePublicCheckout
                        ? 'Quote ready'
                        : 'Ready for checkout'}
                  </h2>
                </div>
              </div>
              {!vm.order && (
                <>
                  <label className="email-field">
                    <span>Email for confirmation</span>
                    <input
                      type="email"
                      value={vm.email}
                      onChange={(event) => vm.setEmail(event.target.value)}
                      placeholder="you@example.com"
                    />
                  </label>
                  <button
                    className="button button--primary button--wide"
                    type="button"
                    onClick={vm.createCheckout}
                    disabled={Boolean(checkoutReason) || vm.busy.checkout}
                  >
                    {vm.busy.checkout
                      ? 'Submitting — don’t refresh…'
                      : publicConfig.isProductionMode && !publicConfig.enablePublicCheckout
                        ? 'Checkout opens soon'
                        : vm.checkout?.mode === 'stripe'
                          ? 'Continue to secure checkout'
                          : 'Place simulated order'}
                  </button>
                  {publicConfig.isProductionMode && !publicConfig.enablePublicCheckout && (
                    <p className="disabled-reason">
                      Checkout is not yet enabled. Your design and quote stay in this session.
                    </p>
                  )}
                  {checkoutReason && <p className="disabled-reason">{checkoutReason}</p>}
                  {vm.checkout?.status === 'blocked' && (
                    <StatusNote tone="warning" title="Checkout opens soon">
                      <p>{vm.checkout.message} Your design and quote stay in this session.</p>
                    </StatusNote>
                  )}
                  <ErrorNote error={vm.errors.checkout} onRetry={vm.createCheckout} />
                </>
              )}
              {vm.order && <OrderTimeline order={vm.order} />}
              {vm.errors.order && <ErrorNote error={vm.errors.order} onRetry={vm.createCheckout} />}
            </section>
          )}
        </section>

        {showLedger && (
          <div className={`ledger-shell ${ledgerOpen ? 'is-open' : ''}`}>
            <QuoteLedger
              quote={vm.quote}
              loading={vm.busy.quoting}
              stale={vm.quoteStale}
              expired={vm.quoteExpired}
              onRefresh={vm.createQuote}
              onClose={() => setLedgerOpen(false)}
            />
          </div>
        )}
      </section>

      {!publicConfig.isProductionMode && vm.adminReport && (
        <section className="operator-panel">
          <div>
            <span className="kicker">Self-host readiness</span>
            <h2>Connect providers when you’re ready.</h2>
            <p>
              The fixture journey works with zero API keys. Live operations stay separated behind
              explicit gates.
            </p>
          </div>
          <div className="operator-gates">
            {vm.adminReport.launchReadiness.gates.map((gate) => (
              <article key={gate.code}>
                <span
                  className={`status-pill status-pill--${gate.status === 'pass' ? 'ok' : gate.status === 'blocked' ? 'bad' : 'warn'}`}
                >
                  {gate.status}
                </span>
                <strong>{gate.label}</strong>
                <p>{gate.detail}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {vm.selectedProduct && (
        <div className="mobile-action">
          <button
            className="button button--primary"
            type="button"
            onClick={
              !vm.design
                ? vm.generate
                : !vm.quote || vm.quoteStale
                  ? vm.createQuote
                  : vm.createCheckout
            }
            disabled={
              !vm.selectedProduct ||
              (!vm.design && Boolean(promptReason)) ||
              (Boolean(vm.quote) && Boolean(checkoutReason))
            }
          >
            {!vm.design
              ? 'Generate rough draft'
              : !vm.quote || vm.quoteStale
                ? 'Calculate price'
                : 'Continue to order'}
          </button>
          <small>
            {!vm.selectedProduct
              ? 'Choose a product to begin.'
              : !vm.design
                ? promptReason
                : !vm.quote
                  ? quoteReason
                  : checkoutReason}
          </small>
        </div>
      )}
      <SiteFooter />
    </main>
  );
}
