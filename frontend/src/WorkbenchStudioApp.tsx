import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CatalogPanel } from '@components/CatalogPanel';
import { CheckoutPanel } from '@components/CheckoutPanel';
import { ConfigurationPanel } from '@components/ConfigurationPanel';
import { ArtworkSourcePanel } from '@components/ArtworkSourcePanel';
import { ErrorNote } from '@components/ErrorNote';
import { GenerationStage } from '@components/GenerationStage';
import { OrderTimeline } from '@components/OrderTimeline';
import { OpenSourceAttribution } from '@components/OpenSourceAttribution';
import { PrintAreaReview } from '@components/PrintAreaReview';
import { ReadinessChecks } from '@components/ReadinessChecks';
import { StatusNote } from '@components/StatusNote';
import { StepRail } from '@components/StepRail';
import { publicConfig } from './config';
import { api } from './services/api';
import { useStudioViewModel } from './studio-view-model';
import type { CheckoutConfirmation } from './types/catalog';
import { trackEvent } from './utils/analytics';
import { formatMoney } from './utils/currency';

const PENDING_CHECKOUT_KEY = 'open-merch-studio:pending-checkout:v1';
const pendingCheckoutSession = (): string | null => {
  try {
    const value = window.sessionStorage.getItem(PENDING_CHECKOUT_KEY);
    return value?.startsWith('cs_') ? value : null;
  } catch {
    return null;
  }
};

const savePendingCheckoutSession = (sessionId: string | null) => {
  try {
    if (sessionId) window.sessionStorage.setItem(PENDING_CHECKOUT_KEY, sessionId);
    else window.sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
  } catch {
    // Confirmation can still continue in the active page when session storage is unavailable.
  }
};

const checkoutHandoff = (): { state: string | null; sessionId: string | null } => {
  const params = new URLSearchParams(window.location.search);
  const state = params.get('checkout');
  const urlSessionId = params.get('session_id');
  const validUrlSessionId = urlSessionId?.startsWith('cs_') ? urlSessionId : null;
  if (state === 'cancelled') {
    savePendingCheckoutSession(null);
    return { state, sessionId: null };
  }
  if (state === 'success' && validUrlSessionId) {
    savePendingCheckoutSession(validUrlSessionId);
    return { state, sessionId: validUrlSessionId };
  }
  const savedSessionId = pendingCheckoutSession();
  return {
    state: state ?? (savedSessionId ? 'success' : null),
    sessionId: validUrlSessionId ?? savedSessionId,
  };
};

function Footer({ onStartFresh }: { onStartFresh: () => void }) {
  return (
    <footer className="site-footer compact-footer">
      <details className="workspace-menu">
        <summary>Help &amp; session</summary>
        <div className="workspace-menu__content">
          <nav aria-label="Footer links">
            <a href="/examples/fox-and-hen">Example shop</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/returns">Returns</a>
            <a href="/content-policy">Content policy</a>
            <a href="/support">Support</a>
          </nav>
          <button className="text-action" type="button" onClick={onStartFresh}>
            Start fresh
          </button>
          <OpenSourceAttribution />
        </div>
      </details>
    </footer>
  );
}

