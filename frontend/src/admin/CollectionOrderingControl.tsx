import { useEffect, useState } from 'react';
import type { CollectionPublicationSummary } from '@open-merch-studio/collection-drafts';
import type { AdminRequest } from './admin.types';

export function CollectionOrderingControl({
  publication,
  request,
  changed,
}: {
  publication: CollectionPublicationSummary;
  request: AdminRequest;
  changed: () => Promise<void>;
}) {
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    setReviewed(false);
  }, [publication.layoutRevision, publication.version]);
  async function save(enabled: boolean) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await request<{ enabled: boolean; commerceMode: string }>(
        `/collection-publications/${publication.id}/sales`,
        'POST',
        {
          version: publication.version,
          layoutRevision: publication.layoutRevision ?? 0,
          enabled,
          reviewed,
        }
      );
      await changed();
      setReviewed(false);
      setNotice(
        !result.enabled
          ? 'Collection ordering paused. Existing paid orders remain available for review.'
          : result.commerceMode === 'paused'
            ? 'Collection approved for ordering. Store checkout is still paused in installation settings.'
            : result.commerceMode === 'fixture'
              ? 'Collection ordering enabled in fixture mode. Checkout is simulated.'
              : 'Collection ordering enabled. Paid orders require production review.'
      );
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'Ordering settings could not be saved.'
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="collection-ordering-control" aria-label={`Ordering for ${publication.title}`}>
      <h4>Collection ordering</h4>
      <p>
        {publication.salesEnabled
          ? 'This collection is approved for ordering under your store checkout settings.'
          : 'Review sales readiness and every product price and print layout before opening this collection.'}
      </p>
      {!publication.salesEnabled && (
        <label>
          <input
            type="checkbox"
            checked={reviewed}
            disabled={busy}
            onChange={(event) => setReviewed(event.target.checked)}
          />{' '}
          I reviewed the published prices and saved print layouts.
        </label>
      )}
      <button
        type="button"
        disabled={busy || (!publication.salesEnabled && !reviewed)}
        onClick={() => void save(!publication.salesEnabled)}
      >
        {busy
          ? 'Saving ordering settings…'
          : publication.salesEnabled
            ? 'Pause collection ordering'
            : 'Enable collection ordering'}
      </button>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
