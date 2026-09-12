export type BrandAssetKind = 'logo' | 'share';
export type BrandAsset = {
  hash: string;
  kind: BrandAssetKind;
  width: number;
  height: number;
  byteSize: number;
  publicPath: string;
};
export type BrandAssetRecord = BrandAsset & {
  schemaVersion: 1;
  path: string;
  namespace: string;
  status: 'staged' | 'complete';
};
