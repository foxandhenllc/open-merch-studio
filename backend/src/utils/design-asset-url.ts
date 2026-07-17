type DesignAssetUrlParams = {
  assetId: string;
  storedUrl: string;
  backendUrl: string;
};

const assetPath = (assetId: string): string =>
  `/api/design/assets/${encodeURIComponent(assetId)}.png`;

const publicAssetUrl = (assetId: string, backendUrl: string): string =>
  `${backendUrl.replace(/\/+$/, '')}${assetPath(assetId)}`;

function isMatchingVercelAssetUrl(url: URL, assetId: string): boolean {
  const hostname = url.hostname.toLowerCase();
  if (!hostname.endsWith('.vercel.app')) return false;

  const deploymentName = hostname.slice(0, -'.vercel.app'.length);
  if (
    deploymentName !== 'open-merch-studio-vercel-output' &&
    !deploymentName.startsWith('open-merch-studio-vercel-output-')
  ) {
    return false;
  }

  const match = url.pathname.match(/^\/api\/design\/assets\/([^/]+)\.png$/);
  if (!match) return false;

  try {
    return decodeURIComponent(match[1]) === assetId;
  } catch {
    return false;
  }
}

/**
 * Resolve a stored design image into a URL that a provider can retrieve.
 *
 * Durable rows created before a custom-domain cutover may point back to the
 * OMS design-asset route on an old Vercel deployment. Rebase only that exact
 * first-party route for the current asset; unrelated external URLs remain
 * untouched.
 */
export function resolveDesignAssetProviderUrl({
  assetId,
  storedUrl,
  backendUrl,
}: DesignAssetUrlParams): string | null {
  const value = storedUrl.trim();
  if (!value) return null;

  const currentAssetUrl = publicAssetUrl(assetId, backendUrl);
  if (value.startsWith('data:')) return currentAssetUrl;

  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return isMatchingVercelAssetUrl(url, assetId) ? currentAssetUrl : value;
  } catch {
    return null;
  }
}
