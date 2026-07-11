export type ProductVisualProps = {
  category?: string | null;
  title: string;
  color?: string | null;
  imageUrl?: string | null;
  orientation?: 'portrait' | 'landscape' | 'square';
  size?: 'compact' | 'stage';
};
