import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const publicDirectory = join(scriptDirectory, '..', 'public');
const collectionDirectory = join(publicDirectory, 'examples', 'fox-and-hen');
const brandDirectory = join(collectionDirectory, 'brand');
const printDirectory = join(collectionDirectory, 'print-files');

const palette = {
  ink: '#1D2620',
  deep: '#222E27',
  paper: '#FBF8F3',
  rust: '#B4532A',
  line: '#6D7C72',
};

const brandAsset = (name) => join(brandDirectory, name);
const output = (name) => join(printDirectory, name);

const horizontal = brandAsset('fox-and-hen-logo-horizontal.svg');
const horizontalLight = brandAsset('fox-and-hen-logo-horizontal-light.svg');
const stacked = brandAsset('fox-and-hen-logo-primary-stacked.svg');
const stackedLight = brandAsset('fox-and-hen-logo-primary-stacked-light.svg');
const avatar = brandAsset('fox-and-hen-avatar-universal.svg');

function xml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function svg(width, height, body) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`
  );
}

function label({
  x,
  y,
  text,
  size,
  fill = palette.paper,
  weight = 700,
  anchor = 'start',
  spacing = 0,
  family = 'Arial, Helvetica, sans-serif',
}) {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${spacing}">${xml(text)}</text>`;
}

async function resizedInput(path, width, height) {
  return sharp(path).resize({ width, height, fit: 'inside', withoutEnlargement: false }).png().toBuffer();
}

async function writeTransparent(width, height, composites, destination) {
  await sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png()
    .toFile(destination);
}

async function writeBackground(width, height, background, composites, destination) {
  await sharp({
    create: { width, height, channels: 4, background },
  })
    .composite(composites)
    .png()
    .toFile(destination);
}

await mkdir(printDirectory, { recursive: true });

const teeFrontLogo = await resizedInput(stackedLight, 2700, 3000);
await writeTransparent(
  4500,
  5100,
  [
    { input: teeFrontLogo, gravity: 'centre' },
    {
      input: svg(
        4500,
        5100,
        `${label({ x: 2250, y: 4560, text: 'ONE CLEAR SYSTEM', size: 150, anchor: 'middle', spacing: 26, weight: 700 })}`
      ),
    },
  ],
  output('workbench-tee-front.png')
);

const teeBackLogo = await resizedInput(horizontalLight, 3400, 1120);
await writeTransparent(
  4500,
  5100,
  [
    { input: teeBackLogo, top: 540, left: 550 },
    {
      input: svg(
        4500,
        5100,
        [
          `<line x1="560" y1="1840" x2="3940" y2="1840" stroke="${palette.rust}" stroke-width="28" />`,
          label({ x: 2250, y: 2450, text: 'DISCONNECTED TOOLS.', size: 310, anchor: 'middle', spacing: 6, weight: 800 }),
          label({ x: 2250, y: 2860, text: 'ONE CLEAR SYSTEM.', size: 310, anchor: 'middle', spacing: 6, weight: 800 }),
          label({ x: 2250, y: 3650, text: 'WEBSITE  /  WORKFLOW  /  OPERATIONS', size: 122, anchor: 'middle', spacing: 15, weight: 700, fill: palette.rust }),
          `<line x1="560" y1="3940" x2="3940" y2="3940" stroke="${palette.paper}" stroke-opacity="0.4" stroke-width="12" />`,
          label({ x: 2250, y: 4250, text: 'FOXANDHENLLC.COM', size: 118, anchor: 'middle', spacing: 22, weight: 700 }),
        ].join('')
      ),
    },
  ],
  output('workbench-tee-back.png')
);

const toteFrontLogo = await resizedInput(stacked, 3000, 3400);
await writeTransparent(
  4500,
  5100,
  [
    { input: toteFrontLogo, gravity: 'centre' },
    {
      input: svg(
        4500,
        5100,
        label({ x: 2250, y: 4650, text: 'SYSTEMS BUILT TO WORK TOGETHER', size: 125, anchor: 'middle', spacing: 18, weight: 700, fill: palette.ink })
      ),
    },
  ],
  output('studio-notes-tote-front.png')
);

const toteBackAvatar = await resizedInput(avatar, 1750, 1750);
await writeTransparent(
  4500,
  5100,
  [
    { input: toteBackAvatar, top: 650, left: 1375 },
    {
      input: svg(
        4500,
        5100,
        [
          label({ x: 2250, y: 3080, text: 'START WITH', size: 300, anchor: 'middle', spacing: 12, weight: 800, fill: palette.ink }),
          label({ x: 2250, y: 3480, text: 'THE FRICTION.', size: 300, anchor: 'middle', spacing: 12, weight: 800, fill: palette.ink }),
          `<line x1="920" y1="3880" x2="3580" y2="3880" stroke="${palette.rust}" stroke-width="24" />`,
          label({ x: 2250, y: 4230, text: 'THEN BUILD THE CONNECTION.', size: 124, anchor: 'middle', spacing: 18, weight: 700, fill: palette.ink }),
        ].join('')
      ),
    },
  ],
  output('studio-notes-tote-back.png')
);

