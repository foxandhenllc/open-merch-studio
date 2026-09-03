import type { CustomerOrderConfirmation } from '@app-types/catalog';

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);

const label = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const nextStep = (order: CustomerOrderConfirmation): string => {
  if (order.status === 'action_needed') {
    return 'Contact support with your order number so we can help with the next step.';
  }
  if (order.status === 'in_production') return 'We will update you when the order ships.';
  if (order.status === 'shipped') return 'Carrier delivery is the next expected update.';
  if (order.status === 'delivered') return 'Contact support if the delivered item has an issue.';
  if (order.status === 'cancelled' || order.status === 'refunded') {
    return 'Contact support if you have a question about this update.';
  }
  return 'We will review the product and artwork before production.';
};

const orderChrome = (status: CustomerOrderConfirmation['status']) => {
  if (status === 'action_needed') {
    return { kicker: 'Order needs attention', mark: '!', tone: 'is-warning' };
  }
  if (status === 'cancelled') {
    return { kicker: 'Order cancelled', mark: '!', tone: 'is-warning' };
  }
  if (status === 'refunded') {
    return { kicker: 'Refund recorded', mark: '!', tone: 'is-warning' };
  }
  if (status === 'awaiting_payment') {
    return { kicker: 'Payment pending', mark: '…', tone: 'is-neutral' };
  }
  return { kicker: 'Order confirmed', mark: '✓', tone: 'is-success' };
};

const timelineTone = (status: CustomerOrderConfirmation['status']) => {
  if (status === 'action_needed' || status === 'cancelled' || status === 'refunded') {
    return 'status-pill--bad';
  }
  if (status === 'awaiting_payment' || status === 'under_review') return 'status-pill--warn';
  return 'status-pill--ok';
};

export function OrderTimeline({ order }: { order: CustomerOrderConfirmation }) {
  const chrome = orderChrome(order.status);
  const shipments = order.shipments ?? [];
  return (
    <section className="order-confirmation">
      <span className={`success-seal ${chrome.tone}`} aria-hidden="true">
        {chrome.mark}
      </span>
      <span className="kicker">{chrome.kicker}</span>
      <h2>{order.orderNumber}</h2>
      <p>{order.message}</p>
      {order.fulfillment.provider === 'fixture' && (
        <div className="fixture-disclaimer">
          <strong>Simulated order.</strong> No real charge or provider order was created.
        </div>
      )}
      <div className="customer-order-summary" aria-label="Order summary">
        <div className="customer-order-items">
          {order.items.length ? (
            order.items.map((item) => (
              <div key={`${item.title}-${item.variantName}`}>
                <strong>{item.title}</strong>
                <span>
                  {item.variantName} · Qty {item.quantity}
                </span>
              </div>
            ))
          ) : (
            <div>
              <strong>Custom merchandise</strong>
              <span>Order details saved</span>
            </div>
          )}
        </div>
        <dl>
          <div>
            <dt>Tax</dt>
            <dd>{money(order.taxCents, order.currency)}</dd>
          </div>
          <div>
            <dt>Total charged</dt>
            <dd>{money(order.totalCents, order.currency)}</dd>
          </div>
          {order.refundedCents ? (
            <div>
              <dt>Refund recorded</dt>
              <dd>{money(order.refundedCents, order.currency)}</dd>
            </div>
          ) : null}
        </dl>
      </div>
      <div className="order-timeline">
        {order.timeline.map((event) => (
          <div key={`${event.at}-${event.status}`}>
            <span className={`status-pill ${timelineTone(event.status)}`}>
              {label(event.status)}
            </span>
            <p>{event.note}</p>
          </div>
        ))}
        <div className="is-pending">
          <span className="status-pill">Next</span>
          <p>{nextStep(order)}</p>
        </div>
      </div>
      {shipments.length > 0 ? (
        <div className="customer-order-shipments" aria-label="Shipment tracking">
          <h3>{shipments.length === 1 ? 'Shipment' : 'Shipments'}</h3>
          {shipments.map((shipment, index) => (
            <div key={`${shipment.trackingNumber ?? 'shipment'}-${index}`}>
              <div>
                <strong>
                  {shipment.reshipment ? 'Replacement shipment' : `Shipment ${index + 1}`}
                </strong>
                <span>{shipment.status === 'delivered' ? 'Delivered' : 'On the way'}</span>
                {shipment.trackingNumber ? <small>{shipment.trackingNumber}</small> : null}
              </div>
              {shipment.trackingUrl ? (
                <a href={shipment.trackingUrl} target="_blank" rel="noreferrer">
                  Track package
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      <p className="order-support-copy">
        Need help? Email <a href={`mailto:${order.support.email}`}>{order.support.email}</a> with
        your order number. Review the <a href="/returns">returns and cancellations policy</a> for
        timing and custom-product guidance.
      </p>
    </section>
  );
}
