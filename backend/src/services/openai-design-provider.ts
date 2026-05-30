import OpenAI from 'openai';
import { env } from '../config/env.js';

type GeneratedDesignImage = {
  provider: 'mock' | 'openai';
  imageUrl: string;
  revisedPrompt?: string;
  estimatedCostCents: number;
};

const svgDataUrl = (prompt: string): string => {
  const safePrompt = prompt.replace(/[<>&]/g, '').slice(0, 90);
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#f8fafc"/>
  <circle cx="512" cy="420" r="260" fill="#14b8a6" opacity="0.18"/>
  <path d="M250 582c100-165 425-165 525 0" fill="none" stroke="#111827" stroke-width="36" stroke-linecap="round"/>
  <text x="512" y="505" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="54" font-weight="700" fill="#111827">Open Merch</text>
  <text x="512" y="575" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="30" fill="#334155">${safePrompt}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export function createMockDesignImage(prompt: string): GeneratedDesignImage {
  return {
    provider: 'mock',
    imageUrl: svgDataUrl(prompt),
    estimatedCostCents: 1,
  };
}

export function canUseLiveOpenAi(): boolean {
  return Boolean(env.openaiApiKey && env.enableLiveOpenAi);
}

export async function generateDesignImage(params: {
  prompt: string;
  sessionId: string;
  qualityTier: 'rough' | 'final';
}): Promise<GeneratedDesignImage> {
  if (!canUseLiveOpenAi()) {
    return createMockDesignImage(params.prompt);
  }

  const client = new OpenAI({ apiKey: env.openaiApiKey });
  const quality = params.qualityTier === 'final' ? 'high' : 'low';
  const response = await client.images.generate({
    model: env.openaiDesignModel,
    prompt: [
      params.prompt,
      'Create original, rights-safe merchandise artwork with a transparent-ready centered composition.',
      'Avoid brand logos, celebrities, protected characters, private data, and tiny unreadable text.',
    ].join(' '),
    n: 1,
    size: '1024x1024',
    quality,
    background: 'transparent',
    output_format: 'png',
    moderation: 'auto',
    user: params.sessionId,
  });

  const image = response.data?.[0];
  const imageUrl = image?.b64_json ? `data:image/png;base64,${image.b64_json}` : (image?.url ?? '');

  if (!imageUrl) {
    throw new Error('OpenAI image generation did not return an image.');
  }

  return {
    provider: 'openai',
    imageUrl,
    revisedPrompt: image?.revised_prompt,
    estimatedCostCents: params.qualityTier === 'final' ? 36 : 6,
  };
}

export function dataUrlToBuffer(imageUrl: string): { buffer: Buffer; contentType: string } | null {
  const match = imageUrl.match(/^data:([^;,]+)(;base64)?,(.+)$/);
  if (!match) return null;
  const isBase64 = Boolean(match[2]);
  const payload = match[3];
  return {
    contentType: match[1],
    buffer: isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload)),
  };
}
