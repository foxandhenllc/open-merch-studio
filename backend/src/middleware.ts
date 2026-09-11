import type { NextFunction, Request, Response } from 'express';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { env } from './config/env.js';
import { classifyOperationalError, logOperationalEvent } from './utils/operational-logger.js';

export class HttpError extends Error {
  statusCode: number;
  errorCode?: string;

  constructor(message: string, statusCode = 500, errorCode?: string) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

export const asyncHandler =
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };

export function requestContext(_req: Request, res: Response, next: NextFunction) {
  const requestId = randomUUID();
  res.locals.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
  });
}

export function errorHandler(error: Error, req: Request, res: Response, _next: NextFunction) {
  const candidateStatus = (error as Error & { status?: unknown; statusCode?: unknown }).status;
  const candidateStatusCode = (error as Error & { status?: unknown; statusCode?: unknown })
    .statusCode;
  const libraryStatus = Number(candidateStatus ?? candidateStatusCode);
  const statusCode =
    error instanceof HttpError
      ? error.statusCode
      : Number.isInteger(libraryStatus) && libraryStatus >= 400 && libraryStatus <= 599
        ? libraryStatus
        : 500;
  const requestId = String(res.locals.requestId ?? '');
  const operationalError = classifyOperationalError(error);
  logOperationalEvent(statusCode >= 500 ? 'error' : 'warning', 'request_failed', {
    requestId,
    route: req.path,
    method: req.method,
    ...operationalError,
    failureCode:
      error instanceof HttpError && error.errorCode
        ? error.errorCode
        : operationalError.failureCode,
    statusCode,
  });
  const exposeMessage = error instanceof HttpError || env.nodeEnv !== 'production';
  res.status(statusCode).json({
    success: false,
    error: exposeMessage
      ? error.message || 'Request failed.'
      : statusCode < 500
        ? 'Request could not be processed.'
        : 'Internal server error.',
    errorCode: error instanceof HttpError ? error.errorCode : undefined,
    requestId,
  });
}

const adminFailures = new Map<string, { count: number; until: number }>();

export function requireAdminAccess(req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.vary('x-admin-access');
  const address = req.socket.remoteAddress ?? 'unknown';
  const failed = adminFailures.get(address);
  if (!env.adminAccessCode) {
    next(new HttpError('Admin API is disabled until ADMIN_ACCESS_CODE is configured.', 403));
    return;
  }

  const provided = req.header('x-admin-access');
  const expectedBytes = Buffer.from(env.adminAccessCode);
  const providedBytes = Buffer.from(provided ?? '');
  if (
    expectedBytes.length !== providedBytes.length ||
    !timingSafeEqual(expectedBytes, providedBytes)
  ) {
    // A shared proxy address must not let failed guesses lock out an authenticated owner.
    if (failed && failed.until > Date.now() && failed.count >= 20) {
      res.setHeader('Retry-After', String(Math.ceil((failed.until - Date.now()) / 1000)));
      next(
        new HttpError(
          'Too many sign-in attempts. Try again in a minute.',
          429,
          'admin_rate_limited'
        )
      );
      return;
    }
    if (adminFailures.size > 10000) {
      for (const [key, entry] of adminFailures)
        if (entry.until <= Date.now()) adminFailures.delete(key);
      if (adminFailures.size > 10000) adminFailures.delete(adminFailures.keys().next().value!);
    }
    adminFailures.set(address, {
      count: failed && failed.until > Date.now() ? failed.count + 1 : 1,
      until: failed && failed.until > Date.now() ? failed.until : Date.now() + 60000,
    });
    next(new HttpError('Admin access is required.', 401));
    return;
  }

  adminFailures.delete(address);
  next();
}
