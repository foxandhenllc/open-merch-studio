import { MAX_STUDIO_ITEM_QUANTITY } from '../studio-quote';
import { studioCartUnitCount } from '../studio-cart';
import { formatMoney } from '../utils/currency';
import { ErrorNote } from './ErrorNote';
import type { CartPanelProps } from './CartPanel.types';

export function CartPanel({
  items,
  quote,
  quoteStale,
  quoteExpired,
  quoting,
  error,
  onQuantityChange,
  onRemove,
  onRefreshQuote,
  onKeepShopping,
  onCheckout,
}: CartPanelProps) {
  const ready = Boolean(quote && !quoteStale && !quoteExpired && !quoting);
  const unitCount = studioCartUnitCount(items);

  if (!items.length) {
    return (
      <div className="panel-stack cart-panel cart-panel--empty">
        <p>Your cart is empty. Finish a design, then add it here to build a multi-item order.</p>
        <button className="button button--primary button--wide" type="button" onClick={onKeepShopping}>
          Make a product
        </button>
      </div>
    );
  }

  return (
    <div className="panel-stack cart-panel">
      <p className="muted-copy">
        {unitCount} {unitCount === 1 ? 'item' : 'items'} across {items.length}{' '}
        {items.length === 1 ? 'design' : 'designs'}
      </p>
      <div className="cart-lines">
        {items.map((item) => (
          <article className="cart-line" key={item.id}>
            <div>
              <strong>{item.productTitle}</strong>
              <span>{item.variantName}</span>
              <small>{item.line.placementCodes.join(' + ')}</small>
            </div>
            <label>
              <span>Quantity</span>
              <select
                aria-label={`Quantity for ${item.productTitle}`}
                value={item.line.quantity}
                onChange={(event) => onQuantityChange(item.id, Number(event.target.value))}
              >
                {Array.from({ length: MAX_STUDIO_ITEM_QUANTITY }, (_, index) => index + 1).map(
                  (value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  )
                )}
              </select>
            </label>
            <button className="text-action" type="button" onClick={() => onRemove(item.id)}>
              Remove
            </button>
          </article>
        ))}
      </div>
      <div className="cart-total" aria-live="polite">
        <span>Estimated total before tax</span>
        <strong>
          {ready && quote ? formatMoney(quote.totalCents, quote.currency) : 'Updating…'}
        </strong>
      </div>
      {quoteExpired && (
        <button className="text-action" type="button" onClick={onRefreshQuote}>
          Refresh expired estimate
        </button>
      )}
      <ErrorNote error={error} onRetry={onRefreshQuote} />
      <button
        className="button button--primary button--wide"
        type="button"
        disabled={!ready}
        onClick={onCheckout}
      >
        Review cart and checkout
      </button>
      <button className="button button--secondary button--wide" type="button" onClick={onKeepShopping}>
        Add another product
      </button>
    </div>
  );
}
