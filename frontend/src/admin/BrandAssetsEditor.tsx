import { useEffect, useState } from 'react';
import type { ArtworkLibrary, CollectionArtwork } from '@open-merch-studio/collection-drafts';
import type { AdminBinaryRequest, AdminRequest } from './admin.types';
import { CollectionArtworkSlot } from './CollectionArtworkSlot';
import { BrandAssetPreview } from './BrandAssetPreview';
import './brand-assets.css';

function BrandSlot({
  kind,
  library,
  request,
  readFile,
  path,
  background,
  change,
  uploaded,
  working,
}: {
  kind: 'logo' | 'share';
  library: ArtworkLibrary;
  request: AdminRequest;
  readFile: AdminBinaryRequest;
  path: string;
  background: string;
  change: (path: string) => void;
  uploaded: (asset: CollectionArtwork) => void;
  working: (busy: boolean) => void;
}) {
  const [source, setSource] = useState<string>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const label = kind === 'logo' ? 'Store logo' : 'Sharing image';
  async function prepare() {
    if (!source) return;
    setBusy(true);
    working(true);
    setError('');
    try {
      const asset = await request<{ publicPath: string }>('/brand-assets', 'POST', {
        assetId: source,
        kind,
        background,
      });
      change(asset.publicPath);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'The brand image could not be prepared.'
      );
    } finally {
      setBusy(false);
      working(false);
    }
  }
  return (
    <section className={`brand-asset-slot brand-asset-slot--${kind}`} aria-label={label}>
      <h3>{label}</h3>
      <BrandAssetPreview path={path} label={`${label} draft`} readFile={readFile} />
      <p>
        {kind === 'logo'
          ? 'A 512 × 512 logo with transparent padding. Your image fits without cropping.'
          : 'A 1200 × 630 image for shared links, padded with your store background color.'}
      </p>
      <details>
        <summary>Choose or upload {kind === 'logo' ? 'a logo' : 'a sharing image'}</summary>
        <CollectionArtworkSlot
          label={label}
          assetId={source}
          library={library}
          request={request}
          readArtwork={readFile}
          assign={setSource}
          uploaded={uploaded}
          working={working}
        />
        {error && <p role="alert">{error}</p>}
        <button
          className="admin-secondary"
          type="button"
          disabled={!source || busy}
          onClick={() => void prepare()}
        >
          {busy ? 'Preparing image…' : `Use as ${label.toLowerCase()}`}
        </button>
      </details>
    </section>
  );
}

export function BrandAssetsEditor({
  request,
  readFile,
  fields,
  change,
  working,
}: {
  request: AdminRequest;
  readFile: AdminBinaryRequest;
  fields: Record<string, string>;
  change: (field: string, path: string) => void;
  working: (busy: boolean) => void;
}) {
  const [library, setLibrary] = useState<ArtworkLibrary | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    request<ArtworkLibrary>('/collection-artwork')
      .then((value) => {
        if (active) setLibrary(value);
      })
      .catch(() => {
        if (active) setError('Your private image library could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, [request, attempt]);
  if (!library)
    return (
      <div role="status">
        {error || 'Loading private brand images…'}
        {error && (
          <button type="button" onClick={() => setAttempt(attempt + 1)}>
            Retry image library
          </button>
        )}
      </div>
    );
  return (
    <div className="brand-assets-editor">
      <p>
        Prepare images privately, then save and review your profile. Only images in the deployed
        profile become public.
      </p>
      {(['logo', 'share'] as const).map((kind) => {
        const field = kind === 'logo' ? 'brand.logoPath' : 'brand.socialImagePath';
        return (
          <BrandSlot
            key={kind}
            kind={kind}
            library={library}
            request={request}
            readFile={readFile}
            path={fields[field]}
            background={fields['brand.colors.background']}
            change={(path) => change(field, path)}
            working={working}
            uploaded={(asset) =>
              setLibrary(
                (before) =>
                  before && {
                    ...before,
                    assets: [asset, ...before.assets.filter(({ id }) => id !== asset.id)],
                  }
              )
            }
          />
        );
      })}
    </div>
  );
}
