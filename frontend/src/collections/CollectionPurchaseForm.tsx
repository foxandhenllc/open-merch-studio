import { CollectionArtworkInput } from './CollectionArtworkInput';
import { CollectionPrintPreviews } from './CollectionPrintPreviews';
import { useEffect, useState } from 'react';
import type { PublicCollection } from '@open-merch-studio/collection-drafts';
import type { QuoteBreakdown, CheckoutSession } from '../types/catalog';
import { merchantConfig } from '../generated/merchant-config';
import { saveCustomerOrderAccess } from '../order-access';

import type { Cart } from './CollectionPurchaseForm.types';
const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
function session() {
  const key = 'oms-collection-session-v1';
  try {
    const value = localStorage.getItem(key);
    if (value && /^[a-f0-9-]{36}$/.test(value)) return value;
  } catch {
    /* The current tab can still check out. */
  }
  const value = crypto.randomUUID();
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Storage can be unavailable. */
  }
  return value;
}
async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || !data.success)
    throw Object.assign(
      new Error(data.error || 'The request could not be completed. Please retry.'),
      { code: data.errorCode }
    );
  return data.data;
}
export function CollectionPurchaseForm({ collection }: { collection: PublicCollection }) {
  const key = `oms-collection-cart:${collection.id}:${collection.version}:${collection.layoutRevision}`;
  const [sessionId] = useState(session);
  const [cart, setCart] = useState<Cart>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? 'null') as Cart | null;
      if (parsed && /^[a-f0-9-]{36}$/.test(parsed.requestId))
        return {
          requestId: parsed.requestId,
          artwork: Object.fromEntries(
            collection.products
              .filter(
                (item) =>
                  item.artworkMode !== 'fixed' &&
                  typeof parsed.artwork?.[item.id] === 'string' &&
                  /^[A-Za-z0-9_-]{1,100}$/.test(parsed.artwork[item.id])
              )
              .map((item) => [item.id, parsed.artwork![item.id]])
          ),
          quantities: Object.fromEntries(
            collection.products.map((item) => [
              item.id,
              Number.isInteger(parsed.quantities?.[item.id]) &&
              parsed.quantities[item.id] >= 0 &&
              parsed.quantities[item.id] <= 25
                ? parsed.quantities[item.id]
                : 0,
            ])
          ),
        };
    } catch {
      /* Begin an empty cart when a prior value cannot be read. */
    }
    return { quantities: {}, requestId: crypto.randomUUID() };
  });
  const [quote, setQuote] = useState<QuoteBreakdown | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [artworkBusy, setArtworkBusy] = useState(false);
  const [printsReady, setPrintsReady] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(cart));
    } catch {
      /* Keep the current selection usable. */
    }
  }, [cart, key]);
  async function review() {
    setBusy(true);
    setError('');
    setQuote(null);
    setAccepted(false);
    try {
      const items = collection.products
        .filter((item) => cart.quantities[item.id] > 0)
        .map((item) => ({
          itemId: item.id,
          quantity: cart.quantities[item.id],
          ...(item.artworkMode !== 'fixed' && cart.artwork?.[item.id]
            ? { designAssetId: cart.artwork[item.id] }
            : {}),
        }));
      if (!items.length) throw new Error('Choose a quantity for at least one product.');
      const result = await post<QuoteBreakdown>(`/api/collections/${collection.id}/quotes`, {
        sessionId,
        requestId: cart.requestId,
        version: collection.version,
        layoutRevision: collection.layoutRevision,
        items,
      });
      setQuote(result);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The order estimate is unavailable.');
      if (
        failure instanceof Error &&
        'code' in failure &&
        failure.code === 'collection_quote_expired'
      )
        setCart((current) => ({ ...current, requestId: crypto.randomUUID() }));
    } finally {
      setBusy(false);
    }
  }
  async function checkout() {
    if (!quote || !accepted || !printsReady || artworkBusy) return;
    setBusy(true);
    setError('');
    try {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new Error('Enter a valid email for your receipt.');
      const result = await post<CheckoutSession>('/api/checkout/sessions', {
        quoteId: quote.id,
        sessionId,
        email,
        policyAccepted: true,
        policyVersion: merchantConfig.policies.approvedVersion,
      });
      if (result.status === 'blocked') throw new Error(result.message || 'Checkout is paused.');
      if (result.status === 'open' && result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      if (result.status === 'paid' && result.orderId) {
        saveCustomerOrderAccess(result.orderAccess);
        window.location.assign(`/order/${encodeURIComponent(result.orderId)}`);
        return;
      }
      throw new Error('Checkout is still processing. Do not submit payment again.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Checkout could not be opened.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="collection-purchase" aria-label={`Order from ${collection.title}`}>
      <h2>Choose your pieces</h2>
      {collection.commerceMode === 'fixture' && (
        <p className="collection-fixture-notice">
          Fixture store: checkout is simulated. No payment or shipment is created.
        </p>
      )}
      <fieldset disabled={busy || artworkBusy}>
        <legend>Products and quantities</legend>
        {collection.products.map((item) => (
          <div key={item.id}>
            <label className="collection-purchase-line">
              <span>
                {item.title}
                <small>
                  {item.variantName} · {money(item.plannedPriceCents ?? 0)} each
                </small>
              </span>
              <input
                aria-label={`Quantity · ${item.title}`}
                type="number"
                min="0"
                max="25"
                step="1"
                value={cart.quantities[item.id] ?? 0}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (!Number.isInteger(value) || value < 0 || value > 25) return;
                  setCart({
                    ...cart,
                    quantities: { ...cart.quantities, [item.id]: value },
                    requestId: crypto.randomUUID(),
                  });
                  setQuote(null);
                  setAccepted(false);
                  setError('');
                }}
              />
            </label>
            {item.artworkMode !== 'fixed' && (cart.quantities[item.id] ?? 0) > 0 && (
              <CollectionArtworkInput
                collection={collection}
                item={item}
                sessionId={sessionId}
                assetId={cart.artwork?.[item.id]}
                working={setArtworkBusy}
                changed={(assetId) => {
                  setCart((current) => ({
                    ...current,
                    artwork: { ...current.artwork, [item.id]: assetId ?? '' },
                    requestId: crypto.randomUUID(),
                  }));
                  setQuote(null);
                  setAccepted(false);
                  setPrintsReady(false);
                }}
              />
            )}
          </div>
        ))}
        <button type="button" onClick={() => void review()}>
          {busy && !quote ? 'Preparing order estimate…' : 'Review order'}
        </button>
      </fieldset>
      {quote && (
        <div className="collection-order-summary" aria-live="polite">
          <h3>Your order estimate</h3>
          <CollectionPrintPreviews quote={quote} sessionId={sessionId} ready={setPrintsReady} />
          {quote.costLines.map((line) => (
            <p key={line.code}>
              <span>{line.label}</span>
              <strong>{money(line.amountCents)}</strong>
            </p>
          ))}
          <p>
            <span>Estimated total before tax</span>
            <strong>{money(quote.totalCents)}</strong>
          </p>
          <p className="collection-purchase-note">
            Tax is calculated at checkout. Shipping is estimated. This quote lasts 30 minutes;
            changing quantities requires a new estimate.
          </p>
          <label>
            Email for your receipt
            <input
              type="email"
              autoComplete="email"
              value={email}
              disabled={busy}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="collection-purchase-consent">
            <input
              type="checkbox"
              checked={accepted}
              disabled={busy}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            <span>
              I reviewed my saved print previews and agree to the{' '}
              <a href="/privacy" target="_blank" rel="noreferrer">
                Privacy policy
              </a>
              ,{' '}
              <a href="/content-policy" target="_blank" rel="noreferrer">
                Content policy
              </a>
              ,{' '}
              <a href="/terms" target="_blank" rel="noreferrer">
                Terms
              </a>{' '}
              and{' '}
              <a href="/returns" target="_blank" rel="noreferrer">
                Return policy
              </a>
              , and have reviewed the{' '}
              <a href="/shipping" target="_blank" rel="noreferrer">
                Shipping policy
              </a>
              .
            </span>
          </label>
          <button
            type="button"
            disabled={busy || artworkBusy || !accepted || !printsReady}
            onClick={() => void checkout()}
          >
            {busy
              ? 'Opening checkout…'
              : collection.commerceMode === 'fixture'
                ? 'Complete simulated checkout'
                : 'Continue to secure checkout'}
          </button>
        </div>
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload collection
          </button>
        </div>
      )}
    </section>
  );
}
