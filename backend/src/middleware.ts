import type { NextFunction, Request, Response } from 'express';
import { env } from './config/env.js';

export class HttpError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const asyncHandler =
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`,
  });
}

export function errorHandler(error: Error, _req: Request, res: Response, _next: NextFunction) {
  const statusCode = error instanceof HttpError ? error.statusCode : 500;
  res.status(statusCode).json({
    success: false,
    error: error.message || 'Internal server error',
  });
}

export function requireAdminAccess(req: Request, _res: Response, next: NextFunction) {
  if (!env.adminAccessCode) {
    next(new HttpError('Admin API is disabled until ADMIN_ACCESS_CODE is configured.', 403));
    return;
  }

  const provided = req.header('x-admin-access');
  if (provided !== env.adminAccessCode) {
    next(new HttpError('Admin access is required.', 401));
    return;
  }

  next();
}
