import { useEffect, useState } from 'react';
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
}) {
  const [, tick] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    if (!generating && !mockupBusy) return undefined;
    const timer = window.setInterval(() => tick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [generating, mockupBusy]);
  useEffect(() => setImageFailed(false), [draft?.imageUrl, mockup?.imageUrl]);

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

  const imageUrl = mockup?.imageUrl || draft?.imageUrl;
  return (
    <section
      className={`stage ${stale ? 'is-stale' : ''}`}
      aria-label="Design preview"
      aria-busy={generating || mockupBusy}
    >
      <div className="stage__meta">
        <span>{product.title}</span>
        <b>{variant.name}</b>
        {stale && <span className="status-pill status-pill--warn">Preview stale</span>}
      </div>
      <ProductVisual
        category={product.categorySlug}
        title={product.title}
        color={variant.colorCode}
        imageUrl={product.thumbnailUrl || variant.imageUrl}
        size="stage"
      />
      {imageUrl && !imageFailed && (
        <img
          className="artwork-preview"
          src={imageUrl}
          alt={`Generated artwork for ${product.title}`}
          onError={() => setImageFailed(true)}
        />
      )}
      {imageFailed && (
        <div className="image-fallback">
          <strong>Preview image unavailable</strong>
          <span>Your draft is safe. Retry the preview when your connection returns.</span>
        </div>
      )}
      {!draft && !generating && (
        <div className="stage__hint">
          <span aria-hidden="true">↗</span>
          <p>Your artwork will appear here. Start with the design prompt beside the preview.</p>
        </div>
      )}
      {(generating || mockupBusy) && (
        <div className="stage-progress">
          <span className="progress-orbit" aria-hidden="true" />
          <div>
            <strong>
              {generating
                ? phase
                : mockup?.status === 'queued'
                  ? 'Mockup queued'
                  : 'Building product preview'}
            </strong>
            <p>
              {generating
                ? 'Usually 20–60 seconds. You can cancel without using a draft credit.'
                : 'Provider previews can take up to 90 seconds.'}
            </p>
            <span className="mono">Elapsed {elapsedLabel(startedAt)}</span>
          </div>
          {generating && (
            <button className="button button--secondary" type="button" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      )}
      {mockup?.status === 'failed' && (
        <div className="stage__status">
          <StatusNote tone="error" title="The product preview failed">
            <p>
              Your artwork is unchanged. Retry the provider preview, or continue to price without
              it.
            </p>
          </StatusNote>
          <div className="stage__status-actions">
            <button className="button button--secondary" type="button" onClick={onRetryMockup}>
              Retry preview
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
