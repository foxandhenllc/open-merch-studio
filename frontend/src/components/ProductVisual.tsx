import { useEffect, useState, type CSSProperties } from 'react';
import type { ProductVisualProps } from './ProductVisual.types';

function Silhouette({
  category,
  orientation,
}: {
  category?: string | null;
  orientation?: ProductVisualProps['orientation'];
}) {
  const key = category || 'apparel';
  if (key === 'hats')
    return (
      <path d="M26 47c4-14 14-21 30-21 15 0 25 8 29 24-17-2-36 1-59 8-4 1-7-1-7-4 0-3 2-5 7-7Z" />
    );
  if (key === 'drinkware')
    return (
      <path d="M27 25h47v51c0 8-6 14-14 14H41c-8 0-14-6-14-14V25Zm47 12h8c11 0 18 7 18 18s-7 19-18 19h-8V63h7c5 0 8-3 8-8s-3-8-8-8h-7V37Z" />
    );
  if (key === 'wall-art') {
    if (orientation === 'square')
      return <path d="M20 20h80v80H20V20Zm10 10v60h60V30H30Zm8 49 15-18 10 10 10-14 12 22H38Z" />;
    if (orientation === 'portrait')
      return <path d="M31 13h58v94H31V13Zm9 10v74h40V23H40Zm5 60 12-16 9 10 8-13 6 19H45Z" />;
    return <path d="M13 31h94v58H13V31Zm10 9v40h74V40H23Zm10 32 18-17 12 10 12-14 13 21H33Z" />;
  }
  if (key === 'bags')
    return (
      <path d="M26 40h68l-5 58H31l-5-58Zm20 0c0-15 6-23 14-23s14 8 14 23H64c0-9-2-13-4-13s-4 4-4 13H46Z" />
    );
  if (key === 'stickers')
    return (
      <path d="M60 14c25 0 46 20 46 46s-21 46-46 46S14 85 14 60s21-46 46-46Zm18 31L54 73 42 62l-7 8 20 18 31-36-8-7Z" />
    );
  if (key === 'phone-cases')
    return (
      <path d="M39 13h42c8 0 14 6 14 14v66c0 8-6 14-14 14H39c-8 0-14-6-14-14V27c0-8 6-14 14-14Zm6 10a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z" />
    );
  if (key === 'stationery')
    return (
      <path d="M30 16h65v88H30V16Zm11 13v62h41V29H41ZM22 24h8v8h-8v-8Zm0 20h8v8h-8v-8Zm0 20h8v8h-8v-8Zm0 20h8v8h-8v-8Z" />
    );
  return <path d="m39 17 21 9 21-9 21 19-14 18-9-7v58H41V47l-9 7-14-18 21-19Z" />;
}

export function ProductVisual({
  category,
  title,
  color,
  imageUrl,
  orientation,
  size = 'compact',
}: ProductVisualProps) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [imageUrl]);
  const showImage = Boolean(imageUrl && !imageFailed);
  return (
    <div
      className={`product-visual product-visual--${size} ${orientation ? `is-${orientation}` : ''}`}
      style={{ '--swatch': color || '#d7d8d2' } as CSSProperties}
      aria-label={`${title} product preview`}
      role="img"
    >
      {showImage ? (
        <img
          key={imageUrl}
          className="product-visual__asset"
          src={imageUrl ?? ''}
          alt=""
          onError={() => setImageFailed(true)}
        />
      ) : (
        <svg
          key={`${category}-${orientation ?? 'default'}-${color ?? 'default'}`}
          className="product-visual__asset"
          viewBox="0 0 120 120"
          aria-hidden="true"
        >
          <Silhouette category={category} orientation={orientation} />
        </svg>
      )}
    </div>
  );
}
