import type { CollectionPrintLayout } from '@open-merch-studio/collection-drafts';
export type PrintLayoutFields = Record<
  Exclude<keyof CollectionPrintLayout, 'itemId' | 'placementCode'>,
  string
>;