export function WorkbenchStudioApp() {
  const vm = useStudioViewModel();
  const panelHeading = useRef<HTMLHeadingElement>(null);
  const catalogHeading = useRef<HTMLHeadingElement>(null);
  const promptField = useRef<HTMLTextAreaElement>(null);
  const taskPanelScroll = useRef<HTMLDivElement>(null);
  const checkoutParams = useRef<{ state: string | null; sessionId: string | null } | null>(null);
  if (!checkoutParams.current) {
    checkoutParams.current = checkoutHandoff();
  }
  const [checkoutReturn, setCheckoutReturn] = useState<CheckoutConfirmation | null>(null);
  const [checkoutPolling, setCheckoutPolling] = useState(false);
  const [checkoutAttempt, setCheckoutAttempt] = useState(0);
  const [designOptionsOpen, setDesignOptionsOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadRightsConfirmed, setUploadRightsConfirmed] = useState(false);
  const [removeUploadBackground, setRemoveUploadBackground] = useState(false);
  const [referenceRightsConfirmed, setReferenceRightsConfirmed] = useState(false);
  const studioReady = vm.flow !== 'booting' && vm.flow !== 'boot_failed';

  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutState = checkoutParams.current?.state ?? null;
    const stripeSessionId = checkoutParams.current?.sessionId ?? null;
    if (checkoutState || stripeSessionId) {
      params.delete('checkout');
      params.delete('session_id');
      const remainingQuery = params.toString();
      window.history.replaceState(
        window.history.state,
        document.title,
        `${window.location.pathname}${remainingQuery ? `?${remainingQuery}` : ''}${window.location.hash}`
      );
    }
  }, []);

  useLayoutEffect(() => {
    if (taskPanelScroll.current) taskPanelScroll.current.scrollTop = 0;
  }, [vm.workbenchMode]);

  useEffect(() => {
    if (!studioReady) return undefined;
    const checkoutState = checkoutParams.current?.state ?? null;
    const stripeSessionId = checkoutParams.current?.sessionId ?? null;
    if (checkoutState === 'cancelled') {
      savePendingCheckoutSession(null);
      trackEvent('checkout_returned', { result: 'cancelled', mode: 'live' });
      setCheckoutReturn({
        state: 'failed',
        message: 'Checkout was cancelled. No payment was made.',
      });
      return undefined;
    }
    if (checkoutState !== 'success' || !stripeSessionId) return undefined;
    let cancelled = false;
    setCheckoutPolling(true);
    setCheckoutReturn({
      state: 'processing',
      message: 'Stripe returned successfully. Confirming your payment now.',
    });
    const confirm = async () => {
      try {
        for (let attempt = 0; attempt < 30 && !cancelled; attempt += 1) {
          try {
            const result = await api.checkoutOrder(stripeSessionId);
            const confirmation = result.data;
            setCheckoutReturn(confirmation);
            if (confirmation.state !== 'processing') {
              savePendingCheckoutSession(null);
              if (confirmation.order) vm.acceptConfirmedOrder(confirmation.order);
              trackEvent('checkout_returned', {
                result: confirmation.state === 'failed' ? 'unknown' : 'success',
                mode: 'live',
              });
              return;
            }
          } catch {
            // Stripe may redirect before the signed webhook is reconciled.
          }
          await new Promise((resolve) => window.setTimeout(resolve, 2000));
        }
        if (!cancelled) {
          trackEvent('checkout_returned', { result: 'unknown', mode: 'live' });
          setCheckoutReturn({
            state: 'processing',
            message: 'Confirmation is still processing. Do not submit another payment.',
          });
        }
      } finally {
        if (!cancelled) setCheckoutPolling(false);
      }
    };
    void confirm();
    return () => {
      cancelled = true;
    };
  }, [checkoutAttempt, studioReady, vm.acceptConfirmedOrder]);

  useEffect(() => {
    if (!studioReady || vm.workbenchMode === 'generating') return undefined;
    const focusFrame = window.requestAnimationFrame(() => {
      const target =
        vm.workbenchMode === 'product'
          ? catalogHeading.current
          : vm.workbenchMode === 'describe'
            ? promptField.current
            : panelHeading.current;
      target?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [studioReady, vm.workbenchMode]);

  useEffect(() => {
    if (vm.workbenchMode !== 'review') setDesignOptionsOpen(false);
  }, [vm.workbenchMode, vm.design?.id]);

  useEffect(() => {
    if (!uploadFile) {
      setUploadPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(uploadFile);
    setUploadPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [uploadFile]);

  if (vm.flow === 'booting') {
    return (
      <main className="loading-shell" aria-busy="true">
        <div className="loading-card">
          <span className="brand-symbol" aria-hidden="true">
            OM
          </span>
          <h1>Open Merch Studio</h1>
          <p>Getting the studio ready…</p>
        </div>
      </main>
    );
  }
  if (vm.flow === 'boot_failed') {
    return (
      <main className="loading-shell">
        <div className="loading-card">
          <ErrorNote error={vm.errors.boot} onRetry={vm.boot} />
        </div>
      </main>
    );
  }

  const selected = vm.selectedProduct && vm.selectedVariant;
  const promptBlocked =
    !selected ||
    !vm.prompt.trim() ||
    (vm.creationPath === 'reference' && !vm.referenceAssets.some((asset) => asset.id));
  const reviewSettling =
    vm.workbenchMode === 'review' &&
    (vm.busy.mockup ||
      vm.busy.quoting ||
      (vm.artworkQuoteEligible && !vm.quote && !vm.errors.mockup && !vm.errors.quote));
  const hasDesignOptions = vm.canRevise || vm.designHistory.length > 0 || vm.canGenerateAnother;
  const activePlacement = vm.selectedProduct?.placements.find(
    (placement) => placement.code === vm.activePlacementCode
  );
  const panelTitle = {
    product: 'Choose a product',
    configure: 'Choose color and size',
    describe: activePlacement ? `Create the ${activePlacement.displayName}` : 'Describe your design',
    generating: 'Making your artwork',
    review: reviewSettling ? 'Finishing your preview' : 'Your design is ready',
    checkout: 'Review and checkout',
    order: 'Your order',
  }[vm.workbenchMode];

  return (
    <main className={`app-shell streamlined-app mode-${vm.workbenchMode}`}>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {vm.announcement}
      </div>
      <header className="app-header compact-header">
        <a className="brand" href="/" aria-label="Open Merch Studio home">
          <span className="brand-symbol" aria-hidden="true">
            OM
          </span>
          <span>
            <b>Open Merch Studio</b>
            {publicConfig.enablePublicCheckout && <small>Now accepting orders</small>}
          </span>
        </a>
        <div className="compact-header__actions">
          <a href="/support">Support</a>
          <button className="text-action" type="button" onClick={vm.startFresh}>
            Start fresh
          </button>
        </div>
      </header>

      {checkoutReturn ? (
        <div className="checkout-return compact-return">
          <StatusNote
            tone={
              checkoutReturn.state === 'paid'
                ? 'success'
                : checkoutReturn.state === 'failed'
                  ? 'warning'
                  : 'info'
            }
            title={checkoutReturn.state === 'paid' ? 'Payment received' : 'Checkout update'}
            primaryAction={
              checkoutReturn.state === 'processing'
                ? checkoutPolling
                  ? undefined
                  : {
                      label: 'Check again',
                      onClick: () => setCheckoutAttempt((value) => value + 1),
                    }
                : { label: 'Dismiss', onClick: () => setCheckoutReturn(null) }
            }
          >
            <p>{checkoutReturn.message}</p>
            {checkoutReturn.order && (
              <p>
                {checkoutReturn.order.orderNumber} ·{' '}
                {formatMoney(checkoutReturn.order.totalCents, checkoutReturn.order.currency)}{' '}
                including {formatMoney(checkoutReturn.order.taxCents, checkoutReturn.order.currency)}{' '}
                tax
              </p>
            )}
          </StatusNote>
        </div>
      ) : !vm.online ? (
        <div className="checkout-return compact-return">
          <StatusNote tone="warning" title="You’re offline">
            <p>Your work is safe in this browser. Reconnect before generating or checking out.</p>
          </StatusNote>
        </div>
      ) : vm.recoveryMessage ? (
        <div className="checkout-return compact-return">
          <StatusNote
            tone="info"
            title="Your previous work was restored"
            primaryAction={{ label: 'Dismiss', onClick: vm.dismissRecovery }}
          >
            <p>{vm.recoveryMessage}</p>
          </StatusNote>
        </div>
      ) : null}

      <StepRail
        states={vm.stepStates}
        onNavigate={vm.navigate}
        locked={vm.workbenchMode === 'generating' || vm.workbenchMode === 'order'}
      />

      <section className="focused-workbench">
        <section className="focused-workbench__canvas" aria-label="Product canvas">
          {selected &&
            vm.workbenchMode !== 'product' &&
            vm.workbenchMode !== 'generating' &&
            (vm.workbenchMode === 'order' ? (
              <div className="canvas-product-summary is-static">
                <span className="canvas-product-summary__copy">
                  <strong>{vm.selectedProduct?.title}</strong>
                  <b>{vm.selectedVariant?.name}</b>
                </span>
                <small>Purchased item</small>
              </div>
            ) : (
              <button className="canvas-product-summary" type="button" onClick={vm.showProduct}>
                <span className="canvas-product-summary__copy">
                  <strong>{vm.selectedProduct?.title}</strong>
                  <b>{vm.selectedVariant?.name}</b>
                </span>
                <small>Change product</small>
              </button>
            ))}
          <GenerationStage
            product={vm.selectedProduct}
            variant={vm.selectedVariant}
            draft={vm.design}
            mockup={vm.mockup}
            generating={vm.busy.generating || vm.busy.revising}
            mockupBusy={vm.busy.mockup}
            phase={vm.busy.revising ? 'Creating your variation' : vm.generationPhase}
            startedAt={vm.operationStartedAt}
            stale={false}
            onCancel={vm.cancelGeneration}
            onRetryMockup={vm.createMockup}
            onContinueWithoutMockup={vm.createQuote}
            error={vm.errors.mockup}
            orientation={vm.selectedOrientation}
            activeViewIndex={vm.activeMockupViewIndex}
            onViewIndexChange={vm.setActiveMockupViewIndex}
            showMeta={vm.workbenchMode === 'generating'}
          />
        </section>

        <aside
          className="task-panel"
          aria-labelledby={vm.workbenchMode === 'product' ? 'catalog-title' : 'task-panel-title'}
        >
          <div className="task-panel__scroll" ref={taskPanelScroll}>
            {vm.workbenchMode !== 'product' && (
              <div className="task-panel__heading">
                <h1 id="task-panel-title" tabIndex={-1} ref={panelHeading}>
                  {panelTitle}
                </h1>
              </div>
            )}

            {vm.workbenchMode === 'product' && (
              <CatalogPanel
                categories={vm.categories}
                products={vm.products}
                category={vm.selectedCategory}
                loading={vm.busy.catalog}
                selectedProductId={vm.selectedProductId}
                selectedVariantId={vm.selectedVariantId}
                onCategory={vm.setSelectedCategory}
                onSelect={vm.selectProduct}
                headingRef={catalogHeading}
              />
            )}

            {vm.workbenchMode === 'configure' && selected && (
              <ConfigurationPanel
                product={vm.selectedProduct!}
                variant={vm.selectedVariant!}
                selectedPlacements={vm.selectedPlacements}
                quote={vm.quote}
                quoteStale={vm.quoteStale}
                mugLayout={vm.mugLayout}
                orientation={vm.selectedOrientation}
                onVariantChange={vm.setSelectedVariantId}
                onTogglePlacement={vm.togglePlacement}
                onMugLayoutChange={vm.setMugLayout}
                onOrientationChange={vm.setSelectedOrientation}
                onContinue={vm.continueFromConfigure}
              />
            )}

            {vm.workbenchMode === 'describe' && selected && (
              <ArtworkSourcePanel
                productTitle={vm.selectedProduct!.title}
                variantName={vm.selectedVariant!.name}
                activePlacement={activePlacement}
                creationPath={vm.creationPath}
                uploadFile={uploadFile}
                uploadPreview={uploadPreview}
                uploadRightsConfirmed={uploadRightsConfirmed}
                removeUploadBackground={removeUploadBackground}
                referenceAssets={vm.referenceAssets}
                referenceRightsConfirmed={referenceRightsConfirmed}
                prompt={vm.prompt}
                promptBlocked={promptBlocked}
                generating={vm.busy.generating}
                error={vm.errors.generation}
                promptRef={promptField}
                onShowConfigure={vm.showConfigure}
                onCreationPathChange={vm.setCreationPath}
                onUploadFileChange={setUploadFile}
                onUploadRightsChange={setUploadRightsConfirmed}
                onRemoveUploadBackgroundChange={setRemoveUploadBackground}
                onReferenceRightsChange={setReferenceRightsConfirmed}
                onAddReferenceImages={(files) => void vm.addReferenceImages(files)}
                onRemoveReferenceAsset={vm.removeReferenceAsset}
                onPromptChange={vm.setPrompt}
                onSubmit={() => {
                  if (vm.creationPath === 'upload' && uploadFile) {
                    void vm.uploadArtwork(uploadFile, removeUploadBackground);
                  } else {
                    void vm.generate();
                  }
                }}
              />
            )}

            {vm.workbenchMode === 'generating' && (
              <div className="panel-stack generation-panel">
                <p>Your artwork and product preview will appear on the canvas automatically.</p>
              </div>
            )}

            {vm.workbenchMode === 'review' && vm.design && (
              <div className="panel-stack review-panel">
                {reviewSettling ? (
                  <div className="review-preparing" role="status" aria-live="polite">
                    <span className="progress-orbit" aria-hidden="true" />
                    <div>
                      <b>Preparing the finished product view</b>
                      <p>We’ll show checkout actions as soon as the preview and price are ready.</p>
                    </div>
                  </div>
                ) : (
                  <div className={`ready-confirmation is-${vm.design.readiness.status}`}>
                    <span aria-hidden="true">{vm.artworkReady ? '✓' : '!'}</span>
                    <div>
                      <b>{vm.artworkReady ? 'Print ready' : 'Needs a quick review'}</b>
                      <p>
                        {vm.artworkReady
                          ? 'Your artwork is saved and ready to order.'
                          : 'Review the checks below before checkout.'}
                      </p>
                    </div>
                  </div>
                )}
                {!reviewSettling && vm.quote ? (
                  <div className="review-total">
                    <span>Estimated total before tax</span>
                    <strong>{formatMoney(vm.quote.totalCents, vm.quote.currency)}</strong>
                  </div>
                ) : !reviewSettling ? (
                  <p className="muted-copy">Price unavailable right now.</p>
                ) : null}
                {!reviewSettling && vm.selectedProduct && (
                  <PrintAreaReview
                    categorySlug={vm.selectedProduct.categorySlug}
                    placements={vm.selectedProduct.placements}
                    selectedPlacementCodes={vm.selectedPlacements}
                    placementArtwork={vm.placementArtwork}
                    defaultArtwork={vm.design}
                    quote={vm.quote}
                    mugLayout={vm.mugLayout}
                    onEditAreas={vm.showConfigure}
                    onCustomizePlacement={vm.customizePlacement}
                    onReusePlacementArtwork={vm.reusePlacementArtwork}
                  />
                )}
                <ErrorNote error={vm.errors.quote} onRetry={vm.createQuote} />
                {!reviewSettling && (
                  <div className="review-actions">
                    <button
                      className="button button--primary button--wide"
                      type="button"
                      onClick={vm.showCheckout}
                      disabled={
                        !vm.quote ||
                        vm.quoteStale ||
                        vm.quoteExpired ||
                        vm.busy.quoting ||
                        vm.busy.mockup ||
                        (vm.mockup?.status !== 'complete' && !vm.errors.mockup) ||
                        !vm.artworkReady
                      }
                    >
                      Review and checkout
                    </button>
                    <button
                      className="button button--secondary button--wide"
                      type="button"
                      onClick={() => {
                        if (hasDesignOptions) setDesignOptionsOpen(true);
                        else vm.showDescribe();
                      }}
                    >
                      Make changes
                    </button>
                    <button className="text-action" type="button" onClick={vm.showProduct}>
                      Try it on another product
                    </button>
                  </div>
                )}
                {!reviewSettling && <ReadinessChecks draft={vm.design} />}
                {!reviewSettling && hasDesignOptions && (
                  <details
                    className="refine-panel"
                    open={designOptionsOpen}
                    onToggle={(event) => setDesignOptionsOpen(event.currentTarget.open)}
                  >
                    <summary>More design options</summary>
                    {vm.canRevise && (
                      <label className="revision-field">
                        <span>Create a variation</span>
                        <textarea
                          rows={3}
                          value={vm.revision}
                          onChange={(event) => vm.setRevision(event.target.value)}
                          placeholder="Make the main subject larger…"
                        />
                        <button
                          className="button button--secondary"
                          type="button"
                          onClick={vm.reviseDraft}
                          disabled={!vm.revision.trim() || vm.busy.revising}
                        >
                          Create variation
                        </button>
                      </label>
                    )}
                    {vm.designHistory.length > 0 && (
                      <button className="text-action" type="button" onClick={vm.undoDraft}>
                        Restore previous artwork
                      </button>
                    )}
                    {vm.canGenerateAnother && (
                      <button className="text-action" type="button" onClick={vm.showDescribe}>
                        Generate another design
                      </button>
                    )}
                  </details>
                )}
              </div>
            )}

            {vm.workbenchMode === 'checkout' && (
              <CheckoutPanel
                quote={vm.quote}
                quoting={vm.busy.quoting}
                quoteStale={vm.quoteStale}
                quoteExpired={vm.quoteExpired}
                onRefreshQuote={vm.createQuote}
                email={vm.email}
                onEmailChange={vm.setEmail}
                readiness={vm.checkoutReadiness}
                checkoutEnabled={publicConfig.enablePublicCheckout}
                checkoutBusy={vm.busy.checkout}
                checkoutError={vm.errors.checkout}
                onCheckout={vm.createCheckout}
                onBack={vm.showReview}
              />
            )}

            {vm.workbenchMode === 'order' && vm.order && <OrderTimeline order={vm.order} />}
            <Footer onStartFresh={vm.startFresh} />
          </div>
        </aside>
      </section>
    </main>
  );
}
