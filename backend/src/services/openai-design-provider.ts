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

export function supportsTransparentBackground(model: string): boolean {
  return !/^gpt-image-2(?:-|$)/i.test(model);
}

function detectTextIntent(prompt: string): boolean {
  return (
    prompt.includes('"') ||
    prompt.includes("'") ||
    /\b(says|say|text|quote|quoted|caption|wording|words|letters|typography|font)\b/i.test(prompt)
  );
}

export function normalizePromptForPrint(prompt: string): string {
  return String(prompt || '')
    .replace(
      /\b(on|for)\s+(a|the)\s+(t\s*-?\s*shirt|tshirt|tee\s*-?\s*shirt|tee|shirt|hoodie|sweatshirt|mug|poster|sticker|tote|bag|hat|cap|phone case)\b/gi,
      ''
    )
    .replace(
      /\b(t\s*-?\s*shirt|tshirt|tee\s*-?\s*shirt|tee|shirt|hoodie|sweatshirt|mug|poster|sticker|tote|bag|hat|cap|phone case|mockup|mannequin|hanger)\b/gi,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildPrintReadyPrompt(prompt: string, model = env.openaiDesignModel): string {
  const cleaned = normalizePromptForPrint(prompt) || prompt;
  const expectsText = detectTextIntent(prompt);
  const textGuidance = expectsText
    ? 'If lettering is requested, keep text short, legible, correctly spelled, and high contrast.'
    : 'Do not add words, slogans, signatures, logos, or random typography unless requested.';

  return [
    cleaned,
    'Create one original print-ready merchandise graphic, not a product photo or mockup.',
    supportsTransparentBackground(model)
      ? 'Use a centered composition, transparent background, strong silhouette, and simple readable shapes.'
      : 'Use a centered composition, isolated subject, strong silhouette, simple readable shapes, and a plain background that can be removed cleanly.',
    'Avoid brand logos, celebrities, protected characters, private data, watermarks, tiny unreadable text, and photographic backgrounds.',
    textGuidance,
  ].join(' ');
}

async function assertPromptAllowed(client: OpenAI, prompt: string): Promise<void> {
  const moderation = await client.moderations.create({
    model: 'omni-moderation-latest',
    input: prompt,
  });
  const result = moderation.results?.[0];
  if (result?.flagged) {
    const categories = Object.entries(result.categories ?? {})
      .filter(([, value]) => value)
      .map(([key]) => key);
    throw new Error(
      `OpenAI moderation blocked this prompt${categories.length ? ` (${categories.join(', ')})` : ''}.`
    );
  }
}

export async function generateDesignImage(params: {
  prompt: string;
  sessionId: string;
  qualityTier: 'rough' | 'final';
}): Promise<GeneratedDesignImage> {
  if (!canUseLiveOpenAi()) {
    return createMockDesignImage(params.prompt);
  }

  const client = new OpenAI({
    apiKey: env.openaiApiKey,
    organization: env.openaiOrganizationId,
    project: env.openaiProjectId,
  });
  const quality = params.qualityTier === 'final' ? 'high' : 'low';
  const finalPrompt = buildPrintReadyPrompt(params.prompt, env.openaiDesignModel);
  await assertPromptAllowed(client, finalPrompt);
  const response = await client.images.generate({
    model: env.openaiDesignModel,
    prompt: finalPrompt,
    n: 1,
    size: '1024x1024',
    quality,
    background: supportsTransparentBackground(env.openaiDesignModel) ? 'transparent' : 'auto',
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
    revisedPrompt: image?.revised_prompt ?? finalPrompt,
    estimatedCostCents: params.qualityTier === 'final' ? 36 : 6,
  };
}

export function dataUrlToBuffer(imageUrl: string): { buffer: Buffer; contentType: string } | null {
  const match = imageUrl.match(/^data:([^;,]+)(?:;charset=[^;,]+)?(;base64)?,(.+)$/i);
  if (!match) return null;
  const isBase64 = Boolean(match[2]);
  const payload = match[3];
  return {
    contentType: match[1],
    buffer: isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload)),
  };
}
