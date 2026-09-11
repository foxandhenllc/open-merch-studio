import { merchantConfig } from './generated/merchant-config';

/** Build-time merchant colors feed the existing studio tokens and every responsive surface. */
export function applyMerchantTheme(root: HTMLElement) {
  const { background, foreground, accent } = merchantConfig.brand.colors;
  const values = {
    '--paper': background,
    '--surface': `color-mix(in srgb, ${background} 97%, ${foreground})`,
    '--surface-2': `color-mix(in srgb, ${background} 92%, ${foreground})`,
    '--ink': foreground,
    '--ink-soft': `color-mix(in srgb, ${foreground} 78%, ${background})`,
    '--ink-faint': `color-mix(in srgb, ${foreground} 68%, ${background})`,
    '--line': `color-mix(in srgb, ${foreground} 16%, ${background})`,
    '--line-strong': `color-mix(in srgb, ${foreground} 32%, ${background})`,
    '--accent': accent,
    '--accent-soft': `color-mix(in srgb, ${accent} 12%, ${background})`,
    '--accent-on-soft': foreground,
    '--on-accent': '#ffffff',
  };
  for (const [key, value] of Object.entries(values)) root.style.setProperty(key, value);
  root.style.colorScheme = 'light';
}
