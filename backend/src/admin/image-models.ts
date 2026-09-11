/** Reviewed Image API choices. Add capabilities deliberately when adding a model. */
export const imageModels = [
  {
    id: 'gpt-image-2',
    name: 'GPT Image 2',
    description: 'Established generation and editing. Uses separate background removal.',
    transparent: false,
    inputFidelity: false,
  },
  {
    id: 'gpt-image-2.5-flare',
    name: 'GPT Image 2.5 Flare',
    description: 'Fast everyday artwork and concepts, with transparent output.',
    transparent: true,
    inputFidelity: false,
  },
  {
    id: 'gpt-image-2.5-sunburst',
    name: 'GPT Image 2.5 Sunburst',
    description: 'Detailed artwork and precise revisions, with transparent output.',
    transparent: true,
    inputFidelity: false,
  },
] as const;

export type ImageModelId = (typeof imageModels)[number]['id'];

export function imageModelCapabilities(model: string) {
  const base = model.replace(/-\d{4}-\d{2}-\d{2}$/, '');
  return imageModels.find((candidate) => candidate.id === base);
}

/** Budget reservations, not advertised provider prices. Calibrate 2.5 after controlled evaluation. */
export function imageRequestEstimate(model: string, quality: 'rough' | 'final', editing = false) {
  if (/^gpt-image-2\.5-/.test(model)) return quality === 'final' ? 100 : 50;
  return quality === 'final' ? (editing ? 40 : 36) : editing ? 14 : 6;
}
