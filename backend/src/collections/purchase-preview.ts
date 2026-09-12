import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { HttpError } from '../middleware.js';
import { readPurchase } from './purchase.repository.js';
import { purchaseStorage } from './purchase.storage.js';

export async function collectionPurchasePreview(quoteId: string, input: unknown) {
  const value = input as { sessionId: string; assetId: string };
  if (
    !value ||
    Object.keys(value).sort().join() !== 'assetId,sessionId' ||
    typeof value.sessionId !== 'string' ||
    typeof value.assetId !== 'string' ||
    !/^[a-f0-9-]{36}$/.test(quoteId)
  )
    throw new HttpError('Invalid print preview request.', 400);
  const manifest = await readPurchase(quoteId);
  const file = manifest?.files.find((file) => file.assetId === value.assetId);
  if (
    !manifest ||
    manifest.sessionId !== value.sessionId ||
    !file ||
    Date.parse(manifest.quote.expiresAt) <= Date.now()
  )
    throw new HttpError('This print preview is unavailable. Review your order again.', 404);
  try {
    const storage = purchaseStorage();
    if (!storage || storage.namespace !== manifest.namespace) throw new Error();
    await storage.assertPrivate();
    const bytes = await storage.read(file.path);
    if (createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error();
    return await sharp(bytes, { limitInputPixels: 40_000_000 })
      .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch {
    throw new HttpError(
      'Your saved print preview could not be read. Retry before continuing to checkout.',
      503
    );
  }
}
