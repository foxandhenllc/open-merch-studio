const normalizeBoolean = (value: unknown, defaultValue = false) => {
  if (typeof value !== 'string') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const appMode = String(import.meta.env.VITE_PUBLIC_APP_MODE || 'oss').toLowerCase();

export const publicConfig = {
  appMode,
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL || 'support@openmerchstudio.com',
  isProductionMode: appMode === 'production',
  enablePublicCheckout: normalizeBoolean(import.meta.env.VITE_ENABLE_PUBLIC_CHECKOUT),
  enableLocalFallbacks: normalizeBoolean(
    import.meta.env.VITE_ENABLE_LOCAL_FALLBACKS,
    appMode !== 'production'
  ),
};

export const canUseCustomerCheckout =
  !publicConfig.isProductionMode || publicConfig.enablePublicCheckout;
