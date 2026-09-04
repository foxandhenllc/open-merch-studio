export type FlowState =
  | 'booting'
  | 'boot_failed'
  | 'configuring'
  | 'refining'
  | 'generating'
  | 'drafted'
  | 'previewing'
  | 'quoted'
  | 'quote_stale'
  | 'quote_expired'
  | 'ordering'
  | 'redirecting'
  | 'confirmed';

export type WorkbenchMode =
  | 'product'
  | 'configure'
  | 'describe'
  | 'generating'
  | 'review'
  | 'cart'
  | 'checkout'
  | 'order';

export type ActionKey =
  | 'catalog'
  | 'refining'
  | 'generating'
  | 'revising'
  | 'mockup'
  | 'quoting'
  | 'pass'
  | 'checkout';

export type Surface =
  | 'boot'
  | 'catalog'
  | 'generation'
  | 'mockup'
  | 'quote'
  | 'checkout'
  | 'order';

export type SurfaceError = {
  cause: string;
  title: string;
  message: string;
  recovery: string;
  retryable: boolean;
};

export type PreviewOrientation = 'portrait' | 'landscape' | 'square';
export type CreationPath = 'generate' | 'upload' | 'reference';
