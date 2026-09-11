import type { NextFunction, Request, Response } from 'express';
import { readStoreSettings, withStoreSettings } from './store-settings.js';

/** Keep one immutable settings snapshot while a provider call is in flight. */
export function requestStoreSettings(_req: Request, _res: Response, next: NextFunction) {
  readStoreSettings().then((snapshot) => withStoreSettings(snapshot.values, () => next()), next);
}
