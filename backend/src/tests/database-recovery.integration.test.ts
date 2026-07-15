import assert from 'node:assert/strict';
import test from 'node:test';
import type Stripe from 'stripe';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
import {
  getAdminOrderDetail,
  getOrderSummary,
  handleStripeChargeRefunded,
  handleStripeCheckoutCompleted,
  handleStripeCheckoutExpired,
  listAdminOrderRecords,
  reviewAdminOrder,
} from '../services/order.service.js';

test(
  'PostgreSQL recovery keeps refunds monotonic and enriches refund-first payment facts',
  { skip: !env.databaseUrl },
  async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const paidOrderId = `integration-paid-${suffix}`;
    const failedOrderId = `integration-failed-${suffix}`;
    const expiryFirstOrderId = `integration-expiry-first-${suffix}`;
    const paymentFirstOrderId = `integration-payment-first-${suffix}`;
    const stripeSessionId = `cs_test_integration_${suffix}`;
    const paymentIntentId = `pi_test_integration_${suffix}`;
    const expiryFirstSessionId = `cs_test_expiry_first_${suffix}`;
    const paymentFirstSessionId = `cs_test_payment_first_${suffix}`;
    const auditTargets = [paidOrderId, failedOrderId, expiryFirstOrderId, paymentFirstOrderId];

    try {
      await prisma.order.createMany({
        data: [
          {
            id: paidOrderId,
            orderNumber: `OMS-INT-PAID-${suffix}`,
            status: 'PENDING_PAYMENT',
            stripeSessionId,
            stripePaymentIntentId: paymentIntentId,
            totalCents: 0,
            taxCents: 0,
            currency: 'USD',
          },
          {
            id: failedOrderId,
            orderNumber: `OMS-INT-FAILED-${suffix}`,
            status: 'FAILED',
            totalCents: 2500,
            taxCents: 0,
            currency: 'USD',
            fulfillmentStatus: 'failed',
            failureReason: '[printful_unavailable] Provider unavailable.',
          },
          {
            id: expiryFirstOrderId,
            orderNumber: `OMS-INT-EXPIRY-FIRST-${suffix}`,
            status: 'PENDING_PAYMENT',
            stripeSessionId: expiryFirstSessionId,
            totalCents: 2500,
            taxCents: 0,
            currency: 'USD',
          },
          {
            id: paymentFirstOrderId,
            orderNumber: `OMS-INT-PAYMENT-FIRST-${suffix}`,
            status: 'PENDING_PAYMENT',
            stripeSessionId: paymentFirstSessionId,
            totalCents: 2500,
            taxCents: 0,
            currency: 'USD',
          },
        ],
      });

      const fullRefund = {
        id: `ch_full_${suffix}`,
        amount: 2700,
        amount_refunded: 2700,
        refunded: true,
        payment_intent: paymentIntentId,
      } as unknown as Stripe.Charge;
      await handleStripeChargeRefunded(fullRefund, `evt_full_${suffix}`);

      const stalePartialRefund = {
        id: `ch_partial_${suffix}`,
        amount: 2700,
        amount_refunded: 500,
        refunded: false,
        payment_intent: paymentIntentId,
      } as unknown as Stripe.Charge;
      await handleStripeChargeRefunded(stalePartialRefund, `evt_partial_${suffix}`);

      const paidSession = {
        id: stripeSessionId,
        payment_status: 'paid',
        payment_intent: paymentIntentId,
        amount_total: 2700,
        total_details: { amount_tax: 200 },
        metadata: { kind: 'merch_order', orderId: paidOrderId },
        customer_details: {
          email: 'integration-buyer@example.com',
          name: 'Integration Buyer',
          address: {
            line1: '100 Test Way',
            line2: 'Apt 4B',
            city: 'Brooklyn',
            state: 'NY',
            country: 'US',
            postal_code: '11201',
          },
        },
      } as unknown as Stripe.Checkout.Session;
      await handleStripeCheckoutCompleted(paidSession, `evt_complete_${suffix}`);

      const persistedPaid = await prisma.order.findUniqueOrThrow({
        where: { id: paidOrderId },
      });
      assert.equal(persistedPaid.status, 'REFUNDED');
      assert.equal(persistedPaid.refundedCents, 2700);
      assert.equal(persistedPaid.totalCents, 2700);
      assert.equal(persistedPaid.taxCents, 200);
      assert.equal(persistedPaid.email, 'integration-buyer@example.com');
      assert.ok(persistedPaid.paidAt);
      assert.deepEqual(persistedPaid.recipient, {
        name: 'Integration Buyer',
        address1: '100 Test Way',
        address2: 'Apt 4B',
        city: 'Brooklyn',
        stateCode: 'NY',
        countryCode: 'US',
        zip: '11201',
        email: 'integration-buyer@example.com',
      });

      const refundEvents = await prisma.paymentEvent.findMany({
        where: { orderId: paidOrderId },
      });
      assert.deepEqual(
        Object.fromEntries(refundEvents.map((event) => [event.providerEventId, event.status])),
        {
          [`evt_full_${suffix}`]: 'refunded',
          [`evt_partial_${suffix}`]: 'ignored_stale_refund',
          [`evt_complete_${suffix}`]: 'processed_after_terminal_order',
        }
      );

      const checkoutSession = (orderId: string, sessionId: string, paymentIntent: string) =>
        ({
          id: sessionId,
          payment_status: 'paid',
          payment_intent: paymentIntent,
          amount_total: 2500,
          total_details: { amount_tax: 150 },
          metadata: { kind: 'merch_order', orderId },
          customer_details: { email: 'race-buyer@example.com' },
        }) as unknown as Stripe.Checkout.Session;

      const expiryFirstSession = checkoutSession(
        expiryFirstOrderId,
        expiryFirstSessionId,
        `pi_expiry_first_${suffix}`
      );
      await handleStripeCheckoutExpired(expiryFirstSession, `evt_expiry_first_${suffix}`);
      assert.equal(
        (await prisma.order.findUniqueOrThrow({ where: { id: expiryFirstOrderId } })).status,
        'CANCELLED'
      );
      await handleStripeCheckoutCompleted(expiryFirstSession, `evt_payment_after_expiry_${suffix}`);
      const recoveredPaidOrder = await prisma.order.findUniqueOrThrow({
        where: { id: expiryFirstOrderId },
      });
      assert.equal(recoveredPaidOrder.status, 'NEEDS_REVIEW');
      assert.equal(recoveredPaidOrder.totalCents, 2500);
      assert.ok(recoveredPaidOrder.paidAt);

      const paymentFirstSession = checkoutSession(
        paymentFirstOrderId,
        paymentFirstSessionId,
        `pi_payment_first_${suffix}`
      );
      await handleStripeCheckoutCompleted(paymentFirstSession, `evt_payment_first_${suffix}`);
      await handleStripeCheckoutExpired(paymentFirstSession, `evt_expiry_after_payment_${suffix}`);
      const expiryIgnoredOrder = await prisma.order.findUniqueOrThrow({
        where: { id: paymentFirstOrderId },
      });
      assert.equal(expiryIgnoredOrder.status, 'NEEDS_REVIEW');
      const expiryEvent = await prisma.paymentEvent.findUniqueOrThrow({
        where: {
          provider_providerEventId: {
            provider: 'stripe',
            providerEventId: `evt_expiry_after_payment_${suffix}`,
          },
        },
      });
      assert.equal(expiryEvent.status, 'ignored_nonpending_expiry');

      const restoredFailure = await getOrderSummary(failedOrderId);
      assert.equal(restoredFailure?.status, 'failed');
      assert.match(restoredFailure?.fulfillment.message ?? '', /Provider unavailable/);
      const failedOrders = await listAdminOrderRecords({ attention: 'failed' });
      assert.ok(failedOrders.some((order) => order.id === failedOrderId));

      await reviewAdminOrder(
        failedOrderId,
        'resolved',
        'Verified recovery integration behavior.',
        'integration-request'
      );
      const detail = await getAdminOrderDetail(failedOrderId);
      assert.equal(detail?.summary.operatorReviewStatus, 'resolved');
      assert.ok(detail?.auditTrail.some((entry) => entry.action === 'order.review_resolved'));
    } finally {
      await prisma.auditLog.deleteMany({ where: { target: { in: auditTargets } } });
      await prisma.order.deleteMany({ where: { id: { in: auditTargets } } });
    }
  }
);