const mugLogo = await resizedInput(horizontalLight, 1680, 630);
const mugAvatar = await resizedInput(avatar, 765, 765);
await writeBackground(
  4050,
  1680,
  palette.deep,
  [
    { input: mugLogo, top: 315, left: 255 },
    { input: mugAvatar, top: 255, left: 2970 },
    {
      input: svg(
        4050,
        1680,
        [
          `<line x1="255" y1="1155" x2="3795" y2="1155" stroke="${palette.rust}" stroke-width="27" />`,
          label({ x: 255, y: 1410, text: 'ONE CLEAR SYSTEM', size: 132, spacing: 24 }),
          label({ x: 3795, y: 1410, text: 'FOXANDHENLLC.COM', size: 118, spacing: 20, anchor: 'end', fill: palette.rust }),
        ].join('')
      ),
    },
  ],
  output('connected-systems-mug-wrap.png')
);

const posterLogo = await resizedInput(stackedLight, 1480, 1480);
await writeBackground(
  3600,
  5400,
  palette.deep,
  [
    { input: posterLogo, top: 270, left: 210 },
    {
      input: svg(
        3600,
        5400,
        [
          label({ x: 3380, y: 470, text: 'COLLECTION 001', size: 92, anchor: 'end', spacing: 18, weight: 700, fill: palette.rust }),
          label({ x: 3380, y: 770, text: 'ONE CLEAR', size: 260, anchor: 'end', spacing: 2, weight: 800 }),
          label({ x: 3380, y: 1080, text: 'SYSTEM', size: 260, anchor: 'end', spacing: 2, weight: 800 }),
          `<line x1="220" y1="1840" x2="3380" y2="1840" stroke="${palette.rust}" stroke-width="28" />`,
          label({ x: 360, y: 2280, text: '01', size: 110, fill: palette.rust, spacing: 12 }),
          label({ x: 800, y: 2280, text: 'FIND THE FRICTION', size: 190, weight: 800, spacing: 4 }),
          `<line x1="415" y1="2430" x2="415" y2="2950" stroke="${palette.line}" stroke-width="20" />`,
          label({ x: 360, y: 3220, text: '02', size: 110, fill: palette.rust, spacing: 12 }),
          label({ x: 800, y: 3220, text: 'BUILD THE CONNECTION', size: 190, weight: 800, spacing: 4 }),
          `<line x1="415" y1="3370" x2="415" y2="3890" stroke="${palette.line}" stroke-width="20" />`,
          label({ x: 360, y: 4160, text: '03', size: 110, fill: palette.rust, spacing: 12 }),
          label({ x: 800, y: 4160, text: 'MAKE IT USEFUL', size: 190, weight: 800, spacing: 4 }),
          `<line x1="220" y1="4660" x2="3380" y2="4660" stroke="${palette.paper}" stroke-opacity="0.35" stroke-width="12" />`,
          label({ x: 220, y: 4950, text: 'WEBSITE  /  WORKFLOW  /  OPERATIONS', size: 108, spacing: 14, weight: 700 }),
          label({ x: 220, y: 5190, text: 'FOXANDHENLLC.COM', size: 94, spacing: 18, weight: 700, fill: palette.rust }),
        ].join('')
      ),
    },
  ],
  output('system-map-poster.png')
);

const stickerAvatar = await resizedInput(avatar, 1700, 1700);
await writeTransparent(
  1800,
  1800,
  [{ input: stickerAvatar, top: 50, left: 50 }],
  output('studio-mark-sticker.png')
);

const shareLogo = await resizedInput(horizontal, 760, 300);
const shareStacked = await resizedInput(stackedLight, 530, 530);
const shareAvatar = await resizedInput(avatar, 164, 164);
await writeBackground(
  1200,
  630,
  palette.paper,
  [
    { input: shareLogo, top: 62, left: 58 },
    {
      input: svg(
        1200,
        630,
        [
          `<rect x="0" y="0" width="18" height="630" fill="${palette.rust}" />`,
          `<rect x="828" y="0" width="372" height="630" fill="${palette.deep}" />`,
          label({ x: 60, y: 365, text: 'ONE CLEAR SYSTEM', size: 74, fill: palette.ink, weight: 800, spacing: 1 }),
          label({ x: 60, y: 438, text: 'PRINTED FIVE WAYS.', size: 74, fill: palette.ink, weight: 800, spacing: 1 }),
          label({ x: 60, y: 525, text: 'ACTUAL BRAND ASSETS  /  REAL PRINTFUL PROOFS', size: 22, fill: palette.rust, weight: 700, spacing: 4 }),
          label({ x: 60, y: 570, text: 'MADE WITH OPEN MERCH STUDIO', size: 20, fill: palette.ink, weight: 700, spacing: 4 }),
        ].join('')
      ),
    },
    { input: shareStacked, top: 55, left: 748 },
    { input: shareAvatar, top: 430, left: 934 },
  ],
  join(collectionDirectory, 'collection-share.png')
);

console.log(`Generated Fox & Hen brand collection files in ${collectionDirectory}`);
