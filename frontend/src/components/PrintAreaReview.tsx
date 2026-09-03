import type { PrintAreaReviewProps } from './PrintAreaReview.types';
import { formatMoney } from '../utils/currency';

export function PrintAreaReview({
  categorySlug,
  placements,
  selectedPlacementCodes,
  placementArtwork,
  defaultArtwork,
  quote,
  mugLayout,
  onEditAreas,
  onCustomizePlacement,
  onReusePlacementArtwork,
}: PrintAreaReviewProps) {
  const selectedPlacements = placements.filter((placement) =>
    selectedPlacementCodes.includes(placement.code)
  );
  const primaryPlacement = selectedPlacements[0];
  const primaryArtwork = primaryPlacement
    ? (placementArtwork[primaryPlacement.code] ?? defaultArtwork)
    : defaultArtwork;
  const hasSeparatePlacementArtwork = selectedPlacements.slice(1).some((placement) => {
    const artworkId = (placementArtwork[placement.code] ?? defaultArtwork).id;
    return Boolean(artworkId && primaryArtwork.id && artworkId !== primaryArtwork.id);
  });
  const quoteItem = quote?.items[0];

  if (!selectedPlacements.length) return null;

  return (
    <section className="print-area-review" aria-labelledby="print-area-review-title">
      <header>
        <div>
          <b id="print-area-review-title">
            {categorySlug === 'drinkware' ? 'Mug artwork' : 'Print areas'}
          </b>
          <small>
            {quote?.placementCostCents
              ? `${formatMoney(quote.placementCostCents, quote.currency)} for additional printing`
              : categorySlug === 'drinkware'
                ? 'One wraparound print area'
                : 'First print included'}
          </small>
        </div>
        <button className="text-action" type="button" onClick={onEditAreas}>
          Edit areas
        </button>
      </header>
      <div className="print-area-list">
        {selectedPlacements.map((placement, index) => {
          const assignedArtwork = placementArtwork[placement.code] ?? defaultArtwork;
          const usesPrimaryArtwork = Boolean(
            assignedArtwork.id && assignedArtwork.id === primaryArtwork.id
          );
          const quotePlacement = quoteItem?.placements.find(
            (item) => item.code === placement.code
          );

          return (
            <article key={placement.code} className="print-area-row">
              <img src={assignedArtwork.imageUrl} alt="" />
              <div>
                <b>{placement.displayName}</b>
                <small>
                  {index === 0
                    ? 'First print included'
                    : quotePlacement?.additionalCostCents
                      ? `+${formatMoney(quotePlacement.additionalCostCents, quote?.currency)} production`
                      : 'Additional print charge'}
                  {index > 0 && usesPrimaryArtwork
                    ? ` · Same artwork as ${primaryPlacement?.displayName}`
                    : index > 0
                      ? ' · Different artwork'
                      : ''}
                </small>
              </div>
              <div className="print-area-row__actions">
                <button
                  className="text-action"
                  type="button"
                  onClick={() => onCustomizePlacement(placement.code)}
                >
                  {index > 0 && usesPrimaryArtwork
                    ? 'Create different artwork'
                    : 'Replace artwork'}
                </button>
                {index > 0 && !usesPrimaryArtwork && primaryPlacement && (
                  <button
                    className="text-action"
                    type="button"
                    onClick={() =>
                      onReusePlacementArtwork(primaryPlacement.code, placement.code)
                    }
                  >
                    Use same as {primaryPlacement.displayName}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {hasSeparatePlacementArtwork && (
        <p className="separate-artwork-note">
          Different artwork can add design work. Reuse the front artwork to remove any duplicate
          design charge; the additional print charge still applies.
        </p>
      )}
      {categorySlug === 'drinkware' && (
        <p className="mug-layout-summary">
          Position:{' '}
          <b>
            {mugLayout === 'left'
              ? 'Shifted left'
              : mugLayout === 'right'
                ? 'Shifted right'
                : 'Centered'}
          </b>
        </p>
      )}
    </section>
  );
}
