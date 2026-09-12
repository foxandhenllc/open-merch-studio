import { CollectionOrderingControl } from './CollectionOrderingControl';
import { useEffect, useState } from 'react';
import type {
  CollectionDraft,
  CollectionReview,
  CollectionPublicationState,
  ArtworkLibrary,
  PrintWidth,
} from '@open-merch-studio/collection-drafts';
import type { AdminRequest, AdminBinaryRequest } from './admin.types';
import { PrivateArtworkPreview } from './PrivateArtworkPreview';
import './collection-publication.css';
import { CollectionPrintLayouts } from './CollectionPrintLayouts';
import { CollectionSalesReadiness } from './CollectionSalesReadiness';

export function CollectionPublicationPanel({
  collection,
  revision,
  dirty,
  library,
  request,
  readArtwork,
  working,
}: {
  collection?: CollectionDraft;
  revision: number;
  dirty: boolean;
  library: ArtworkLibrary | null;
  request: AdminRequest;
  readArtwork: AdminBinaryRequest;
  working: (value: boolean) => void;
}) {
  const [status, setStatus] = useState<CollectionPublicationState | null>(null);
  const [widths, setWidths] = useState<Record<string, string>>({});
  const [review, setReview] = useState<CollectionReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmWithdraw, setConfirmWithdraw] = useState('');
  const [approvals, setApprovals] = useState([false, false, false]);
  async function refresh() {
    try {
      setStatus(await request<CollectionPublicationState>('/collection-publications'));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Publication status is unavailable.');
    }
  }
  useEffect(() => {
    let active = true;
    void request<CollectionPublicationState>('/collection-publications')
      .then((value) => {
        if (active) setStatus(value);
      })
      .catch(() => {
        if (active) setError('Publication status is unavailable. Refresh to retry.');
      });
    return () => {
      active = false;
    };
  }, [request]);
  useEffect(() => {
    setReview(null);
    setApprovals([false, false, false]);
    setError('');
    setNotice('');
  }, [collection, revision]);
  const keyFor = (itemId: string, code: string) => `${itemId}:${code}`;
  const printWidths = (): PrintWidth[] =>
    (collection?.items ?? []).flatMap((item) =>
      item.placementCodes.map((placementCode) => ({
        itemId: item.id,
        placementCode,
        widthInches: Number(widths[keyFor(item.id, placementCode)]),
      }))
    );
  async function act(action: 'review' | 'publish' | 'withdraw', id = collection?.id) {
    if (!id || (action !== 'withdraw' && dirty)) return;
    setBusy(true);
    working(true);
    setError('');
    setNotice('');
    try {
      if (action === 'review') {
        setReview(null);
        setApprovals([false, false, false]);
        const report = await request<CollectionReview>(
          `/collection-publications/${id}/review`,
          'POST',
          { draftRevision: revision, printWidths: printWidths() }
        );
        setReview(report);
      } else if (action === 'publish' && review && status) {
        await request(`/collection-publications/${id}/publish`, 'POST', {
          draftRevision: revision,
          publicationRevision: status.revision,
          digest: review.digest,
          printWidths: printWidths(),
          templateConfirmed: approvals[0],
          contentConfirmed: approvals[1],
          publicPreviewConfirmed: approvals[2],
        });
        setReview(null);
        setApprovals([false, false, false]);
        setNotice('Collection preview published. Ordering remains unavailable from this page.');
        await refresh();
      } else if (action === 'withdraw' && status) {
        await request(`/collection-publications/${id}/withdraw`, 'POST', {
          publicationRevision: status.revision,
        });
        setConfirmWithdraw('');
        setNotice('Collection withdrawn. Its public page and preview images are no longer served.');
        await refresh();
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The collection could not be updated.');
    } finally {
      setBusy(false);
      working(false);
    }
  }
  return (
    <section className="collection-publication" aria-label="Collection publication">
      <div className="collection-row-heading">
        <h2>Review & publish</h2>
        <button type="button" disabled={busy} onClick={() => void refresh()}>
          Refresh publication status
        </button>
      </div>
      <p>
        Publish a public collection preview after reviewing its artwork. Ordering from these pages
        is still being built.
      </p>
      {error && (
        <p className="admin-message admin-message--error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="admin-message admin-message--success" role="status">
          {notice}
        </p>
      )}
      {collection && (
        <fieldset disabled={busy || dirty} className="collection-review-fields">
          <legend>Print size for {collection.title}</legend>
          {dirty && <p>Save your drafts before reviewing this collection.</p>}
          <p className="admin-fine">
            Use the intended artwork width from the selected product’s template. Height follows the
            original proportions. This plan does not position or crop a production file.
          </p>
          {collection.items.map((item) => (
            <div className="collection-print-plan" key={item.id}>
              <h3>{item.title}</h3>
              {item.placementCodes.map((code) => {
                const asset = library?.assets.find(
                  (entry) =>
                    entry.id ===
                    item.artwork?.find((binding) => binding.placementCode === code)?.assetId
                );
                return (
                  <label key={code}>
                    Intended print width · {item.title} · {code} (inches)
                    <input
                      type="number"
                      min="0.25"
                      max="48"
                      step="0.01"
                      value={widths[keyFor(item.id, code)] ?? ''}
                      onChange={(event) => {
                        setWidths((value) => ({
                          ...value,
                          [keyFor(item.id, code)]: event.target.value,
                        }));
                        setReview(null);
                        setApprovals([false, false, false]);
                      }}
                    />
                    <small>
                      {asset?.width
                        ? `${asset.width} × ${asset.height}px original · up to ${(asset.width / 300).toFixed(2)} inches wide at 300 pixels per inch`
                        : 'Attach artwork to this area first.'}
                    </small>
                  </label>
                );
              })}
            </div>
          ))}
          <button
            type="button"
            className="admin-primary"
            disabled={!collection.items.length || !status}
            onClick={() => void act('review')}
          >
            {busy ? 'Checking…' : 'Review saved collection'}
          </button>
          {review && (
            <div className="collection-review-result" aria-label="Print review result">
              <h3>
                {review.ready ? 'Ready for your review' : 'Resolve these items before publishing'}
              </h3>
              {!!review.issues.length && (
                <ul>
                  {review.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}
              {review.areas.map((area) => (
                <div
                  className="collection-review-area"
                  key={keyFor(area.itemId, area.placementCode)}
                >
                  <PrivateArtworkPreview
                    id={area.assetId}
                    filename={area.filename}
                    readArtwork={readArtwork}
                  />
                  <div>
                    <strong>{area.label}</strong>
                    <p>
                      {area.widthInches} × {area.heightInches} in · {area.pixelsPerInch} pixels per
                      inch
                    </p>
                    <p>
                      {review.products.find((item) => item.itemId === area.itemId)?.variantName}
                    </p>
                    {area.warning && <p>{area.warning}</p>}
                  </div>
                </div>
              ))}
              {review.ready && (
                <>
                  {[
                    'I checked the file template, size, placement, bleed, and colors for each selected product variant.',
                    'I reviewed the content and have permission to reproduce this artwork on merchandise.',
                    'I approve making these artwork previews and collection details publicly visible.',
                  ].map((label, index) => (
                    <label className="collection-artwork-consent" key={label}>
                      <input
                        type="checkbox"
                        checked={approvals[index]}
                        onChange={(event) =>
                          setApprovals((values) =>
                            values.map((value, position) =>
                              position === index ? event.target.checked : value
                            )
                          )
                        }
                      />
                      {label}
                    </label>
                  ))}
                  <button
                    type="button"
                    className="admin-primary"
                    disabled={!approvals.every(Boolean)}
                    onClick={() => void act('publish')}
                  >
                    Publish collection preview
                  </button>
                </>
              )}
            </div>
          )}
        </fieldset>
      )}
      <div className="collection-published-list">
        <h3>Published collection previews</h3>
        {status?.publications.length === 0 && <p>No collection previews are public yet.</p>}
        {status?.publications.map((entry) => (
          <div key={`${entry.id}:${entry.version}`} className="collection-published-entry">
            <div className="collection-published-row">
              <div>
                <a href={entry.url} target="_blank" rel="noreferrer">
                  {entry.title}
                </a>
                <p>
                  Version {entry.version} · saved draft revision {entry.draftRevision}
                </p>
              </div>
              {confirmWithdraw === entry.id ? (
                <div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act('withdraw', entry.id)}
                  >
                    Confirm withdrawal
                  </button>
                  <button type="button" onClick={() => setConfirmWithdraw('')}>
                    Keep published
                  </button>
                </div>
              ) : (
                <button type="button" disabled={busy} onClick={() => setConfirmWithdraw(entry.id)}>
                  Withdraw preview
                </button>
              )}
            </div>
            <CollectionSalesReadiness publication={entry} request={request} />
            <CollectionOrderingControl publication={entry} request={request} changed={refresh} />
            <CollectionPrintLayouts
              publication={entry}
              request={request}
              readArtwork={readArtwork}
              changed={refresh}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
