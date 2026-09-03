import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CANONICAL_ORIGIN,
  DEFAULT_SOCIAL_IMAGE,
  NOT_FOUND_ROUTE,
  STATIC_ROUTES,
} from './static-route-config.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(scriptDirectory, '..');
const repositoryDirectory = path.resolve(frontendDirectory, '..');
const distDirectory = path.join(frontendDirectory, 'dist');

const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const occurrences = (value, pattern) => value.match(pattern)?.length ?? 0;

for (const route of STATIC_ROUTES) {
  const html = await readFile(path.join(distDirectory, route.output), 'utf8');
  const canonicalUrl = `${CANONICAL_ORIGIN}${route.path}`;
  assert.ok(html.includes(`<title>${escapeHtml(route.title)}</title>`), `${route.path} title`);
  assert.ok(
    html.includes(`<meta name="description" content="${escapeHtml(route.description)}" />`),
    `${route.path} description`
  );
  assert.ok(
    html.includes(`<link rel="canonical" href="${canonicalUrl}" />`),
    `${route.path} canonical`
  );
  assert.ok(
    html.includes(`<meta property="og:url" content="${canonicalUrl}" />`),
    `${route.path} Open Graph URL`
  );
  assert.ok(
    html.includes(`<meta property="og:title" content="${escapeHtml(route.title)}" />`),
    `${route.path} Open Graph title`
  );
  assert.ok(
    html.includes(
      `<meta property="og:description" content="${escapeHtml(route.description)}" />`
    ),
    `${route.path} Open Graph description`
  );
  const socialImageUrl = `${CANONICAL_ORIGIN}${route.socialImage ?? DEFAULT_SOCIAL_IMAGE}`;
  assert.ok(
    html.includes(`<meta property="og:image" content="${socialImageUrl}" />`),
    `${route.path} Open Graph image`
  );
  assert.ok(
    html.includes(`<meta name="twitter:title" content="${escapeHtml(route.title)}" />`),
    `${route.path} Twitter title`
  );
  assert.ok(
    html.includes(`<meta name="twitter:image" content="${socialImageUrl}" />`),
    `${route.path} Twitter image`
  );
  assert.equal(occurrences(html, /rel="canonical"/g), 1, `${route.path} canonical count`);
  assert.equal(occurrences(html, /property="og:url"/g), 1, `${route.path} og:url count`);
  assert.match(html, /<meta\s+name="robots"\s+content="index,follow"\s*\/>/i);
  assert.doesNotMatch(html, /<meta\s+name="robots"\s+content="[^"]*noindex[^"]*"\s*\/>/i);
}

const notFoundHtml = await readFile(path.join(distDirectory, NOT_FOUND_ROUTE.output), 'utf8');
assert.ok(notFoundHtml.includes(`<title>${NOT_FOUND_ROUTE.title}</title>`));
assert.doesNotMatch(notFoundHtml, /rel="canonical"/i);
assert.doesNotMatch(notFoundHtml, /property="og:url"/i);
assert.match(notFoundHtml, /<meta\s+name="robots"\s+content="[^"]*noindex[^"]*"\s*\/>/i);

const robots = await readFile(path.join(distDirectory, 'robots.txt'), 'utf8');
assert.match(robots, /^Allow:\s*\/$/m);
assert.doesNotMatch(robots, /^Disallow:\s*\/$/m);
assert.match(robots, /^Sitemap:\s*https:\/\/openmerchstudio\.com\/sitemap\.xml$/m);

const sitemap = await readFile(path.join(distDirectory, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
assert.deepEqual(
  sitemapUrls,
  STATIC_ROUTES.map((route) => `${CANONICAL_ORIGIN}${route.path}`)
);

const manifest = JSON.parse(await readFile(path.join(distDirectory, 'manifest.webmanifest'), 'utf8'));
assert.ok(
  manifest.icons?.some((icon) => icon.src === '/icon.svg' && icon.type === 'image/svg+xml'),
  'the web app manifest must expose the OMS icon'
);
await access(path.join(distDirectory, 'icon.svg'));
await access(path.join(distDirectory, DEFAULT_SOCIAL_IMAGE.replace(/^\//, '')));

const vercelConfig = JSON.parse(await readFile(path.join(repositoryDirectory, 'vercel.json'), 'utf8'));
const rewrites = vercelConfig.rewrites ?? [];
const globalHeaders = (vercelConfig.headers ?? []).find((rule) => rule.source === '/(.*)')?.headers;
const apiHeaders = (vercelConfig.headers ?? []).find(
  (rule) => rule.source === '/api/(.*)'
)?.headers;
assert.equal(
  vercelConfig.trailingSlash,
  false,
  'trailing-slash variants must redirect to the canonical extensionless route'
);
assert.ok(
  !globalHeaders?.some((header) => header.key.toLowerCase() === 'x-robots-tag'),
  'public open-source launch must not send a global X-Robots-Tag gate'
);
assert.ok(
  apiHeaders?.some(
    (header) =>
      header.key.toLowerCase() === 'x-robots-tag' &&
      header.value === 'noindex, nofollow, noarchive, noimageindex'
  ),
  'API responses and provider-accessible artwork must stay out of search and image indexes'
);
assert.ok(
  rewrites.some(
    (rewrite) =>
      rewrite.source === '/api/(.*)' && rewrite.destination === '/api/[...path]?...path=$1'
  ),
  'API rewrite must remain intact'
);
for (const route of STATIC_ROUTES.filter((item) => item.path !== '/')) {
  assert.ok(
    rewrites.some(
      (rewrite) => rewrite.source === route.path && rewrite.destination === `/${route.output}`
    ),
    `${route.path} must target its generated HTML`
  );
}
assert.ok(
  !rewrites.some((rewrite) => rewrite.source === '/(.*)' && rewrite.destination === '/index.html'),
  'blanket SPA fallback must stay removed so Vercel can return 404.html with status 404'
);

console.log(
  `Verified ${STATIC_ROUTES.length} indexable canonical routes, sitemap, and custom noindex 404 output.`
);
