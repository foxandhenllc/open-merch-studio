import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CatalogPanel } from '@components/CatalogPanel';
import { CheckoutPanel } from '@components/CheckoutPanel';
import { ConfigurationPanel } from '@components/ConfigurationPanel';
import { ArtworkSourcePanel } from '@components/ArtworkSourcePanel';
import { CartPanel } from '@components/CartPanel';
import { ErrorNote } from '@components/ErrorNote';
import { GenerationStage } from '@components/GenerationStage';
import { OrderTimeline } from '@components/OrderTimeline';
import { OpenSourceAttribution } from '@components/OpenSourceAttribution';
import { ReviewPanel } from '@components/ReviewPanel';
import { StatusNote } from '@components/StatusNote';
import { StepRail } from '@components/StepRail';
import { publicConfig } from './config';
import { useCheckoutReturn } from './hooks/useCheckoutReturn';
import { useOrderRevisit } from './hooks/useOrderRevisit';
import { useStudioViewModel } from './studio-view-model';
import { formatMoney } from './utils/currency';

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
  const [designOptionsOpen, setDesignOptionsOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadRightsConfirmed, setUploadRightsConfirmed] = useState(false);
  const [removeUploadBackground, setRemoveUploadBackground] = useState(false);
  const [referenceRightsConfirmed, setReferenceRightsConfirmed] = useState(false);
  const studioReady = vm.flow !== 'booting' && vm.flow !== 'boot_failed';
  const {
    confirmation: checkoutReturn,
    polling: checkoutPolling,
    retry: retryCheckoutReturn,
    dismiss: dismissCheckoutReturn,
  } = useCheckoutReturn({
    studioReady,
    onConfirmedOrder: vm.acceptConfirmedOrder,
  });
  const orderRevisit = useOrderRevisit({
    studioReady,
    onConfirmedOrder: vm.acceptConfirmedOrder,
  });

  useLayoutEffect(() => {
    if (taskPanelScroll.current) taskPanelScroll.current.scrollTop = 0;
  }, [vm.workbenchMode]);

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
      (vm.busy.quoting && !vm.quote) ||
      (vm.artworkQuoteEligible && !vm.quote && !vm.errors.mockup && !vm.errors.quote));
  const hasDesignOptions = vm.canRevise || vm.designHistory.length > 0 || vm.canGenerateAnother;
  const activePlacement = vm.selectedProduct?.placements.find(
    (placement) => placement.code === vm.activePlacementCode
  );
  const panelTitle = {
    product: 'Choose a product',
    configure: 'Choose color and size',
    describe: activePlacement
      ? `Create the ${activePlacement.displayName}`
      : 'Describe your design',
    generating: 'Making your artwork',
    review: reviewSettling ? 'Finishing your preview' : 'Your design is ready',
    cart: 'Your cart',
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
          <button className="header-cart" type="button" onClick={vm.showCart}>
            Cart <span aria-label={`${vm.cartUnitCount} items`}>{vm.cartUnitCount}</span>
          </button>
          <a href="/support">Support</a>
          <button className="text-action" type="button" onClick={vm.startFresh}>
            Start fresh
          </button>
        </div>
      </header>

      {orderRevisit.loading ? (
        <div className="checkout-return compact-return">
          <StatusNote tone="info" title="Opening your order">
            <p>Loading the private order details from your email link…</p>
          </StatusNote>
        </div>
      ) : orderRevisit.error ? (
        <div className="checkout-return compact-return">
          <StatusNote
            tone="warning"
            title="We couldn’t open that order"
            primaryAction={
              orderRevisit.retryable
                ? { label: 'Try again', onClick: orderRevisit.retry }
                : { label: 'Dismiss', onClick: orderRevisit.dismiss }
            }
          >
            <p>{orderRevisit.error}</p>
          </StatusNote>
        </div>
      ) : checkoutReturn ? (
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
                      onClick: retryCheckoutReturn,
                    }
                : { label: 'Dismiss', onClick: dismissCheckoutReturn }
            }
          >
            <p>{checkoutReturn.message}</p>
            {checkoutReturn.order && (
              <p>
                {checkoutReturn.order.orderNumber} ·{' '}
                {formatMoney(checkoutReturn.order.totalCents, checkoutReturn.order.currency)}{' '}
                including{' '}
                {formatMoney(checkoutReturn.order.taxCents, checkoutReturn.order.currency)} tax
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
              <ReviewPanel
                product={vm.selectedProduct!}
                design={vm.design}
                quote={vm.quote}
                quantity={vm.quantity}
                placementArtwork={vm.placementArtwork}
                selectedPlacementCodes={vm.selectedPlacements}
                mugLayout={vm.mugLayout}
                status={{
                  settling: reviewSettling,
                  artworkReady: vm.artworkReady,
                  quoteStale: vm.quoteStale,
                  quoteExpired: vm.quoteExpired,
                  quoting: vm.busy.quoting,
                  mockupBusy: vm.busy.mockup,
                  mockupComplete: vm.mockup?.status === 'complete',
                  mockupErrorPresent: Boolean(vm.errors.mockup),
                  revising: vm.busy.revising,
                  quoteError: vm.errors.quote,
                }}
                designOptions={{
                  open: designOptionsOpen,
                  canRevise: vm.canRevise,
                  hasHistory: vm.designHistory.length > 0,
                  canGenerateAnother: vm.canGenerateAnother,
                  revision: vm.revision,
                }}
                actions={{
                  onQuantityChange: vm.setQuantity,
                  onAddToCart: vm.addCurrentDesignToCart,
                  onEditAreas: vm.showConfigure,
                  onCustomizePlacement: vm.customizePlacement,
                  onReusePlacementArtwork: vm.reusePlacementArtwork,
                  onRetryQuote: vm.createQuote,
                  onCheckout: vm.showCheckout,
                  onMakeChanges: () => {
                    if (hasDesignOptions) setDesignOptionsOpen(true);
                    else vm.showDescribe();
                  },
                  onTryAnotherProduct: vm.showProduct,
                  onOptionsToggle: setDesignOptionsOpen,
                  onRevisionChange: vm.setRevision,
                  onRevise: vm.reviseDraft,
                  onUndo: vm.undoDraft,
                  onGenerateAnother: vm.showDescribe,
                }}
              />
            )}

            {vm.workbenchMode === 'cart' && (
              <CartPanel
                items={vm.cart.items}
                quote={vm.cart.quote}
                quoteStale={vm.cart.quoteStale}
                quoteExpired={vm.cart.quoteExpired}
                quoting={vm.cart.quoting}
                error={vm.cart.error}
                onQuantityChange={vm.cart.updateQuantity}
                onRemove={vm.cart.remove}
                onRefreshQuote={vm.cart.refreshQuote}
                onKeepShopping={vm.showProduct}
                onCheckout={vm.showCartCheckout}
              />
            )}

            {vm.workbenchMode === 'checkout' && (
              <CheckoutPanel
                quote={vm.checkoutSource === 'cart' ? vm.cart.quote : vm.quote}
                quoting={vm.checkoutSource === 'cart' ? vm.cart.quoting : vm.busy.quoting}
                quoteStale={vm.checkoutSource === 'cart' ? vm.cart.quoteStale : vm.quoteStale}
                quoteExpired={vm.checkoutSource === 'cart' ? vm.cart.quoteExpired : vm.quoteExpired}
                onRefreshQuote={
                  vm.checkoutSource === 'cart' ? vm.cart.refreshQuote : vm.createQuote
                }
                email={vm.email}
                onEmailChange={vm.setEmail}
                readiness={
                  vm.checkoutSource === 'cart' ? vm.cartCheckoutReadiness : vm.checkoutReadiness
                }
                checkoutEnabled={publicConfig.enablePublicCheckout}
                checkoutBusy={vm.busy.checkout}
                checkoutError={vm.errors.checkout}
                onCheckout={vm.createCheckout}
                onBack={vm.showCheckoutBack}
              />
            )}

            {vm.workbenchMode === 'order' && vm.order && (
              <OrderTimeline
                order={vm.order}
                onBuyAgain={vm.buyAgain}
                reorderBusy={vm.busy.reorder}
                reorderError={vm.errors.order}
              />
            )}
            <Footer onStartFresh={vm.startFresh} />
          </div>
        </aside>
      </section>
    </main>
  );
}
