import sharp from 'sharp';

type CleanupResult = {
  imageUrl: string;
  removed: boolean;
  transparentPixelCount: number;
  totalPixelCount: number;
};

function dataUrlToImageBuffer(imageUrl: string): { buffer: Buffer; contentType: string } | null {
  const match = imageUrl.match(/^data:([^;,]+)(;base64)?,(.+)$/);
  if (!match?.[1] || !match[3]) return null;
  const isBase64 = Boolean(match[2]);
  return {
    contentType: match[1],
    buffer: isBase64 ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3])),
  };
}

function isRemovableBackgroundPixel(raw: Buffer, offset: number): boolean {
  const alpha = raw[offset + 3] ?? 255;
  if (alpha < 16) return true;
  const red = raw[offset] ?? 0;
  const green = raw[offset + 1] ?? 0;
  const blue = raw[offset + 2] ?? 0;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const brightness = (red + green + blue) / 3;

  return brightness >= 224 && max - min <= 34;
}

export async function removeEdgeBackgroundFromImageUrl(imageUrl: string): Promise<CleanupResult> {
  const parsed = dataUrlToImageBuffer(imageUrl);
  if (!parsed || !parsed.contentType.startsWith('image/')) {
    return { imageUrl, removed: false, transparentPixelCount: 0, totalPixelCount: 0 };
  }

  const { data, info } = await sharp(parsed.buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const channels = info.channels;
  const pixelCount = width * height;
  if (!width || !height || channels !== 4 || !pixelCount) {
    return { imageUrl, removed: false, transparentPixelCount: 0, totalPixelCount: pixelCount };
  }

  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let readIndex = 0;
  let writeIndex = 0;

  const tryQueue = (pixelIndex: number) => {
    if (visited[pixelIndex]) return;
    const offset = pixelIndex * channels;
    if (!isRemovableBackgroundPixel(data, offset)) return;
    visited[pixelIndex] = 1;
    queue[writeIndex] = pixelIndex;
    writeIndex += 1;
  };

  for (let x = 0; x < width; x += 1) {
    tryQueue(x);
    tryQueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    tryQueue(y * width);
    tryQueue(y * width + width - 1);
  }

  while (readIndex < writeIndex) {
    const pixelIndex = queue[readIndex];
    readIndex += 1;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    if (x > 0) tryQueue(pixelIndex - 1);
    if (x + 1 < width) tryQueue(pixelIndex + 1);
    if (y > 0) tryQueue(pixelIndex - width);
    if (y + 1 < height) tryQueue(pixelIndex + width);
  }

  if (writeIndex === 0) {
    return { imageUrl, removed: false, transparentPixelCount: 0, totalPixelCount: pixelCount };
  }

  for (let index = 0; index < pixelCount; index += 1) {
    if (visited[index]) {
      data[index * channels + 3] = 0;
    }
  }

  const png = await sharp(data, {
    raw: {
      width,
      height,
      channels,
    },
  })
    .png()
    .toBuffer();

  return {
    imageUrl: `data:image/png;base64,${png.toString('base64')}`,
    removed: true,
    transparentPixelCount: writeIndex,
    totalPixelCount: pixelCount,
  };
}
