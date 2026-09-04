import type { PlacementLayout } from '../types/catalog.js';
import { env } from '../config/env.js';
import {
  createPrintfulClient,
  isPublicHttpUrl,
  unwrapPrintfulResponse,
} from './printful-client.service.js';

type PrintfulPrintfile = {
  printfile_id: number;
  width: number;
  height: number;
};

type PrintfulPrintfilesResult = {
  available_placements?: Record<string, string>;
  printfiles?: PrintfulPrintfile[];
  variant_printfiles?: Array<{
    variant_id: number;
    placements: Record<string, number>;
  }>;
};

type PrintfulMockupTaskCreateResult = {
  task_key?: string;
  status?: string;
};

type PrintfulMockupTaskResult = {
  task_key?: string;
  status?: 'pending' | 'completed' | 'failed';
  error?: string;
  mockups?: unknown[];
};

export type PrintfulMockupPlacement = {
  placement: string;
  designImageUrl: string;
  technique?: string;
  layout?: PlacementLayout;
};

export type PrintfulMockupView = { label: string; imageUrl: string };

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/**
 * Fits a square artwork file inside Printful's placement bounds without cropping it. Layout only
 * changes horizontal alignment; orientation first maps the provider's dimensions to the preview.
 */
function computeCenteredSquarePosition(
  printfile: PrintfulPrintfile,
  orientation?: 'portrait' | 'landscape' | 'square',
  layout: PlacementLayout = 'center'
) {
  const shouldSwap =
    (orientation === 'portrait' && printfile.width > printfile.height) ||
    (orientation === 'landscape' && printfile.height > printfile.width);
  const areaWidth = shouldSwap ? printfile.height : printfile.width;
  const areaHeight = shouldSwap ? printfile.width : printfile.height;
  const size = Math.min(areaWidth, areaHeight);

  const centeredLeft = Math.max(0, Math.round((areaWidth - size) / 2));
  const layoutLeft =
    layout === 'left'
      ? Math.max(0, Math.round(areaWidth * 0.08))
      : layout === 'right'
        ? Math.max(0, Math.round(areaWidth - size - areaWidth * 0.08))
        : centeredLeft;
  return {
    area_width: areaWidth,
    area_height: areaHeight,
    width: size,
    height: size,
    top: Math.max(0, Math.round((areaHeight - size) / 2)),
    left: layoutLeft,
  };
}

export function normalizePrintfulTechnique(technique?: string): string | undefined {
  if (!technique) return undefined;
  const normalized = technique.trim().toUpperCase().replace(/_/g, '-');
  const aliases: Record<string, string> = {
    DIGITAL: 'DIGITAL',
    DTG: 'DTG',
    SUBLIMATION: 'SUBLIMATION',
    EMBROIDERY: 'EMBROIDERY',
    UV: 'UV',
    ENGRAVING: 'ENGRAVING',
    'CUT-SEW': 'CUT-SEW',
    CUTSEW: 'CUT-SEW',
  };
  return aliases[normalized] ?? normalized;
}

export function buildPrintfulMockupPayload(params: {
  printfulVariantId: number;
  placement: string;
  designImageUrl: string;
  printfile: PrintfulPrintfile;
  orientation?: 'portrait' | 'landscape' | 'square';
  layout?: PlacementLayout;
}) {
  return {
    variant_ids: [params.printfulVariantId],
    format: 'png',
    files: [
      {
        placement: params.placement,
        image_url: params.designImageUrl,
        position: computeCenteredSquarePosition(
          params.printfile,
          params.orientation,
          params.layout
        ),
      },
    ],
  };
}

export function buildPrintfulMockupTaskPayload(params: {
  printfulVariantId: number;
  files: Array<{
    placement: string;
    image_url: string;
    position: {
      area_width: number;
      area_height: number;
      width: number;
      height: number;
      top: number;
      left: number;
    };
  }>;
}) {
  if (!params.files.length) throw new Error('A Printful mockup task requires at least one file.');
  return { variant_ids: [params.printfulVariantId], format: 'png', files: params.files };
}

async function fetchPrintfileForVariant(params: {
  client: ReturnType<typeof createPrintfulClient>;
  printfulProductId: string;
  printfulVariantId: number;
  placement: string;
  technique?: string;
}): Promise<PrintfulPrintfile> {
  const response = await params.client.get(
    `/mockup-generator/printfiles/${params.printfulProductId}`,
    {
      params: params.technique
        ? { technique: normalizePrintfulTechnique(params.technique) }
        : undefined,
    }
  );
  const result = unwrapPrintfulResponse<PrintfulPrintfilesResult>(response.data);
  const mapping = result.variant_printfiles?.find(
    (variant) => variant.variant_id === params.printfulVariantId
  );
  const printfileId = mapping?.placements?.[params.placement];
  if (!printfileId) {
    throw new Error(
      `Printful printfile mapping not found for variant ${params.printfulVariantId} placement ${params.placement}.`
    );
  }
  const printfile = result.printfiles?.find((candidate) => candidate.printfile_id === printfileId);
  if (!printfile) {
    throw new Error(`Printful printfile ${printfileId} was not found.`);
  }
  return printfile;
}

