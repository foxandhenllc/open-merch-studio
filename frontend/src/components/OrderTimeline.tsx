import type { OrderSummary } from '@app-types/catalog';

const label = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export function OrderTimeline({ order }: { order: OrderSummary }) {
  return (
    <section className="order-confirmation">
      <span className="success-seal" aria-hidden="true">
        ✓
      </span>
      <span className="kicker">Order confirmed</span>
      <h2>{order.orderNumber}</h2>
      <p>{order.fulfillment.message}</p>
      {order.fulfillment.provider === 'fixture' && (
        <div className="fixture-disclaimer">
          <strong>Simulated order.</strong> No real charge or provider order was created.
        </div>
      )}
      <div className="order-timeline">
        {order.timeline.map((event) => (
          <div key={`${event.at}-${event.status}`}>
            <span className="status-pill status-pill--ok">{label(event.status)}</span>
            <p>{event.note}</p>
          </div>
        ))}
        <div className="is-pending">
          <span className="status-pill">Next</span>
          <p>
            {order.status === 'paid'
              ? 'Fulfillment validation is expected next.'
              : 'Provider status updates will appear here.'}
          </p>
        </div>
      </div>
    </section>
  );
}
