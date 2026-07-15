import type { CustomerOrderConfirmation } from '../types/catalog.js';

export type CustomerEmailKind = 'order_received' | 'refund_update' | 'action_needed';

export type RenderedCustomerEmail = {
  subject: string;
  html: string;
  text: string;
};

const cleanText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const escapeHtml = (value: string): string =>
  cleanText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

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
  order: CustomerOrderConfirmation
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

  return {
    subject: cleanText(copy.subject),
    text: [
      copy.heading,
      '',
      plainParagraphs,
      '',
      `Order: ${orderNumber}`,
      plainItems,
      `Total charged: ${total} (including ${tax} tax)`,
      '',
      `Questions? Contact ${supportEmail} and include order ${orderNumber}.`,
      '',
      'Open Merch Studio',
    ].join('\n'),
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f5f5f2;color:#171814;font-family:Arial,sans-serif">
    <main style="max-width:560px;margin:0 auto;padding:32px 20px">
      <div style="background:#ffffff;border:1px solid #deded8;border-radius:16px;padding:28px">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Open Merch Studio</p>
        <h1 style="margin:0 0 20px;font-size:26px;line-height:1.2">${escapeHtml(copy.heading)}</h1>
        ${htmlParagraphs}
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
