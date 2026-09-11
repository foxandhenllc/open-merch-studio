import { useEffect, useState } from 'react';
import type { AdminBinaryRequest } from './admin.types';

export function PrivateArtworkPreview({
  id,
  filename,
  readArtwork,
}: {
  id: string;
  filename: string;
  readArtwork: AdminBinaryRequest;
}) {
  const [source, setSource] = useState('');
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setSource('');
    setError(false);
    void readArtwork(`/collection-artwork/${id}/preview`)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, readArtwork, attempt]);
  return (
    <div className="collection-artwork-preview">
      {source ? (
        <img src={source} alt={`Private artwork: ${filename}`} />
      ) : (
        <span>
          {error ? 'Preview unavailable.' : 'Loading private preview…'}
          {error && (
            <button type="button" onClick={() => setAttempt((value) => value + 1)}>
              Retry preview
            </button>
          )}
        </span>
      )}
    </div>
  );
}
