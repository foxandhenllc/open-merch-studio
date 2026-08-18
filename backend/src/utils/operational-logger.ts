export type OperationalSeverity = 'info' | 'warning' | 'error';

export type OperationalContext = {
  requestId?: string;
  orderId?: string;
  stripeEventId?: string;
  stripeSessionId?: string;
  providerOrderId?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  outcome?: string;
  failureCode?: string;
  errorType?: string;
};

export type OperationalRecord = OperationalContext & {
  timestamp: string;
  kind: 'oms_operational';
  severity: OperationalSeverity;
  event: string;
};

type OperationalSink = (record: OperationalRecord) => void;

const safeToken = (value: string | undefined, maxLength = 160): string | undefined => {
  if (!value) return undefined;
  const normalized = value.replace(/[^A-Za-z0-9_.:@/-]/g, '_').slice(0, maxLength);
  return normalized || undefined;
};

const safeFingerprint = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  return `sha256:${createHash('sha256').update(value).digest('hex').slice(0, 24)}`;
};

export const redactRequestUrl = (url: string) =>
  url.replace(/\/api\/checkout\/sessions\/[^/?#]+/g, '/api/checkout/sessions/[redacted]');

export function buildOperationalRecord(
  severity: OperationalSeverity,
  event: string,
  context: OperationalContext = {},
  now = new Date()
): OperationalRecord {
  return {
    timestamp: now.toISOString(),
    kind: 'oms_operational',
    severity,
    event: safeToken(event, 80) ?? 'unknown',
    requestId: safeToken(context.requestId),
    orderId: safeToken(context.orderId),
    stripeEventId: safeToken(context.stripeEventId),
    // Checkout Session IDs authorize the public return lookup, so logs keep
    // only a stable fingerprint for correlation.
    stripeSessionId: safeFingerprint(context.stripeSessionId),
    providerOrderId: safeToken(context.providerOrderId),
    route: safeToken(context.route ? redactRequestUrl(context.route) : undefined),
    method: safeToken(context.method, 12),
    statusCode: Number.isInteger(context.statusCode) ? context.statusCode : undefined,
    outcome: safeToken(context.outcome, 80),
    failureCode: safeToken(context.failureCode, 80),
    errorType: safeToken(context.errorType, 80),
  };
}

const defaultSink: OperationalSink = (record) => {
  const serialized = JSON.stringify(record);
  if (record.severity === 'error') console.error(serialized);
  else if (record.severity === 'warning') console.warn(serialized);
  else console.info(serialized);
};

let sink: OperationalSink = defaultSink;

export function setOperationalSink(nextSink?: OperationalSink): void {
  sink = nextSink ?? defaultSink;
}

export function logOperationalEvent(
  severity: OperationalSeverity,
  event: string,
  context: OperationalContext = {}
): OperationalRecord {
  const record = buildOperationalRecord(severity, event, context);
  sink(record);
  return record;
}

export function classifyOperationalError(
  error: unknown
): Pick<OperationalContext, 'failureCode' | 'errorType' | 'statusCode'> {
  const errorType = error instanceof Error ? error.name : 'UnknownError';
  const candidate = error as {
    code?: unknown;
    status?: unknown;
    response?: { status?: unknown };
  };
  const status = candidate?.response?.status ?? candidate?.status;
  const statusCode = typeof status === 'number' ? status : undefined;
  return {
    errorType,
    failureCode:
      typeof candidate?.code === 'string'
        ? candidate.code
        : statusCode === 429
          ? 'provider_rate_limited'
          : 'provider_operation_failed',
    statusCode,
  };
}
import { createHash } from 'node:crypto';