async function createPrintfulMockupTask(params: {
  client: ReturnType<typeof createPrintfulClient>;
  printfulProductId: string;
  printfulVariantId: number;
  placements: PrintfulMockupPlacement[];
  orientation?: 'portrait' | 'landscape' | 'square';
}): Promise<string> {
  const files = await Promise.all(
    params.placements.map(async (placement) => {
      const printfile = await fetchPrintfileForVariant({
        client: params.client,
        printfulProductId: params.printfulProductId,
        printfulVariantId: params.printfulVariantId,
        placement: placement.placement,
        technique: placement.technique,
      });
      return buildPrintfulMockupPayload({
        printfulVariantId: params.printfulVariantId,
        placement: placement.placement,
        designImageUrl: placement.designImageUrl,
        printfile,
        orientation: params.orientation,
        layout: placement.layout,
      }).files[0];
    })
  );
  const response = await params.client.post(
    `/mockup-generator/create-task/${params.printfulProductId}`,
    buildPrintfulMockupTaskPayload({ printfulVariantId: params.printfulVariantId, files })
  );
  const result = unwrapPrintfulResponse<PrintfulMockupTaskCreateResult>(response.data);
  if (!result.task_key) {
    throw new Error('Printful mockup task did not return a task key.');
  }
  return result.task_key;
}

/** Polls a created task within the deployment-configured provider timeout. */
async function pollPrintfulMockupTask(
  client: ReturnType<typeof createPrintfulClient>,
  taskKey: string
): Promise<PrintfulMockupTaskResult> {
  const timeoutMs = Math.max(30000, env.printfulMockupTimeoutMs);
  const start = Date.now();
  await sleep(10000);
  while (Date.now() - start < timeoutMs) {
    const response = await client.get('/mockup-generator/task', {
      params: { task_key: taskKey },
    });
    const result = unwrapPrintfulResponse<PrintfulMockupTaskResult>(response.data);
    if (result.status === 'completed') return result;
    if (result.status === 'failed') {
      throw new Error(result.error || 'Printful mockup generation failed.');
    }
    await sleep(5000);
  }
  throw new Error('Timed out waiting for Printful mockup generation.');
}

/**
 * Converts provider-specific mockup records into the small customer preview contract. For mugs,
 * front/center views are ranked ahead of side and handle-only angles so the art remains legible.
 */
export function extractMockupViews(
  taskResult: PrintfulMockupTaskResult,
  placement: string | string[],
  preferFrontView = false
): PrintfulMockupView[] {
  const mockups = Array.isArray(taskResult.mockups) ? taskResult.mockups : [];
  const candidates = mockups as Array<Record<string, unknown>>;
  const placements = new Set(Array.isArray(placement) ? placement : [placement]);
  const matches = candidates.filter((candidate) =>
    placements.has(String(candidate.placement ?? ''))
  );
  if (!matches.length && candidates[0]) matches.push(candidates[0]);
  const views: PrintfulMockupView[] = [];
  for (const match of matches) {
    const directUrl = match?.mockup_url ?? match?.mockupUrl ?? match?.url;
    if (typeof directUrl === 'string' && directUrl) {
      views.push({ label: String(match?.display_name ?? 'Product view'), imageUrl: directUrl });
    }
    const extra = Array.isArray(match?.extra)
      ? (match.extra as Array<Record<string, unknown>>)
      : [];
    for (const entry of extra) {
      if (typeof entry.url !== 'string' || !entry.url) continue;
      const title = String(entry.title ?? entry.option ?? 'Product view');
      const group = typeof entry.option_group === 'string' ? entry.option_group : '';
      views.push({ label: group ? `${title} · ${group}` : title, imageUrl: entry.url });
    }
  }
  const unique = Array.from(new Map(views.map((view) => [view.imageUrl, view])).values());
  if (!unique.length) throw new Error('Unable to extract Printful mockup URL.');
  if (!preferFrontView) return unique.slice(0, 5);
  const score = (view: PrintfulMockupView) => {
    const value = `${view.label} ${view.imageUrl}`.toLowerCase();
    return (
      (value.includes('front') ? 100 : 0) +
      (value.includes('center') ? 80 : 0) +
      (value.includes('straight') ? 40 : 0) -
      (value.includes('side') ? 60 : 0) -
      (value.includes('handle-on-right') || value.includes('handle-on-left') ? 30 : 0)
    );
  };
  return unique.sort((left, right) => score(right) - score(left)).slice(0, 5);
}

/** Creates and resolves a Printful mockup task without exposing provider response shapes. */
export async function generatePrintfulMockupPreview(params: {
  printfulProductId: string;
  printfulVariantId: number;
  placements: PrintfulMockupPlacement[];
  orientation?: 'portrait' | 'landscape' | 'square';
  preferFrontView?: boolean;
}): Promise<{
  taskKey: string;
  imageUrl: string;
  views: PrintfulMockupView[];
}> {
  if (!env.printfulApiKey || !env.enableLivePrintful) {
    throw new Error('Printful live mockups require PRINTFUL_API_KEY and ENABLE_LIVE_PRINTFUL.');
  }
  if (
    !params.placements.length ||
    params.placements.some((item) => !isPublicHttpUrl(item.designImageUrl))
  ) {
    throw new Error('Printful live mockups require a public HTTP(S) artwork URL.');
  }

  const client = createPrintfulClient();
  const taskKey = await createPrintfulMockupTask({ client, ...params });
  const taskResult = await pollPrintfulMockupTask(client, taskKey);
  const views = extractMockupViews(
    taskResult,
    params.placements.map((placement) => placement.placement),
    params.preferFrontView
  );
  return {
    taskKey,
    imageUrl: views[0].imageUrl,
    views,
  };
}
