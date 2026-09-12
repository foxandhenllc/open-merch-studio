import { useEffect, useState } from 'react';
import type { AdminBinaryRequest, AdminRequest } from './admin.types';
import type { OperationDetail, OperationOrder } from './OrderOperations.types';
import './order-operations.css';

const label = (value: string) => value.replaceAll('_', ' ');
const money = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
export function OrderOperations({
  request,
  readFile,
}: {
  request: AdminRequest;
  readFile: AdminBinaryRequest;
}) {
  const [orders, setOrders] = useState<OperationOrder[] | null>(null);
  const [detail, setDetail] = useState<OperationDetail | null>(null);
  const [filter, setFilter] = useState('all');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [confirmRetry, setConfirmRetry] = useState(false);
  useEffect(() => {
    let active = true;
    setError('');
    void request<OperationOrder[]>('/order-operations')
      .then((result) => {
        if (active) setOrders(result);
      })
      .catch((failure) => {
        if (active)
          setError(failure instanceof Error ? failure.message : 'Orders could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, [request, attempt]);
  async function select(id: string) {
    setBusy(true);
    setError('');
    setNotice('');
    setDetail(null);
    setNote('');
    setConfirmRetry(false);
    try {
      setDetail(await request<OperationDetail>(`/order-operations/${id}`));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Order could not be opened.');
    } finally {
      setBusy(false);
    }
  }
  async function review(status: 'acknowledged' | 'resolved') {
    if (!detail) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await request<OperationDetail>(
        `/order-operations/${detail.summary.id}/review`,
        'POST',
        { status, note }
      );
      setDetail(result);
      setNote('');
      setOrders(
        (current) =>
          current?.map((order) => (order.id === result.summary.id ? result.summary : order)) ?? [
            result.summary,
          ]
      );
      setNotice(
        result.mode === 'fixture'
          ? 'Simulated review saved in this fixture server. It resets when the server restarts.'
          : 'Review recorded. Payment and production status are unchanged.'
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The review was not saved.');
    } finally {
      setBusy(false);
    }
  }
  async function download(assetId: string, code: string) {
    if (!detail) return;
    setBusy(true);
    setError('');
    try {
      const blob = await readFile(`/order-operations/${detail.summary.id}/prints/${assetId}`);
      const url = URL.createObjectURL(blob),
        anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `order-print-${code.replace(/[^a-z0-9-]/gi, '')}.png`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'The saved print could not be downloaded.'
      );
    } finally {
      setBusy(false);
    }
  }
  async function retry() {
    if (!detail || !confirmRetry) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await request<OperationDetail>(
        `/order-operations/${detail.summary.id}/retry`,
        'POST',
        { confirmed: true }
      );
      setDetail(result);
      setOrders(
        (current) =>
          current?.map((order) => (order.id === result.summary.id ? result.summary : order)) ?? [
            result.summary,
          ]
      );
      setNotice(
        'Draft preparation returned. Inspect the current provider draft before production.'
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Draft preparation did not complete.');
    } finally {
      setBusy(false);
      setConfirmRetry(false);
    }
  }
  const visible = orders?.filter(
    (order) =>
      filter === 'all' ||
      (order.reviewStatus !== 'resolved' &&
        ['failed', 'needs_review', 'paid'].includes(order.status))
  );
  return (
    <section className="order-operations" aria-label="Order operations">
      <header className="admin-page-heading">
        <span className="admin-eyebrow">Daily operations</span>
        <h1>Orders & review</h1>
        <p>Review the order, inspect its saved print files, and record what needs attention.</p>
      </header>
      <div className="operation-toolbar">
        <label>
          Show orders
          <select
            value={filter}
            disabled={busy}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">Recent orders</option>
            <option value="attention">Needs attention</option>
          </select>
        </label>
        <button type="button" disabled={busy} onClick={() => setAttempt((value) => value + 1)}>
          Refresh orders
        </button>
      </div>
      {error && (
        <p role="alert" className="admin-message admin-message--error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="admin-message">
          {notice}
        </p>
      )}
      {!orders && !error && <p aria-busy="true">Loading orders…</p>}
      {visible?.length === 0 && (
        <p>
          No orders in this view. Published collections and the studio feed orders into this
          workspace.
        </p>
      )}
      <div className="operation-list">
        {visible?.map((order) => (
          <button
            type="button"
            className={detail?.summary.id === order.id ? 'operation-row selected' : 'operation-row'}
            disabled={busy}
            key={order.id}
            onClick={() => void select(order.id)}
            aria-label={`Review order ${order.orderNumber}`}
          >
            <span>
              <strong>{order.orderNumber}</strong>
              <small>{new Date(order.createdAt).toLocaleDateString()}</small>
            </span>
            <span>
              {label(order.status)}
              <small>{label(order.reviewStatus)}</small>
            </span>
            <strong>{money(order.totalCents, order.currency)}</strong>
          </button>
        ))}
      </div>
      {detail && (
        <section
          className="operation-detail"
          aria-label={`Selected order ${detail.summary.orderNumber}`}
        >
          <h2>{detail.summary.orderNumber}</h2>
          {detail.mode === 'fixture' && (
            <p className="admin-message">
              Fixture order. Reviews are simulated; no payment, provider retry, or production occurs
              here.
            </p>
          )}
          <dl className="operation-facts">
            <div>
              <dt>Order</dt>
              <dd>{label(detail.summary.status)}</dd>
            </div>
            <div>
              <dt>Fulfillment</dt>
              <dd>{label(detail.summary.fulfillmentStatus)}</dd>
            </div>
            <div>
              <dt>Owner review</dt>
              <dd>{label(detail.summary.reviewStatus)}</dd>
            </div>
          </dl>
          <h3>Products</h3>
          <ul>
            {detail.items.map((item, index) => (
              <li key={index}>
                {item.quantity} × {item.title} · {item.variantName}
              </li>
            ))}
          </ul>
          <h3>Saved collection prints</h3>
          <p>
            {detail.prints.length
              ? 'These are the exact files saved with this order. Check every area against the product template and provider draft.'
              : 'This order uses the studio artwork workflow. Inspect the artwork in the provider draft before confirming production.'}
          </p>
          <div className="operation-prints">
            {detail.prints.map((file, index) => (
              <button
                type="button"
                key={`${file.assetId}-${index}`}
                disabled={busy}
                onClick={() => void download(file.assetId, file.placementCode)}
              >
                Download {file.placementCode} print · {file.title}
              </button>
            ))}
          </div>
          <h3>Record your review</h3>
          <p>
            Acknowledging or resolving an issue records an operating note. Production still requires
            confirmation in Printful.
          </p>
          <label className="operation-note">
            Review note
            <textarea
              value={note}
              maxLength={500}
              rows={3}
              disabled={busy}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What you checked, the issue, and who handles the next step. Exclude private customer or account details."
            />
          </label>
          <div className="operation-actions">
            <button type="button" disabled={busy} onClick={() => void review('acknowledged')}>
              Acknowledge review
            </button>
            <button
              type="button"
              disabled={busy || !note.trim()}
              onClick={() => void review('resolved')}
            >
              Mark issue resolved
            </button>
          </div>
          {detail.retryAvailable && (
            <div className="operation-retry">
              <p>
                Retry prepares a fulfillment draft and can contact the provider. Confirm the
                existing order has no draft awaiting review.
              </p>
              {confirmRetry ? (
                <div className="operation-actions">
                  <button type="button" disabled={busy} onClick={() => void retry()}>
                    Confirm draft retry
                  </button>
                  <button type="button" disabled={busy} onClick={() => setConfirmRetry(false)}>
                    Keep reviewing
                  </button>
                </div>
              ) : (
                <button type="button" disabled={busy} onClick={() => setConfirmRetry(true)}>
                  Retry draft preparation
                </button>
              )}
            </div>
          )}
          {detail.reviews.length > 0 && (
            <>
              <h3>Review history</h3>
              <ol className="operation-history">
                {detail.reviews.map((event, index) => (
                  <li key={index}>
                    <strong>{label(event.status)}</strong> ·{' '}
                    {new Date(event.createdAt).toLocaleString()}
                    {event.note && <p>{event.note}</p>}
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      )}
    </section>
  );
}
