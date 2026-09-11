import { useState } from 'react';
import type { ArtworkLibrary } from '@open-merch-studio/collection-drafts';
import type { AdminRequest } from './admin.types';

export function CollectionArtworkLibrary({
  library,
  request,
  refresh,
}: {
  library: ArtworkLibrary;
  request: AdminRequest;
  refresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState('');
  async function remove(id: string) {
    setBusy(true);
    setError('');
    try {
      await request(`/collection-artwork/${id}`, 'DELETE');
      setConfirmId('');
      await refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The file could not be removed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="collection-library">
      <summary>Private artwork library · {library.assets.length}/100</summary>
      <p>
        Files remain private until removed. Detaching a file keeps it here for reuse. Save detached
        drafts before removing a file.
      </p>
      {!library.available && (
        <p className="admin-message">
          Connect the database and private artwork storage to enable uploads.
        </p>
      )}
      {error && (
        <p className="admin-message admin-message--error" role="alert">
          {error}
        </p>
      )}
      <button type="button" disabled={busy} onClick={() => void refresh()}>
        Refresh artwork library
      </button>
      <ul>
        {library.assets.map((asset) => (
          <li key={asset.id}>
            <div>
              <strong>{asset.filename}</strong>
              <span>
                {asset.status === 'complete'
                  ? 'Prepared · private'
                  : asset.status === 'uploading'
                    ? 'Upload awaiting preparation'
                    : 'Removed from use · storage cleanup pending'}
              </span>
              {asset.removeAfter && (
                <p>
                  Cleanup can finish after {new Date(asset.removeAfter).toLocaleString()}. Finish
                  removal after that time to clear any late upload.
                </p>
              )}
              {asset.status === 'deleting' && !asset.removeAfter && (
                <p>
                  Upload authorization is unconfirmed. Refresh the library; if this remains, ask
                  your operator to check storage before final removal.
                </p>
              )}
            </div>
            {confirmId === asset.id ? (
              <div className="collection-row-actions">
                <button type="button" disabled={busy} onClick={() => void remove(asset.id)}>
                  Confirm file removal
                </button>
                <button type="button" onClick={() => setConfirmId('')}>
                  Keep file
                </button>
              </div>
            ) : (
              <button type="button" disabled={busy} onClick={() => setConfirmId(asset.id)}>
                {asset.status === 'deleting' ? 'Finish removal' : 'Remove file'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
