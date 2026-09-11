import {
  artworkModes,
  collectionItemIssue,
  type CollectionCatalogProduct,
  type CollectionItem,
  type ArtworkLibrary,
  type CollectionArtwork,
} from '@open-merch-studio/collection-drafts';
import type { AdminRequest, AdminBinaryRequest } from './admin.types';
import { CollectionArtworkSlot } from './CollectionArtworkSlot';

export function initialProduct(product: CollectionCatalogProduct): CollectionItem {
  return {
    id: crypto.randomUUID(),
    title: product.title,
    productId: product.id,
    variantId: product.variants[0]?.id ?? '',
    placementCodes: [
      product.placements.find((area) => area.isDefault)?.code ?? product.placements[0]?.code,
    ].filter(Boolean),
    artworkMode: 'fixed',
    targetPriceCents: null,
    artwork: [],
  };
}

export function CollectionProductEditor({
  item,
  catalog,
  index,
  total,
  update,
  move,
  remove,
  library,
  request,
  readArtwork,
  uploaded,
  working,
}: {
  item: CollectionItem;
  catalog: CollectionCatalogProduct[];
  index: number;
  total: number;
  update: (item: CollectionItem) => void;
  move: (direction: -1 | 1) => void;
  remove: () => void;
  library: ArtworkLibrary | null;
  request: AdminRequest;
  readArtwork: AdminBinaryRequest;
  uploaded: (asset: CollectionArtwork) => void;
  working: (busy: boolean) => void;
}) {
  const product = catalog.find((candidate) => candidate.id === item.productId);
  const issue = collectionItemIssue(item, catalog);
  return (
    <section className="collection-product" aria-label={`Product ${index + 1}`}>
      <div className="collection-row-heading">
        <h3>
          <span>{String(index + 1).padStart(2, '0')}</span> {item.title || 'Untitled product'}
        </h3>
        <div className="collection-row-actions">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => move(-1)}
            aria-label={`Move product ${index + 1} up`}
          >
            ↑
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => move(1)}
            aria-label={`Move product ${index + 1} down`}
          >
            ↓
          </button>
          <button type="button" onClick={remove}>
            Remove product
          </button>
        </div>
      </div>
      {issue && (
        <p className="admin-message admin-message--error" role="alert">
          {issue}
        </p>
      )}
      <div className="admin-fields">
        <label>
          Product name
          <input
            value={item.title}
            maxLength={80}
            required
            onChange={(event) => update({ ...item, title: event.target.value })}
          />
        </label>
        <label>
          Catalog product
          <select
            value={item.productId}
            onChange={(event) => {
              const selected = catalog.find(({ id }) => id === event.target.value);
              if (selected)
                update({
                  ...initialProduct(selected),
                  id: item.id,
                  title: item.title === product?.title ? selected.title : item.title,
                  artworkMode: item.artworkMode,
                  targetPriceCents: item.targetPriceCents,
                });
            }}
          >
            {!product && <option value={item.productId}>Unavailable product</option>}
            {catalog.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Variant
          <select
            value={item.variantId}
            required
            onChange={(event) => update({ ...item, variantId: event.target.value })}
          >
            {!product?.variants.some(({ id }) => id === item.variantId) && (
              <option value={item.variantId}>Choose an available variant</option>
            )}
            {product?.variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Target price (USD, optional)
          <input
            type="number"
            min="0.01"
            max="10000"
            step="0.01"
            value={item.targetPriceCents === null ? '' : item.targetPriceCents / 100}
            onChange={(event) =>
              update({
                ...item,
                targetPriceCents:
                  event.target.value === '' ? null : Math.round(Number(event.target.value) * 100),
              })
            }
          />
          <small>Planning only. This does not set the checkout price.</small>
        </label>
      </div>
      <fieldset className="collection-areas">
        <legend>Print areas</legend>
        {product?.placements.map((area) => (
          <label key={area.code}>
            <input
              type="checkbox"
              checked={item.placementCodes.includes(area.code)}
              onChange={(event) =>
                update({
                  ...item,
                  placementCodes: event.target.checked
                    ? [...item.placementCodes, area.code]
                    : item.placementCodes.filter((code) => code !== area.code),
                  artwork: event.target.checked
                    ? item.artwork
                    : item.artwork?.filter((binding) => binding.placementCode !== area.code),
                })
              }
            />
            {area.displayName}
          </label>
        ))}
      </fieldset>
      {library &&
        item.placementCodes.map((code) => (
          <CollectionArtworkSlot
            key={code}
            label={product?.placements.find((area) => area.code === code)?.displayName ?? code}
            assetId={item.artwork?.find((binding) => binding.placementCode === code)?.assetId}
            library={library}
            request={request}
            readArtwork={readArtwork}
            uploaded={uploaded}
            working={working}
            assign={(assetId) =>
              update({
                ...item,
                artwork: [
                  ...(item.artwork ?? []).filter((binding) => binding.placementCode !== code),
                  ...(assetId ? [{ placementCode: code, assetId }] : []),
                ],
              })
            }
          />
        ))}
      <label className="collection-artwork-plan">
        Planned customer options
        <select
          value={item.artworkMode}
          onChange={(event) =>
            update({ ...item, artworkMode: event.target.value as CollectionItem['artworkMode'] })
          }
        >
          {artworkModes.map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.label}
            </option>
          ))}
        </select>
        <small>
          {artworkModes.find(({ id }) => id === item.artworkMode)?.hint} Applied to customers only
          after the future publication step.
        </small>
      </label>
    </section>
  );
}
