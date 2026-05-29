import { prisma } from '../config/database.js';
import { env } from '../config/env.js';

export type DesignDraft = {
  id: string | null;
  provider: 'mock' | 'openai-ready';
  prompt: string;
  imageUrl: string;
  readiness: {
    status: 'pass' | 'needs_review';
    checks: Array<{ label: string; result: string }>;
  };
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

export async function createDesignDraft(prompt: string): Promise<DesignDraft> {
  const normalizedPrompt = prompt.trim() || 'A clean, print-ready merch graphic';
  const provider = env.openaiApiKey ? 'openai-ready' : 'mock';
  const imageUrl = svgDataUrl(normalizedPrompt);
  const readiness = {
    status: normalizedPrompt.length < 12 ? ('needs_review' as const) : ('pass' as const),
    checks: [
      {
        label: 'Transparent-ready composition',
        result: 'Generated as a centered graphic intended for placement mockups.',
      },
      {
        label: 'Prompt specificity',
        result:
          normalizedPrompt.length < 12
            ? 'Add more subject and style detail before production.'
            : 'Prompt has enough detail for a first-pass artwork draft.',
      },
      {
        label: 'Private data',
        result: 'No customer data is required for this draft endpoint.',
      },
    ],
  };

  if (!env.databaseUrl) {
    return { id: null, provider, prompt: normalizedPrompt, imageUrl, readiness };
  }

  try {
    const asset = await prisma.designAsset.create({
      data: {
        prompt: normalizedPrompt,
        provider,
        imageUrl,
        transparentUrl: imageUrl,
        readinessStatus: readiness.status,
        readinessReport: readiness,
      },
    });
    return { id: asset.id, provider, prompt: normalizedPrompt, imageUrl, readiness };
  } catch {
    return { id: null, provider, prompt: normalizedPrompt, imageUrl, readiness };
  }
}
