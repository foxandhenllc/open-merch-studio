import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CANONICAL_ORIGIN,
  DEFAULT_SOCIAL_IMAGE,
  ICON_PATH,
  NOT_FOUND_ROUTE,
  SITE_NAME,
  STATIC_ROUTES,
} from './static-route-config.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(scriptDirectory, '..');
const distDirectory = path.join(frontendDirectory, 'dist');
const baseDocument = await readFile(path.join(distDirectory, 'index.html'), 'utf8');

const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const replaceOrInsertHeadTag = (html, pattern, tag) => {
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace('</head>', `    ${tag}\n  </head>`);
};

const removeHeadTag = (html, pattern) => html.replace(pattern, '');

const renderDocument = ({
  title,
  description,
  canonicalUrl,
  socialImage = DEFAULT_SOCIAL_IMAGE,
  socialImageAlt = 'Open Merch Studio with real custom product proofs',
}) => {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeSocialImageAlt = escapeHtml(socialImageAlt);
  const socialImageUrl = `${CANONICAL_ORIGIN}${socialImage}`;
  let html = baseDocument.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`);

  html = replaceOrInsertHeadTag(
    html,
    /<meta\s+[^>]*name=["']description["'][^>]*>/i,
    `<meta name="description" content="${safeDescription}" />`
  );
  html = replaceOrInsertHeadTag(
    html,
    /<meta\s+[^>]*property=["']og:image["'][^>]*>/i,
    `<meta property="og:image" content="${socialImageUrl}" />`
  );
  html = replaceOrInsertHeadTag(
    html,
    /<meta\s+[^>]*property=["']og:image:alt["'][^>]*>/i,
    `<meta property="og:image:alt" content="${safeSocialImageAlt}" />`
  );
  html = replaceOrInsertHeadTag(
    html,
    /<meta\s+[^>]*name=["']twitter:title["'][^>]*>/i,
    `<meta name="twitter:title" content="${safeTitle}" />`
  );
  html = replaceOrInsertHeadTag(
    html,
    /<meta\s+[^>]*name=["']twitter:description["'][^>]*>/i,
    `<meta name="twitter:description" content="${safeDescription}" />`
  );
  html = replaceOrInsertHeadTag(
    html,
    /<meta\s+[^>]*name=["']twitter:image["'][^>]*>/i,
    `<meta name="twitter:image" content="${socialImageUrl}" />`
  );
  html = replaceOrInsertHeadTag(
    html,
    /<meta\s+[^>]*property=["']og:title["'][^>]*>/i,
    `<meta property="og:title" content="${safeTitle}" />`
  );
  html = replaceOrInsertHeadTag(
    html,
    /<meta\s+[^>]*property=["']og:description["'][^>]*>/i,
    `<meta property="og:description" content="${safeDescription}" />`
  );
  html = replaceOrInsertHeadTag(
    html,
    /<meta\s+[^>]*property=["']og:site_name["'][^>]*>/i,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`
  );
  html = replaceOrInsertHeadTag(
    html,
    /<link\s+[^>]*rel=["']icon["'][^>]*>/i,
    `<link rel="icon" href="${ICON_PATH}" type="image/svg+xml" />`
  );
  html = replaceOrInsertHeadTag(
    html,
    /<meta\s+[^>]*name=["']robots["'][^>]*>/i,
    `<meta name="robots" content="${canonicalUrl ? 'index,follow' : 'noindex,follow'}" />`
  );

  if (canonicalUrl) {
    html = replaceOrInsertHeadTag(
      html,
      /<link\s+[^>]*rel=["']canonical["'][^>]*>/i,
      `<link rel="canonical" href="${canonicalUrl}" />`
    );
    html = replaceOrInsertHeadTag(
      html,
      /<meta\s+[^>]*property=["']og:url["'][^>]*>/i,
      `<meta property="og:url" content="${canonicalUrl}" />`
    );
  } else {
    html = removeHeadTag(html, /\s*<link\s+[^>]*rel=["']canonical["'][^>]*>/i);
    html = removeHeadTag(html, /\s*<meta\s+[^>]*property=["']og:url["'][^>]*>/i);
  }

  return html;
};

for (const route of STATIC_ROUTES) {
  const canonicalUrl = `${CANONICAL_ORIGIN}${route.path}`;
  const outputPath = path.join(distDirectory, route.output);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, renderDocument({ ...route, canonicalUrl }), 'utf8');
}

await writeFile(
  path.join(distDirectory, NOT_FOUND_ROUTE.output),
  renderDocument(NOT_FOUND_ROUTE),
  'utf8'
);

await writeFile(
  path.join(distDirectory, 'robots.txt'),
  `User-agent: *\nAllow: /\n\n# Public open-source routes are indexable; checkout and fulfillment use separate server-side gates.\nSitemap: ${CANONICAL_ORIGIN}/sitemap.xml\n`,
  'utf8'
);

await writeFile(
  path.join(distDirectory, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${STATIC_ROUTES.map((route) => `  <url><loc>${escapeHtml(`${CANONICAL_ORIGIN}${route.path}`)}</loc></url>`).join('\n')}\n</urlset>\n`,
  'utf8'
);

console.log(
  `Generated ${STATIC_ROUTES.length} canonical route documents and ${NOT_FOUND_ROUTE.output}.`
);
