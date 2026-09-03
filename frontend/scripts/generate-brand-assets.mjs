import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(scriptDirectory, '../public');
const mockupDirectory = path.join(publicDirectory, 'examples/fox-and-hen/mockups');
const outputPath = path.join(publicDirectory, 'open-merch-studio-share.png');

const productCard = async (filename, width, height) =>
  sharp(path.join(mockupDirectory, filename))
    .resize(width, height, { fit: 'contain' })
    .png()
    .toBuffer();

const [tee, mug] = await Promise.all([
  productCard('workbench-tee-01-product-view.png', 430, 430),
  productCard('connected-systems-mug-01-front-view-default.png', 300, 300),
]);

const type = Buffer.from(`
  <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="#0f172a"/>
    <rect x="54" y="54" width="1092" height="522" rx="28" fill="#151f30" stroke="#334155"/>
    <circle cx="116" cy="119" r="35" fill="none" stroke="#14b8a6" stroke-width="5"/>
    <text x="116" y="131" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="800" letter-spacing="-2" fill="#f8fafc">OM</text>
    <text x="170" y="112" font-family="Arial, Helvetica, sans-serif" font-size="29" font-weight="800" fill="#f8fafc">Open Merch Studio</text>
    <text x="170" y="140" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" letter-spacing="2" fill="#94a3b8">OPEN-SOURCE CUSTOM MERCH</text>
    <text x="88" y="248" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="800" letter-spacing="-3" fill="#f8fafc">Your artwork.</text>
    <text x="88" y="312" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="800" letter-spacing="-3" fill="#f8fafc">Your references.</text>
    <text x="88" y="376" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="800" letter-spacing="-3" fill="#f8fafc">Print-ready help.</text>
    <text x="91" y="430" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#cbd5e1">Create, preview, price, and order across every print area.</text>
    <rect x="88" y="482" width="287" height="47" rx="23.5" fill="#14b8a6"/>
    <text x="231" y="513" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="800" fill="#062b2a">OPENMERCHSTUDIO.COM</text>
    <rect x="688" y="91" width="294" height="438" rx="22" fill="#f8fafc" transform="rotate(-3 835 310)"/>
    <rect x="907" y="318" width="216" height="220" rx="22" fill="#e2e8f0" transform="rotate(4 1015 428)"/>
    <path d="M655 515 C760 564 882 567 974 527" fill="none" stroke="#f97316" stroke-width="7" stroke-linecap="round"/>
  </svg>
`);

await mkdir(path.dirname(outputPath), { recursive: true });
await sharp({
  create: { width: 1200, height: 630, channels: 4, background: '#0f172a' },
})
  .composite([
    { input: type, left: 0, top: 0 },
    { input: tee, left: 615, top: 104 },
    { input: mug, left: 866, top: 296 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

console.log(`Generated ${path.relative(process.cwd(), outputPath)}.`);
