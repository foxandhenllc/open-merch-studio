import { env } from '../config/env.js';
import { dataUrlToBuffer, supportsTransparentBackground } from './openai-design-provider.js';

export type PrintPreparation = {
  imageUrl: string;
  transparentUrl?: string;
  status: 'transparent' | 'removed' | 'required' | 'failed';
  provider: 'openai' | 'remove-bg' | 'none';
  message: string;
};

export async function prepareArtworkForPrint(params: {
  imageUrl: string;
  model: string;
}): Promise<PrintPreparation> {
  if (supportsTransparentBackground(params.model)) {
    return {
      imageUrl: params.imageUrl,
      transparentUrl: params.imageUrl,
      status: 'transparent',
      provider: 'openai',
      message: 'The image model supplied a transparent PNG.',
    };
  }

  if (!env.removeBgApiKey) {
    return {
      imageUrl: params.imageUrl,
      status: 'required',
      provider: 'none',
      message:
        'Background removal is not configured. Add REMOVE_BG_API_KEY for a transparent print file.',
    };
  }

  try {
    const form = new FormData();
    form.set('size', 'auto');
    form.set('format', 'png');
    const decoded = dataUrlToBuffer(params.imageUrl);
    if (decoded) {
      form.set(
        'image_file',
        new Blob([new Uint8Array(decoded.buffer)], { type: decoded.contentType }),
        'generated-artwork.png'
      );
    } else {
      form.set('image_url', params.imageUrl);
    }
    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': env.removeBgApiKey },
      body: form,
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`remove.bg returned ${response.status}${detail ? `: ${detail}` : ''}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const transparentUrl = `data:image/png;base64,${buffer.toString('base64')}`;
    return {
      imageUrl: params.imageUrl,
      transparentUrl,
      status: 'removed',
      provider: 'remove-bg',
      message: 'Background removed and a transparent print file is ready.',
    };
  } catch (error) {
    return {
      imageUrl: params.imageUrl,
      status: 'failed',
      provider: 'remove-bg',
      message: error instanceof Error ? error.message : 'Background removal failed.',
    };
  }
}
