import type { CustomerOrderConfirmation } from '../types/catalog.js';
import { merchantConfig } from '../generated/merchant-config.js';

export type CustomerEmailKind =
  | 'order_received'
  | 'shipment_sent'
  | 'shipment_delivered'
  | 'refund_update'
  | 'action_needed';

export type RenderedCustomerEmail = {
  subject: string;
  html: string;
  text: string;
};

export type RenderCustomerEmailOptions = {
  /** A customer-safe fragment handoff. Never pass an operator or provider URL here. */
  orderUrl?: string;
};

const cleanText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const escapeHtml = (value: string): string =>
  cleanText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const safeHttpUrl = (value?: string): string | undefined => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

const money = (cents: number, currency: string): string => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${cleanText(currency).toUpperCase()}`;
  }
};

const itemText = (order: CustomerOrderConfirmation): string[] =>
  order.items.map(
    (item) =>
      `${Math.max(1, item.quantity)} × ${cleanText(item.title)} — ${cleanText(item.variantName)}`
  );

const templateCopy = (
  kind: CustomerEmailKind,
  order: CustomerOrderConfirmation
): { subject: string; heading: string; paragraphs: string[] } => {
  const orderNumber = cleanText(order.orderNumber);
  switch (kind) {
    case 'order_received':
      return {
        subject: `We received order ${orderNumber}`,
        heading: 'Thanks for your order',
        paragraphs: [
          'Your payment was received. We are reviewing the product details and artwork before production.',
          'We will contact you if anything else is needed.',
        ],
      };
    case 'refund_update': {
      const refundAmount = order.refundedCents
        ? ` of ${money(order.refundedCents, order.currency)}`
        : '';
      return {
        subject: `Refund update for order ${orderNumber}`,
        heading: 'Refund update',
        paragraphs: [
          `A refund update${refundAmount} was recorded for your order.`,
          'The time it takes to appear depends on your payment method and financial institution.',
        ],
      };
    }
    case 'shipment_sent': {
      const latest = order.shipments.at(-1);
      const tracking = latest?.trackingUrl
        ? 'Use the secure tracking link below for the carrier’s latest update.'
        : 'The carrier may need a little time before tracking details appear.';
      return {
        subject: `Order ${orderNumber} has shipped`,
        heading: latest?.reshipment ? 'Your replacement has shipped' : 'Your order has shipped',
        paragraphs: [tracking],
      };
    }
    case 'shipment_delivered':
      return {
        subject: `Order ${orderNumber} was delivered`,
        heading: 'Your order was delivered',
        paragraphs: [
          'The carrier marked your shipment delivered.',
          'If anything is missing or damaged, contact support with your order number.',
        ],
      };
    case 'action_needed':
      return {
        subject: `Action needed for order ${orderNumber}`,
        heading: 'We need a little help with your order',
        paragraphs: [
          'Please contact support and include your order number so we can help with the next step.',
          'Never send payment card details, passwords, or account credentials by email.',
        ],
      };
  }
};

export function renderCustomerEmail(
  kind: CustomerEmailKind,
  order: CustomerOrderConfirmation,
  options: RenderCustomerEmailOptions = {}
): RenderedCustomerEmail {
  const copy = templateCopy(kind, order);
  const orderNumber = cleanText(order.orderNumber);
  const supportEmail = cleanText(order.support.email);
  const total = money(order.totalCents, order.currency);
  const tax = money(order.taxCents, order.currency);
  const items = itemText(order);
  const plainItems = items.length ? items.map((item) => `- ${item}`).join('\n') : '- Order item';
  const htmlItems = items.length
    ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>Order item</li>';
  const plainParagraphs = copy.paragraphs.join('\n\n');
  const htmlParagraphs = copy.paragraphs
    .map((paragraph) => `<p style="margin:0 0 16px">${escapeHtml(paragraph)}</p>`)
    .join('');
  const latestShipment = order.shipments.at(-1);
  const trackingUrl = safeHttpUrl(latestShipment?.trackingUrl);
  const trackingText = latestShipment?.trackingNumber
    ? `Tracking number: ${cleanText(latestShipment.trackingNumber)}`
    : undefined;
  const plainTracking = trackingUrl
    ? [trackingText, `Track shipment: ${trackingUrl}`].filter(Boolean).join('\n')
    : trackingText;
  const htmlTracking = trackingUrl
    ? `<p style="margin:0 0 20px"><a href="${escapeHtml(trackingUrl)}" style="display:inline-block;padding:12px 18px;background:#171814;color:#fff;text-decoration:none;border-radius:999px;font-weight:700">Track shipment</a>${trackingText ? `<br><span style="display:inline-block;margin-top:10px;color:#62645e">${escapeHtml(trackingText)}</span>` : ''}</p>`
    : trackingText
      ? `<p style="margin:0 0 20px;color:#62645e">${escapeHtml(trackingText)}</p>`
      : '';
  const orderUrl = kind === 'order_received' ? safeHttpUrl(options.orderUrl) : undefined;
  const plainOrderLink = orderUrl
    ? `View your order or buy it again:\n${orderUrl}\n\nKeep this private link. Anyone with it can view this order.`
    : undefined;
  const htmlOrderLink = orderUrl
    ? `<p style="margin:0 0 20px"><a href="${escapeHtml(orderUrl)}" style="display:inline-block;padding:12px 18px;background:#171814;color:#fff;text-decoration:none;border-radius:999px;font-weight:700">View order</a><br><span style="display:inline-block;margin-top:10px;color:#62645e;font-size:13px">You can review this order or use Buy again. Keep this private link.</span></p>`
    : '';

  return {
    subject: cleanText(copy.subject),
    text: [
      copy.heading,
      '',
      plainParagraphs,
      ...(plainOrderLink ? ['', plainOrderLink] : []),
      ...(plainTracking ? ['', plainTracking] : []),
      '',
      `Order: ${orderNumber}`,
      plainItems,
      `Total charged: ${total} (including ${tax} tax)`,
      '',
      `Questions? Contact ${supportEmail} and include order ${orderNumber}.`,
      '',
      merchantConfig.brand.displayName,
    ].join('\n'),
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f5f5f2;color:#171814;font-family:Arial,sans-serif">
    <main style="max-width:560px;margin:0 auto;padding:32px 20px">
      <div style="background:#ffffff;border:1px solid #deded8;border-radius:16px;padding:28px">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">${escapeHtml(merchantConfig.brand.displayName)}</p>
        <h1 style="margin:0 0 20px;font-size:26px;line-height:1.2">${escapeHtml(copy.heading)}</h1>
        ${htmlParagraphs}
        ${htmlOrderLink}
        ${htmlTracking}
        <div style="margin:24px 0;padding:18px;background:#f7f7f4;border-radius:12px">
          <p style="margin:0 0 10px"><strong>Order ${escapeHtml(orderNumber)}</strong></p>
          <ul style="margin:0 0 12px;padding-left:20px">${htmlItems}</ul>
          <p style="margin:0"><strong>Total charged:</strong> ${escapeHtml(total)} <span style="color:#62645e">(including ${escapeHtml(tax)} tax)</span></p>
        </div>
        <p style="margin:0;color:#50524c">Questions? Contact <a href="mailto:${escapeHtml(supportEmail)}" style="color:#3154d9">${escapeHtml(supportEmail)}</a> and include order ${escapeHtml(orderNumber)}.</p>
      </div>
    </main>
  </body>
</html>`,
  };
}
