import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const activeMerchantConfig = require('../../config/merchant.config.json');

const routeOutput = (routePath) => `${routePath.replace(/^\/+|\/+$/g, '')}/index.html`;

/**
 * Keeps build-time search metadata derived from the same public manifest as the application.
 * Example collection copy remains product-specific; merchant and project identity do not.
 */
export function buildStaticRouteConfig(merchantConfig) {
  const brandName = merchantConfig.brand.displayName;
  const projectName = merchantConfig.attribution.projectName;
  const canonicalOrigin = merchantConfig.web.canonicalUrl.replace(/\/+$/, '');
  const { policies } = merchantConfig;
  const staticRoutes = [
    {
      path: '/',
      output: 'index.html',
      title: merchantConfig.web.title,
      description: merchantConfig.web.description,
    },
    {
      path: '/examples/fox-and-hen',
      output: 'examples/fox-and-hen/index.html',
      title: 'One Clear System | Fox & Hen Collection',
      description: `See a five-product Fox & Hen capsule built from the studio’s approved logo system, production-ready print files, and multi-placement printing in ${projectName}.`,
      socialImage: '/examples/fox-and-hen/collection-share.png',
      socialImageAlt: `Fox & Hen collection printed five ways with ${projectName}`,
    },
    {
      path: '/stores/fox-and-hen/one-clear-system',
      output: 'stores/fox-and-hen/one-clear-system/index.html',
      title: 'One Clear System | Fox & Hen Mini-Store',
      description: `Explore the Fox & Hen One Clear System collection in a ${projectName} themed mini-store.`,
      socialImage: '/examples/fox-and-hen/collection-share.png',
      socialImageAlt: 'Fox & Hen One Clear System merchandise collection',
    },
    {
      path: policies.privacyPath,
      output: routeOutput(policies.privacyPath),
      title: `Privacy Policy | ${brandName}`,
      description: `Learn what information ${brandName} processes while you design, preview, and prepare a custom order.`,
    },
    {
      path: policies.termsPath,
      output: routeOutput(policies.termsPath),
      title: `Terms of Use | ${brandName}`,
      description: `Review the terms for creating rights-cleared designs and preparing custom merchandise with ${brandName}.`,
    },
    {
      path: policies.returnsPath,
      output: routeOutput(policies.returnsPath),
      title: `Returns and Refunds Policy | ${brandName}`,
      description: `Review ${brandName} guidance for custom-product changes, cancellations, refunds, damage, and production mistakes.`,
    },
    {
      path: policies.contentPolicyPath,
      output: routeOutput(policies.contentPolicyPath),
      title: `Content Policy | ${brandName}`,
      description: `Review the safety, originality, and rights-clearance expectations for designs made with ${brandName}.`,
    },
    {
      path: '/support',
      output: 'support/index.html',
      title: `Support | ${brandName}`,
      description: `Get help with a ${brandName} design, checkout, production review, or custom merchandise order.`,
    },
  ];

  return {
    canonicalOrigin,
    defaultSocialImage: merchantConfig.brand.socialImagePath,
    siteName: brandName,
    iconPath: merchantConfig.brand.logoPath,
    webManifest: {
      name: brandName,
      short_name: merchantConfig.brand.shortName,
      description: merchantConfig.web.description,
      start_url: '/',
      display: 'standalone',
      background_color: merchantConfig.brand.colors.background,
      theme_color: merchantConfig.brand.colors.foreground,
      icons: [
        {
          src: merchantConfig.brand.logoPath,
          sizes: 'any',
          type: 'image/svg+xml',
          purpose: 'any maskable',
        },
      ],
    },
    staticRoutes,
    notFoundRoute: {
      output: '404.html',
      title: `Page Not Found | ${brandName}`,
      description: `That ${brandName} page could not be found. Return to the studio to keep creating.`,
    },
  };
}

const active = buildStaticRouteConfig(activeMerchantConfig);

export const CANONICAL_ORIGIN = active.canonicalOrigin;
export const DEFAULT_SOCIAL_IMAGE = active.defaultSocialImage;
export const SITE_NAME = active.siteName;
export const ICON_PATH = active.iconPath;
export const WEB_MANIFEST = active.webManifest;
export const STATIC_ROUTES = active.staticRoutes;
export const NOT_FOUND_ROUTE = active.notFoundRoute;
