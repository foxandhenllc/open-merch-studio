import { useEffect, useState } from 'react';
import type { QuoteBreakdown } from '../types/catalog';
export function CollectionPrintPreviews({
  quote,
  sessionId,
  ready,
}: {
  quote: QuoteBreakdown;
  sessionId: string;
  ready: (value: boolean) => void;
}) {
  const [images, setImages] = useState<Array<{ url: string; label: string }>>([]);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const urls: string[] = [];
    ready(false);
    setImages([]);
    setError('');
    const files = quote.items.flatMap((item) =>
      (item.placements ?? []).map((area) => ({
        id: area.designAssetId,
        label: `${item.title} · ${area.code}`,
      }))
    );
    void Promise.all(
      files.map(async (file) => {
        const response = await fetch(`/api/collections/quotes/${quote.id}/preview`, {
          method: 'POST',
          credentials: 'omit',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, assetId: file.id }),
        });
        if (!response.ok)
          throw new Error('The saved print preview could not be loaded. Retry before checkout.');
        const blob = await response.blob();
        if (!active) return null;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        return { url, label: file.label };
      })
    )
      .then((values) => {
        if (!active) return;
        if (!files.length || values.some((value) => !value))
          throw new Error('Print previews are unavailable. Review the order again.');
        setImages(values as Array<{ url: string; label: string }>);
        ready(true);
      })
      .catch((failure: Error) => {
        if (active) setError(failure.message);
      });
    return () => {
      active = false;
      ready(false);
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [quote, sessionId, ready, attempt]);
  return (
    <section aria-label="Saved print previews">
      <h3>Review your print files</h3>
      <p className="collection-purchase-note">
        These previews come from the exact files saved with this estimate. Artwork placement is
        shown on the supplier’s flat print area; this is not a photograph of the finished product.
      </p>
      {error ? (
        <p role="alert">
          {error}{' '}
          <button type="button" onClick={() => setAttempt(attempt + 1)}>
            Retry print previews
          </button>
        </p>
      ) : !images.length ? (
        <p role="status">Loading saved print previews…</p>
      ) : (
        <div className="collection-print-previews">
          {images.map((image) => (
            <figure key={image.label}>
              <img src={image.url} alt={image.label} />
              <figcaption>{image.label}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
