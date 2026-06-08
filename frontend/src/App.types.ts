export type PolicyRoute = {
  title: string;
  eyebrow: string;
  summary: string;
  sections: Array<{ heading: string; body: string }>;
};

export type ImageViewerState = {
  title: string;
  imageUrl: string;
  detail: string;
} | null;
