import { useEffect, useMemo, useState } from 'react';
import type { QuoteBreakdown } from '@app-types/catalog';

const money = (cents: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);

export function QuoteLedger({
  quote,
  loading,
  stale,
  expired,
  onRefresh,
  onClose,
  embedded = false,
}: {
  quote: QuoteBreakdown | null;
  loading: boolean;
  stale: boolean;
  expired: boolean;
  onRefresh: () => void;
  onClose?: () => void;
  embedded?: boolean;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!quote || expired) return undefined;
    const timer = window.setInterval(() => tick((value) => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, [quote, expired]);
  const expiry = useMemo(() => {
    if (!quote) return '';
    const minutes = Math.max(
      0,
      Math.ceil((new Date(quote.expiresAt).getTime() - Date.now()) / 60_000)
    );
    return minutes > 60 ? `${Math.ceil(minutes / 60)}h` : `${minutes}m`;
  }, [quote, expired]);
  const showExpiry = Boolean(
    quote && (expired || new Date(quote.expiresAt).getTime() - Date.now() <= 60 * 60 * 1000)
  );
  return (
    <aside
      className={`ledger ${embedded ? 'ledger--embedded' : ''} ${stale || expired ? 'is-stale' : ''}`}
      aria-label="Price ledger"
      aria-busy={loading}
    >
      <div className="section-heading">
        <div>
          <span className="kicker">Secure checkout</span>
          <h2 id="price-ledger-title" tabIndex={-1}>
            Estimated total before tax
          </h2>
        </div>
        {onClose && (
          <button
            className="icon-button sheet-close"
            type="button"
            onClick={onClose}
            aria-label="Close price details"
          >
            ×
          </button>
        )}
      </div>
      {loading && (
        <div className="ledger-skeleton">
          <span className="skeleton" />
          <span className="skeleton" />
          <span className="skeleton" />
          <span className="skeleton" />
        </div>
      )}
      {!loading && !quote && (
        <div className="empty-block">
          <strong>No price yet.</strong>
          <p>Your itemized estimate is being prepared automatically. Nothing is charged here.</p>
        </div>
      )}
      {!loading && quote && (
        <>
          {(stale || expired) && (
            <div className={`ledger-alert ${expired ? 'is-expired' : ''}`}>
              <strong>{expired ? 'This quote expired.' : 'Your selection changed.'}</strong>
              <p>
                {expired
                  ? 'Refresh before checkout. The old total is shown for reference.'
                  : 'Update the price to match the current product setup.'}
              </p>
              <button className="text-action" type="button" onClick={onRefresh}>
                {expired ? 'Refresh quote' : 'Update price'}
              </button>
            </div>
          )}
          <div className="ledger-total">
            <span>Estimated subtotal</span>
            <strong>{money(quote.totalCents, quote.currency)}</strong>
          </div>
          <details className="price-details">
            <summary>See price details</summary>
            <div className="ledger-lines">
              {quote.costLines.map((line) => (
                <div key={line.code} className={`ledger-line is-${line.kind}`}>
                  <span>{line.label}</span>
                  <b>{money(line.amountCents, quote.currency)}</b>
                </div>
              ))}
            </div>
          </details>
          <p className="ledger-promise">
            Stripe calculates final tax securely from your US shipping address.
          </p>
          {showExpiry && (
            <p className="ledger-expiry">Quote {expired ? 'expired' : `held for ${expiry}`}.</p>
          )}
        </>
      )}
    </aside>
  );
}
