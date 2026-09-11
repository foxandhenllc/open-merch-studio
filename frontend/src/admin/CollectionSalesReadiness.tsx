import { useEffect, useState } from 'react';
import type {
  CollectionPublicationSummary,
  CollectionSalesReadiness as SalesReadiness,
} from '@open-merch-studio/collection-drafts';
import type { AdminRequest } from './admin.types';

export function CollectionSalesReadiness({
  publication,
  request,
}: {
  publication: CollectionPublicationSummary;
  request: AdminRequest;
}) {
  const [result, setResult] = useState<SalesReadiness | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setResult(null);
    setError('');
    setBusy(false);
    if (attempt) {
      setBusy(true);
      void request<SalesReadiness>(
        `/collection-publications/${publication.id}/sales-readiness`,
        'POST',
        { version: publication.version }
      )
        .then((value) => {
          if (active) setResult(value);
        })
        .catch((failure) => {
          if (active)
            setError(
              failure instanceof Error
                ? failure.message
                : 'Sales readiness is unavailable. Retry the check.'
            );
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    }
    return () => {
      active = false;
    };
  }, [publication.id, publication.version, request, attempt]);
  return (
    <div
      className="collection-sales-readiness"
      aria-label={`Sales readiness for ${publication.title}`}
    >
      <button type="button" disabled={busy} onClick={() => setAttempt((value) => value + 1)}>
        {busy ? 'Checking sales readiness…' : 'Check sales readiness'}
      </button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <div role="status">
          <h4>Sales readiness · version {result.version}</h4>
          <p>
            Ordering is not available yet. This check covers the published version, including any
            prices saved there.
          </p>
          <ul>
            {result.checks.map((check) => (
              <li key={check.id}>
                <strong>
                  {check.label} ·{' '}
                  {check.status === 'pass'
                    ? 'Checked'
                    : check.status === 'action_required'
                      ? 'Owner action'
                      : 'In development'}
                </strong>
                <p>{check.message}</p>
              </li>
            ))}
          </ul>
          {result.products.some((product) => !product.priceSpecified) && (
            <p>
              Missing prices:{' '}
              {result.products
                .filter((product) => !product.priceSpecified)
                .map((product) => product.title)
                .join(', ')}
              .
            </p>
          )}
        </div>
      )}
    </div>
  );
}
