import type { Request, Response } from 'express';
import { asyncHandler, HttpError } from '../middleware.js';
import {
  bootstrapStorefront,
  getPublishedStorefront,
  publishStorefront,
  saveQuotedProduct,
} from '../services/storefront.service.js';

const requiredString = (value: unknown, label: string): string => {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result) throw new HttpError(`${label} is required.`, 400);
  return result;
};

export const getPublicStorefront = asyncHandler(async (req: Request, res: Response) => {
  let storefront;
  try {
    storefront = await getPublishedStorefront(
      String(req.params.organizationSlug ?? ''),
      String(req.params.storefrontSlug ?? '')
    );
  } catch (error) {
    throw new HttpError(error instanceof Error ? error.message : 'Invalid storefront path.', 400);
  }
  if (!storefront) throw new HttpError('Storefront not found.', 404);
  res.json({ success: true, data: storefront });
});

export const postStorefrontBootstrap = asyncHandler(async (req: Request, res: Response) => {
  try {
    const result = await bootstrapStorefront({
      organizationName: requiredString(req.body?.organizationName, 'Organization name'),
      organizationSlug: requiredString(req.body?.organizationSlug, 'Organization slug'),
      displayName: requiredString(req.body?.displayName, 'Display name'),
      shortDescription:
        typeof req.body?.shortDescription === 'string'
          ? req.body.shortDescription.trim()
          : undefined,
      supportEmail:
        typeof req.body?.supportEmail === 'string' ? req.body.supportEmail.trim() : undefined,
      websiteUrl: typeof req.body?.websiteUrl === 'string' ? req.body.websiteUrl.trim() : undefined,
      collectionTitle: requiredString(req.body?.collectionTitle, 'Collection title'),
      collectionSlug: requiredString(req.body?.collectionSlug, 'Collection slug'),
      storefrontTitle: requiredString(req.body?.storefrontTitle, 'Storefront title'),
      storefrontSlug: requiredString(req.body?.storefrontSlug, 'Storefront slug'),
    });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(error instanceof Error ? error.message : 'Storefront setup failed.', 400);
  }
});

export const postSavedProduct = asyncHandler(async (req: Request, res: Response) => {
  try {
    const result = await saveQuotedProduct({
      organizationSlug: requiredString(req.body?.organizationSlug, 'Organization slug'),
      collectionSlug: requiredString(req.body?.collectionSlug, 'Collection slug'),
      quoteId: requiredString(req.body?.quoteId, 'Quote ID'),
      productId: requiredString(req.body?.productId, 'Product ID'),
      variantId: requiredString(req.body?.variantId, 'Variant ID'),
      designAssetId:
        typeof req.body?.designAssetId === 'string' ? req.body.designAssetId.trim() : undefined,
      title: requiredString(req.body?.title, 'Product title'),
      slug: requiredString(req.body?.slug, 'Product slug'),
      mockupUrl: typeof req.body?.mockupUrl === 'string' ? req.body.mockupUrl.trim() : undefined,
    });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(error instanceof Error ? error.message : 'Product save failed.', 400);
  }
});

export const postStorefrontPublish = asyncHandler(async (req: Request, res: Response) => {
  try {
    await publishStorefront(
      requiredString(req.body?.organizationSlug, 'Organization slug'),
      requiredString(req.body?.storefrontSlug, 'Storefront slug')
    );
    res.json({ success: true, data: { status: 'published' } });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(error instanceof Error ? error.message : 'Storefront publish failed.', 400);
  }
});
