import { ErrorNote } from './ErrorNote';
import { PrintAreaReview } from './PrintAreaReview';
import { ReadinessChecks } from './ReadinessChecks';
import type { ReviewPanelProps } from './ReviewPanel.types';
import { formatMoney } from '../utils/currency';

export function ReviewPanel({
  product,
  design,
  quote,
  placementArtwork,
  selectedPlacementCodes,
  mugLayout,
  status,
  designOptions,
  actions,
}: ReviewPanelProps) {
  const hasDesignOptions =
    designOptions.canRevise || designOptions.hasHistory || designOptions.canGenerateAnother;
  // This is only the customer-facing button guard. Checkout authorization and fresh-artwork
  // validation remain server-side, so presentation state can never open commerce by itself.
  const checkoutBlocked =
    !quote ||
    status.quoteStale ||
    status.quoteExpired ||
    status.quoting ||
    status.mockupBusy ||
    (!status.mockupComplete && !status.mockupErrorPresent) ||
    !status.artworkReady;

  return (
    <div className="panel-stack review-panel">
      {status.settling ? (
        <div className="review-preparing" role="status" aria-live="polite">
          <span className="progress-orbit" aria-hidden="true" />
          <div>
            <b>Preparing the finished product view</b>
            <p>We’ll show checkout actions as soon as the preview and price are ready.</p>
          </div>
        </div>
      ) : (
        <div className={`ready-confirmation is-${design.readiness.status}`}>
          <span aria-hidden="true">{status.artworkReady ? '✓' : '!'}</span>
          <div>
            <b>{status.artworkReady ? 'Print ready' : 'Needs a quick review'}</b>
            <p>
              {status.artworkReady
                ? 'Your artwork is saved and ready to order.'
                : 'Review the checks below before checkout.'}
            </p>
          </div>
        </div>
      )}
      {!status.settling && quote ? (
        <div className="review-total">
          <span>Estimated total before tax</span>
          <strong>{formatMoney(quote.totalCents, quote.currency)}</strong>
        </div>
      ) : !status.settling ? (
        <p className="muted-copy">Price unavailable right now.</p>
      ) : null}
      {!status.settling && (
        <PrintAreaReview
          categorySlug={product.categorySlug}
          placements={product.placements}
          selectedPlacementCodes={selectedPlacementCodes}
          placementArtwork={placementArtwork}
          defaultArtwork={design}
          quote={quote}
          mugLayout={mugLayout}
          onEditAreas={actions.onEditAreas}
          onCustomizePlacement={actions.onCustomizePlacement}
          onReusePlacementArtwork={actions.onReusePlacementArtwork}
        />
      )}
      <ErrorNote error={status.quoteError} onRetry={actions.onRetryQuote} />
      {!status.settling && (
        <div className="review-actions">
          <button
            className="button button--primary button--wide"
            type="button"
            onClick={actions.onCheckout}
            disabled={checkoutBlocked}
          >
            Review and checkout
          </button>
          <button
            className="button button--secondary button--wide"
            type="button"
            onClick={actions.onMakeChanges}
          >
            Make changes
          </button>
          <button className="text-action" type="button" onClick={actions.onTryAnotherProduct}>
            Try it on another product
          </button>
        </div>
      )}
      {!status.settling && <ReadinessChecks draft={design} />}
      {!status.settling && hasDesignOptions && (
        <details
          className="refine-panel"
          open={designOptions.open}
          onToggle={(event) => actions.onOptionsToggle(event.currentTarget.open)}
        >
          <summary>More design options</summary>
          {designOptions.canRevise && (
            <label className="revision-field">
              <span>Create a variation</span>
              <textarea
                rows={3}
                value={designOptions.revision}
                onChange={(event) => actions.onRevisionChange(event.target.value)}
                placeholder="Make the main subject larger…"
              />
              <button
                className="button button--secondary"
                type="button"
                onClick={actions.onRevise}
                disabled={!designOptions.revision.trim() || status.revising}
              >
                Create variation
              </button>
            </label>
          )}
          {designOptions.hasHistory && (
            <button className="text-action" type="button" onClick={actions.onUndo}>
              Restore previous artwork
            </button>
          )}
          {designOptions.canGenerateAnother && (
            <button className="text-action" type="button" onClick={actions.onGenerateAnother}>
              Generate another design
            </button>
          )}
        </details>
      )}
    </div>
  );
}
