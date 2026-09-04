import assert from 'node:assert/strict';
import test from 'node:test';
import type { AdminSettings } from '../types/catalog.js';
import { assessLaunchReadiness } from '../services/launch-readiness.service.js';

const settings = (patch: Partial<AdminSettings> = {}): AdminSettings => ({
  studioPassPriceCents: 500,
  freeDraftLimit: 3,
  dailyAiBudgetCents: 1_000,
  perSessionBudgetCents: 100,
  liveOpenAiEnabled: false,
  liveStripeEnabled: false,
  livePrintfulEnabled: false,
  checkoutEnabled: false,
  fulfillmentEnabled: false,
  defaultMarginPercent: 30,
  minMarginCents: 500,
  ...patch,
});

test('launch readiness stays read-only and manual when provider configuration is present', () => {
  const configured = settings({
    liveOpenAiEnabled: true,
    liveStripeEnabled: true,
    livePrintfulEnabled: true,
    checkoutEnabled: true,
    fulfillmentEnabled: true,
  });
  const before = structuredClone(configured);
  const readiness = assessLaunchReadiness(configured);

  assert.deepEqual(configured, before);
  assert.equal(readiness.readyForPaidBeta, false);
  assert.equal(readiness.gates.find((gate) => gate.code === 'fixture-mode')?.status, 'pass');
  assert.equal(readiness.gates.find((gate) => gate.code === 'stripe-live')?.status, 'manual');
  assert.match(
    readiness.gates.find((gate) => gate.code === 'stripe-live')?.detail ?? '',
    /webhooks, tax, refunds/
  );
});
