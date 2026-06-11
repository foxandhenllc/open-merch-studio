import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { removeEdgeBackgroundFromImageUrl } from '../services/background-removal.service.js';

function imageDataUrl(buffer: Buffer): string {
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

function bufferFromDataUrl(imageUrl: string): Buffer {
  const payload = imageUrl.split(',')[1];
  if (!payload) throw new Error('Missing data URL payload.');
  return Buffer.from(payload, 'base64');
}

test('removeEdgeBackgroundFromImageUrl makes edge-connected light background transparent', async () => {
  const width = 4;
  const height = 4;
  const raw = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    raw[index * 4] = 246;
    raw[index * 4 + 1] = 246;
    raw[index * 4 + 2] = 246;
    raw[index * 4 + 3] = 255;
  }
  for (const pixelIndex of [5, 6, 9, 10]) {
    raw[pixelIndex * 4] = 8;
    raw[pixelIndex * 4 + 1] = 8;
    raw[pixelIndex * 4 + 2] = 8;
  }

  const inputPng = await sharp(raw, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
  const cleaned = await removeEdgeBackgroundFromImageUrl(imageDataUrl(inputPng));
  const { data } = await sharp(bufferFromDataUrl(cleaned.imageUrl))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  assert.equal(cleaned.removed, true);
  assert.equal(data[3], 0);
  assert.equal(data[5 * 4 + 3], 255);
  assert.equal(data[10 * 4 + 3], 255);
  assert.equal(data[15 * 4 + 3], 0);
});
