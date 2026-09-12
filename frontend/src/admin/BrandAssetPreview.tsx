import { useEffect, useState } from 'react';
import type { AdminBinaryRequest } from './admin.types';

export function BrandAssetPreview({
  path,
  label,
  readFile,
}: {
  path: string;
  label: string;
  readFile: AdminBinaryRequest;
}) {
  const [preview, setPreview] = useState<{ path: string; url: string } | null>(null);
  const [failed, setFailed] = useState('');
  const [attempt, setAttempt] = useState(0);
  const managed = /^\/api\/brand-assets\/([a-f0-9]{64})\.png$/.exec(path);
  const hash = managed?.[1];
  useEffect(() => {
    if (!hash) return;
    let active = true;
    let url: string | undefined;
    setFailed('');
    readFile(`/brand-assets/${hash}/preview`)
      .then((blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setPreview({ path, url });
      })
      .catch(() => {
        if (active) setFailed(path);
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path, hash, readFile, attempt]);
  if (!path) return <span className="admin-fine">No image added</span>;
  if (hash && preview?.path !== path)
    return failed === path ? (
      <div role="status">
        {label} preview unavailable.{' '}
        <button type="button" onClick={() => setAttempt(attempt + 1)}>
          Retry image preview
        </button>
      </div>
    ) : (
      <span role="status">Loading {label.toLowerCase()}…</span>
    );
  return <img className="brand-asset-preview" src={hash ? preview!.url : path} alt={label} />;
}
