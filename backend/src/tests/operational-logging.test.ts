import assert from 'node:assert/strict';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { errorHandler, HttpError, requestContext } from '../middleware.js';
import {
  buildOperationalRecord,
  redactRequestUrl,
  setOperationalSink,
  type OperationalContext,
  type OperationalRecord,
} from '../utils/operational-logger.js';

test('operational records whitelist identifiers and discard sensitive extra fields', () => {
  const unsafeInput = {
    requestId: 'request-1',
    orderId: 'order-1',
    stripeSessionId: 'cs_live_private_bearer_value',
    route: '/api/checkout/sessions/cs_live_private_bearer_value/order',
    outcome: 'failed',
    email: 'buyer@example.com',
    address: '100 Private Street',
    artworkUrl: 'https://example.com/private-art.png',
    apiKey: 'secret-key',
    payload: { private: true },
  } as unknown as OperationalContext;
  const record = buildOperationalRecord(
    'error',
    'printful draft failed',
    unsafeInput,
    new Date('2026-07-14T12:00:00.000Z')
  );
  const serialized = JSON.stringify(record);
  assert.equal(record.event, 'printful_draft_failed');
  assert.equal(record.orderId, 'order-1');
  assert.match(record.stripeSessionId ?? '', /^sha256:[a-f0-9]{24}$/);
  assert.equal(record.route, '/api/checkout/sessions/_redacted_/order');
  assert.doesNotMatch(
    serialized,
    /buyer@example\.com|Private Street|private-art|secret-key|payload|cs_live_private/
  );
});

test('request logs redact Checkout Session bearer IDs', () => {
  const redacted = redactRequestUrl(
    '/api/checkout/sessions/cs_live_private_bearer_value/order?poll=1'
  );
  assert.equal(redacted, '/api/checkout/sessions/[redacted]/order?poll=1');
  assert.doesNotMatch(redacted, /cs_live_private/);
});

test('request IDs are returned and unexpected production errors stay private', () => {
  const originalNodeEnv = env.nodeEnv;
  const records: OperationalRecord[] = [];
  setOperationalSink((record) => records.push(record));
  env.nodeEnv = 'production';
  const headers = new Map<string, string>();
  let responseStatus = 0;
  let responseBody: Record<string, unknown> = {};
  const response = {
    locals: {},
    setHeader: (name: string, value: string) => headers.set(name.toLowerCase(), value),
    status(code: number) {
      responseStatus = code;
      return this;
    },
    json(body: Record<string, unknown>) {
      responseBody = body;
      return this;
    },
  } as unknown as Response;
  const request = { path: '/api/private-test', method: 'POST' } as Request;
  const next = (() => undefined) as NextFunction;

  try {
    requestContext(request, response, next);
    const requestId = headers.get('x-request-id');
    assert.match(requestId ?? '', /^[0-9a-f-]{36}$/i);
    errorHandler(new Error('database password leaked here'), request, response, next);
    assert.equal(responseStatus, 500);
    assert.equal(responseBody.error, 'Internal server error.');
    assert.equal(responseBody.requestId, requestId);
    assert.equal(records.at(-1)?.event, 'request_failed');
    assert.equal(records.at(-1)?.requestId, requestId);
    assert.doesNotMatch(JSON.stringify(records), /database password leaked here/);
  } finally {
    env.nodeEnv = originalNodeEnv;
    setOperationalSink();
  }
});

test('production parser errors preserve client status without exposing internals', () => {
  const originalNodeEnv = env.nodeEnv;
  setOperationalSink(() => undefined);
  env.nodeEnv = 'production';
  let responseStatus = 0;
  let responseBody: Record<string, unknown> = {};
  const response = {
    locals: { requestId: 'request-parser-test' },
    status(code: number) {
      responseStatus = code;
      return this;
    },
    json(body: Record<string, unknown>) {
      responseBody = body;
      return this;
    },
  } as unknown as Response;
  const request = { path: '/api/test', method: 'POST' } as Request;
  const next = (() => undefined) as NextFunction;
  const parserError = Object.assign(new Error('body contains private malformed input'), {
    status: 400,
  });

  try {
    errorHandler(parserError, request, response, next);
    assert.equal(responseStatus, 400);
    assert.equal(responseBody.error, 'Request could not be processed.');
  } finally {
    env.nodeEnv = originalNodeEnv;
    setOperationalSink();
  }
});

test('known operational failures retain their safe recovery code', () => {
  const records: OperationalRecord[] = [];
  setOperationalSink((record) => records.push(record));
  const response = {
    locals: { requestId: 'request-gate-test' },
    status() {
      return this;
    },
    json() {
      return this;
    },
  } as unknown as Response;
  const request = {
    path: '/api/admin/orders/order-1/fulfillment/retry',
    method: 'POST',
  } as Request;
  const next = (() => undefined) as NextFunction;

  try {
    errorHandler(
      new HttpError(
        'Printful draft retry is blocked by the production fulfillment gates.',
        409,
        'fulfillment_gate_closed'
      ),
      request,
      response,
      next
    );
    assert.equal(records.at(-1)?.failureCode, 'fulfillment_gate_closed');
    assert.equal(records.at(-1)?.statusCode, 409);
  } finally {
    setOperationalSink();
  }
});
