import { useEffect, useState } from 'react';
import { OrderTimeline } from '../components/OrderTimeline';
import { OpenSourceAttribution } from '../components/OpenSourceAttribution';
import { readCustomerOrderAccess } from '../order-access';
import { merchantConfig } from '../generated/merchant-config';
import type { CustomerOrderConfirmation } from '../types/catalog';
import './customer-order.css';

export function CustomerOrderPage({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<CustomerOrderConfirmation | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const token = readCustomerOrderAccess(orderId);
    document.title = `Your order | ${merchantConfig.brand.displayName}`;
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    robots.content = 'noindex, nofollow, noarchive';
    setError('');
    if (!token) {
      setError(
        'This browser does not have access to that order. Use your saved order link or contact support.'
      );
      return;
    }
    void fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            'Your order could not be opened. Retry or contact support with your order number.'
          );
        const body = await response.json();
        if (!body.success) throw new Error('Your order is temporarily unavailable.');
        if (!controller.signal.aborted) setOrder(body.data);
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : 'Your order is unavailable.');
      });
    return () => controller.abort();
  }, [orderId, attempt]);
  return (
    <main className="customer-order-page">
      <header>
        <a href="/">{merchantConfig.brand.displayName}</a>
        <a href="/collections">Collections</a>
      </header>
      <h1>Your order</h1>
      {order ? (
        <OrderTimeline
          order={order}
          onBuyAgain={() => window.location.assign('/')}
          reorderBusy={false}
        />
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setAttempt((value) => value + 1)}>
            Retry order lookup
          </button>
          <p>
            <a href="/support">Contact support</a>
          </p>
        </div>
      ) : (
        <p aria-busy="true">Opening your order…</p>
      )}
      <footer>
        <OpenSourceAttribution />
      </footer>
    </main>
  );
}
