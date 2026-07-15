import { useEffect, useRef, useState } from 'react';
import type { CatalogProduct, CatalogVariant, DesignDraft, DesignMockup } from '@app-types/catalog';
import { ProductVisual } from './ProductVisual';
import { StatusNote } from './StatusNote';

const elapsedLabel = (startedAt: number | null) => {
  if (!startedAt) return '0:00';
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export function GenerationStage({
  product,
  variant,
  draft,
  mockup,
  generating,
  mockupBusy,
  phase,
  startedAt,
  stale,
  onCancel,
  onRetryMockup,
  onContinueWithoutMockup,
  error,
  orientation,
  activeViewIndex,
  onViewIndexChange,
}: {
  product: CatalogProduct | null;
  variant: CatalogVariant | null;
  draft: DesignDraft | null;
  mockup: DesignMockup | null;
  generating: boolean;
  mockupBusy: boolean;
  phase: string;
  startedAt: number | null;
  stale: boolean;
  onCancel: () => void;
  onRetryMockup: () => void;
  onContinueWithoutMockup: () => void;
  error?: { title: string; message: string; recovery: string };
  orientation?: 'portrait' | 'landscape' | 'square';
  activeViewIndex: number;
  onViewIndexChange: (index: number) => void;
}) {
  const [, tick] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const progressSurface = useRef<HTMLDivElement | null>(null);
  const operationActive = generating || mockupBusy;
  useEffect(() => {
    if (!generating && !mockupBusy) return undefined;
    const timer = window.setInterval(() => tick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [generating, mockupBusy]);
  useEffect(() => setImageFailed(false), [draft?.imageUrl, mockup?.imageUrl]);
  useEffect(() => {
    if (!operationActive) return undefined;
    const frame = window.requestAnimationFrame(() => {
      progressSurface.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [operationActive]);

  if (!product || !variant) {
    return (
      <section className="stage stage--empty">
        <div className="stage-empty-mark" aria-hidden="true">
          01
        </div>
        <span className="kicker">First run</span>
        <h2>Make one thing you’d actually wear.</h2>
        <p>
          Choose a product from the curated catalog. Then describe the artwork you want to make.
        </p>
      </section>
    );
  }

  const hasProviderMockup = !generating && !mockupBusy && mockup?.status === 'complete';
  const artworkUrl = generating ? undefined : draft?.imageUrl;
  const mockupViews =
    mockup?.views?.length && hasProviderMockup
      ? mockup.views
      : hasProviderMockup
        ? [{ label: 'Product view', imageUrl: mockup.imageUrl }]
        : [];
  const activeView = mockupViews[activeViewIndex] ?? mockupViews[0];
  const renderViewButton = (view: { label: string; imageUrl: string }, index: number) => (
    <button
      key={`${view.imageUrl}-${index}`}
      type="button"
      className={index === activeViewIndex ? 'is-active' : ''}
      aria-label={`Show ${view.label}`}
      aria-pressed={index === activeViewIndex}
      onClick={() => {
        setImageFailed(false);
        onViewIndexChange(index);
      }}
    >
      <img src={view.imageUrl} alt="" />
      <span>{view.label}</span>
    </button>
  );
  return (
    <section
      className={`stage ${stale ? 'is-stale' : ''}`}
      aria-label="Design preview"
    >
      <div className="stage__meta">
        <span>{product.title}</span>
        <b>
          {variant.name}
          {orientation ? ` · ${orientation}` : ''}
        </b>
        {stale && <span className="status-pill status-pill--warn">Preview stale</span>}
      </div>
      {activeView && !imageFailed ? (
        <div className="mockup-viewer">
          <img
            className="mockup-preview"
            src={activeView.imageUrl}
            alt={`${activeView.label} mockup for ${product.title}`}
            onError={() => setImageFailed(true)}
          />
          {mockupViews.length > 1 && (
            <>
              <div
                className="mockup-viewer__rail mockup-viewer__rail--desktop"
                role="group"
                aria-label="Product mockup views"
              >
                {mockupViews.slice(0, 3).map(renderViewButton)}
                {mockupViews.length > 3 && (
                  <details className="more-views">
                    <summary>More views</summary>
                    <div>
                      {mockupViews.slice(3).map((view, index) => renderViewButton(view, index + 3))}
                    </div>
                  </details>
                )}
              </div>
              <div
                className="mockup-viewer__rail mockup-viewer__rail--mobile"
                role="group"
                aria-label="Product mockup views"
              >
                {mockupViews.map(renderViewButton)}
              </div>
            </>
          )}
        </div>
      ) : artworkUrl && !imageFailed ? (
        <div className={`artwork-preparation ${mockupBusy ? 'is-building-mockup' : ''}`}>
          <span className="kicker">Artwork ready</span>
          <img src={artworkUrl} alt={`Generated artwork for ${product.title}`} />
          <p>{mockupBusy ? 'Preparing the product mockup…' : 'Artwork is ready for a product.'}</p>
        </div>
      ) : (
        <ProductVisual
          category={product.categorySlug}
          title={product.title}
          color={variant.colorCode}
          imageUrl={
            product.categorySlug === 'wall-art'
              ? undefined
              : variant.imageUrl || product.thumbnailUrl
          }
          orientation={orientation}
          size="stage"
        />
      )}
      {imageFailed && (
        <div className="image-fallback">
          <strong>Preview image unavailable</strong>
          <span>Your draft is safe. Retry the preview when your connection returns.</span>
        </div>
      )}
      {(generating || mockupBusy) && (
        <div
          ref={progressSurface}
          className="stage-progress"
          role="group"
          aria-labelledby="generation-progress-status"
          tabIndex={-1}
        >
          <span className="progress-orbit" aria-hidden="true" />
          <div>
            <strong
              id="generation-progress-status"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {generating
                ? phase
                : mockup?.status === 'queued'
                  ? 'Mockup queued'
                  : 'Building product preview'}
            </strong>
            <p>
              {generating
                ? 'Usually 20–60 seconds.'
                : 'Provider previews can take up to 90 seconds.'}
            </p>
            <span className="mono">Elapsed {elapsedLabel(startedAt)}</span>
          </div>
          {generating && (
            <button
              className="button button--secondary"
              type="button"
              aria-label="Cancel generation"
              onClick={onCancel}
            >
              Cancel
            </button>
          )}
        </div>
      )}
      {(mockup?.status === 'failed' || error) && (
        <div className="stage__status">
          <StatusNote tone="error" title={error?.title ?? 'The product preview failed'}>
            <p>
              {error?.message ?? mockup?.errorMessage ?? 'Printful could not build this mockup.'}
            </p>
            <p>
              {error?.recovery ??
                'Your artwork is unchanged. Retry the mockup, or continue to price without it.'}
            </p>
          </StatusNote>
          <div className="stage__status-actions">
            <button className="button button--secondary" type="button" onClick={onRetryMockup}>
              Retry mockup
            </button>
            <button className="text-action" type="button" onClick={onContinueWithoutMockup}>
              Continue without mockup
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
