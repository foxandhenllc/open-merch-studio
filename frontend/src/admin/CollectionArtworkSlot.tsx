import { useRef, useState } from 'react';
import type {
  ArtworkAuthorization,
  ArtworkLibrary,
  CollectionArtwork,
} from '@open-merch-studio/collection-drafts';
import type { AdminRequest, AdminBinaryRequest } from './admin.types';
import { PrivateArtworkPreview } from './PrivateArtworkPreview';
import './collection-artwork.css';

const fileDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('This file could not be read.'));
    reader.readAsDataURL(file);
  });
export function CollectionArtworkSlot({
  label,
  assetId,
  library,
  request,
  readArtwork,
  assign,
  uploaded,
  working,
}: {
  label: string;
  assetId?: string;
  library: ArtworkLibrary;
  request: AdminRequest;
  readArtwork: AdminBinaryRequest;
  assign: (id?: string) => void;
  uploaded: (asset: CollectionArtwork) => void;
  working: (value: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const authorization = useRef<{
    value: ArtworkAuthorization;
    sent: boolean;
    attempted: boolean;
  } | null>(null);
  const asset = library.assets.find(({ id }) => id === assetId);
  async function upload() {
    if (!file || !rights) return;
    setBusy(true);
    working(true);
    setError('');
    try {
      if (file.size > library.maxBytes)
        throw new Error(
          `Choose a file no larger than ${Math.floor(library.maxBytes / 1024 / 1024)} MB.`
        );
      if (!authorization.current)
        authorization.current = {
          value: await request<ArtworkAuthorization>('/collection-artwork/authorize', 'POST', {
            filename: file.name,
            contentType: file.type,
            byteSize: file.size,
            rightsConfirmed: true,
          }),
          sent: false,
          attempted: false,
        };
      const pending = authorization.current;
      const finish = () =>
        request<CollectionArtwork>(
          `/collection-artwork/${pending.value.assetId}/complete`,
          'POST',
          {}
        );
      let result: CollectionArtwork | undefined;
      // A lost upload response may still have stored the file. Try preparation before resending.
      if (pending.value.transport === 'signed' && pending.attempted && !pending.sent) {
        try {
          result = await finish();
        } catch {
          /* The original may not have arrived; retry the same signed path. */
        }
      }
      if (pending.value.transport === 'signed' && !pending.sent && !result) {
        pending.attempted = true;
        // The upload URL is short-lived and held only in memory. Never send the admin header to storage.
        const response = await fetch(pending.value.signedUrl!, {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (!response.ok) {
          // Includes a duplicate response after an earlier successful upload. Preparation validates bytes.
          try {
            result = await finish();
          } catch {
            throw new Error(
              'Private upload could not be confirmed. Retry preparation, or remove the pending file from the library and upload again.'
            );
          }
        } else pending.sent = true;
      }
      result ??= await request<CollectionArtwork>(
        `/collection-artwork/${pending.value.assetId}/complete`,
        'POST',
        pending.value.transport === 'inline' ? { inlineDataUrl: await fileDataUrl(file) } : {}
      );
      uploaded(result);
      assign(result.id);
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
      setRights(false);
      authorization.current = null;
    } catch (failure) {
      setError(
        failure instanceof TypeError
          ? 'The upload connection was interrupted. Retry preparation; the original may already be stored.'
          : failure instanceof Error
            ? failure.message
            : 'The artwork could not be attached.'
      );
    } finally {
      setBusy(false);
      working(false);
    }
  }
  return (
    <section className="collection-artwork-slot" aria-label={`${label} artwork`}>
      <h4>{label} artwork</h4>
      {asset?.status === 'complete' ? (
        <div className="collection-artwork-details">
          <PrivateArtworkPreview
            id={asset.id}
            filename={asset.filename}
            readArtwork={readArtwork}
          />
          <div>
            <strong>{asset.filename}</strong>
            <p>
              {asset.width} × {asset.height}px ·{' '}
              {asset.hasTransparency ? 'Contains transparency' : 'Original background preserved'}
            </p>
            <p className={asset.readiness === 'blocked' ? 'collection-artwork-blocked' : ''}>
              {asset.readinessMessage}
            </p>
            <button type="button" onClick={() => assign()}>
              Detach artwork
            </button>
          </div>
        </div>
      ) : (
        <p>
          {assetId
            ? 'This file is unavailable. Choose another file from the library.'
            : 'No artwork attached to this print area.'}
        </p>
      )}
      <label>
        Use a library file
        <select
          value={asset?.status === 'complete' ? asset.id : ''}
          onChange={(event) => assign(event.target.value || undefined)}
        >
          <option value="">Choose artwork</option>
          {library.assets
            .filter((entry) => entry.status === 'complete')
            .map((entry) => (
              <option value={entry.id} key={entry.id}>
                {entry.filename}
              </option>
            ))}
        </select>
      </label>
      <details>
        <summary>Upload an original image</summary>
        <p>
          PNG, JPEG, or WebP · up to {Math.floor(library.maxBytes / 1024 / 1024)} MB. The original
          is kept; preparation does not use AI or remove its background.
        </p>
        <label>
          Artwork file
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={!library.available}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setRights(false);
              setError('');
              authorization.current = null;
            }}
          />
        </label>
        <label className="collection-artwork-consent">
          <input
            type="checkbox"
            checked={rights}
            onChange={(event) => setRights(event.target.checked)}
          />
          I have permission to reproduce this artwork on merchandise.
        </label>
        {error && (
          <p role="alert" className="admin-message admin-message--error">
            {error}
          </p>
        )}
        <button
          type="button"
          className="admin-primary"
          disabled={!file || !rights || busy || !library.available}
          onClick={() => void upload()}
        >
          {busy
            ? 'Preparing artwork…'
            : authorization.current
              ? 'Retry preparation'
              : 'Upload and attach'}
        </button>
      </details>
    </section>
  );
}
