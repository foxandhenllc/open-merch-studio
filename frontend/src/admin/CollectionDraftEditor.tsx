import { useCallback, useEffect, useState } from 'react';
import {
  artworkModes,
  collectionPurposes,
  validateCollections,
  type CollectionDraft,
  type CollectionSnapshot,
  type ArtworkLibrary,
  type CollectionArtwork,
} from '@open-merch-studio/collection-drafts';
import type { AdminRequest, AdminBinaryRequest } from './admin.types';
import { CollectionProductEditor, initialProduct } from './CollectionProductEditor';
import './collections.css';
import { CollectionArtworkLibrary } from './CollectionArtworkLibrary';
import { CollectionPublicationPanel } from './CollectionPublicationPanel';

export function CollectionDraftEditor({
  request,
  readArtwork,
}: {
  request: AdminRequest;
  readArtwork: AdminBinaryRequest;
}) {
  const [library, setLibrary] = useState<ArtworkLibrary | null>(null);
  const [artworkBusy, setArtworkBusy] = useState(false);
  const [saved, setSaved] = useState<CollectionSnapshot | null>(null);
  const [collections, setCollections] = useState<CollectionDraft[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const dirty = saved !== null && JSON.stringify(collections) !== JSON.stringify(saved.collections);
  const selected = collections.find(({ id }) => id === selectedId);
  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const [result, artwork] = await Promise.all([
        request<CollectionSnapshot>('/collections'),
        request<ArtworkLibrary>('/collection-artwork'),
      ]);
      setLibrary(artwork);
      setSaved(result);
      setCollections(result.collections);
      setSelectedId((current) =>
        result.collections.some(({ id }) => id === current)
          ? current
          : (result.collections[0]?.id ?? '')
      );
      setConfirmReload(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Collection drafts are unavailable.');
    } finally {
      setBusy(false);
    }
  }, [request]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function refreshLibrary() {
    try {
      setLibrary(await request<ArtworkLibrary>('/collection-artwork'));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The artwork library is unavailable.');
    }
  }
  function artworkUploaded(asset: CollectionArtwork) {
    setLibrary((current) =>
      current
        ? { ...current, assets: [...current.assets.filter(({ id }) => id !== asset.id), asset] }
        : current
    );
  }
  const changed = () => {
    setNotice('');
    setError('');
    setConfirmReload(false);
  };
  function update(next: CollectionDraft) {
    setCollections((current) => current.map((entry) => (entry.id === next.id ? next : entry)));
    changed();
  }
  function add() {
    const next: CollectionDraft = {
      id: crypto.randomUUID(),
      title: 'Untitled collection',
      description: '',
      purpose: 'everyday',
      items: [],
    };
    setCollections((current) => [...current, next]);
    setSelectedId(next.id);
    setPreview(false);
    changed();
  }
  async function save() {
    if (!saved || busy || artworkBusy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const normalized = validateCollections(collections);
      const result = await request<CollectionSnapshot>('/collections', 'PUT', {
        collections: normalized,
        revision: saved.revision,
      });
      setSaved(result);
      setCollections(result.collections);
      setNotice(
        result.storage === 'fixture'
          ? 'Drafts saved for this local server session. Nothing was published.'
          : 'Private collection drafts saved. Nothing was published.'
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Drafts could not be saved.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="collection-workspace">
      <header className="admin-page-heading">
        <span className="admin-eyebrow">Your collection</span>
        <h1>Collection drafts</h1>
        <p>
          Name your next collection and plan its products. Save privately while you prepare the
          artwork.
        </p>
      </header>
      <p className="admin-message">
        Drafts stay private until you approve a public collection preview. Checkout from these
        collections is not yet available.
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
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="collection-toolbar">
          <span aria-live="polite">
            {!saved
              ? busy
                ? 'Loading drafts'
                : 'Drafts unavailable'
              : dirty
                ? 'Unsaved changes'
                : `Saved revision ${saved.revision}`}{' '}
            {saved?.storage === 'fixture' ? '· local demo' : ''}
          </span>
          <div>
            <button
              type="button"
              disabled={busy || artworkBusy}
              onClick={() => (dirty ? setConfirmReload(true) : void load())}
            >
              Reload saved drafts
            </button>
            <button
              className="admin-primary"
              type="submit"
              disabled={!dirty || busy || artworkBusy}
            >
              {busy ? 'Working…' : 'Save drafts'}
            </button>
          </div>
        </div>
        {confirmReload && (
          <div className="admin-message" role="alert">
            <strong>Reloading will discard your unsaved changes.</strong>
            <div className="collection-row-actions">
              <button type="button" disabled={busy || artworkBusy} onClick={() => void load()}>
                Discard changes and reload
              </button>
              <button type="button" onClick={() => setConfirmReload(false)}>
                Keep editing
              </button>
            </div>
          </div>
        )}
        <fieldset disabled={busy || artworkBusy || !saved} className="collection-form-fields">
          <legend className="collection-visually-hidden">Collection workspace</legend>
          <div className="collection-layout">
            <aside className="collection-list" aria-label="Collection drafts">
              <div className="collection-list-heading">
                <h2>Collections</h2>
                <span>{collections.length}/20</span>
              </div>
              {collections.map((entry) => (
                <button
                  className="collection-list-item"
                  key={entry.id}
                  type="button"
                  aria-current={selectedId === entry.id ? 'true' : undefined}
                  onClick={() => {
                    setSelectedId(entry.id);
                    setPreview(false);
                  }}
                >
                  <strong>{entry.title || 'Untitled collection'}</strong>
                  <span>{entry.items.length} products · private draft</span>
                </button>
              ))}
              <button
                type="button"
                className="collection-add"
                disabled={collections.length >= 20}
                onClick={add}
              >
                + New collection
              </button>
            </aside>
            <div className="collection-editor">
              {!selected ? (
                <div className="collection-empty">
                  <h2>Start with a small collection</h2>
                  <p>
                    An event, a creator drop, a monthly community feature, or your everyday
                    favorites.
                  </p>
                  <button type="button" className="admin-primary" onClick={add}>
                    Create first collection
                  </button>
                </div>
              ) : (
                <>
                  <div className="collection-editor-heading">
                    <h2>Collection details</h2>
                    <button
                      type="button"
                      aria-expanded={preview}
                      aria-controls="collection-preview"
                      onClick={() => setPreview(!preview)}
                    >
                      {preview ? 'Hide preview' : 'Preview draft'}
                    </button>
                  </div>
                  <div className="admin-fields">
                    <label>
                      Collection name
                      <input
                        required
                        maxLength={80}
                        value={selected.title}
                        onChange={(event) => update({ ...selected, title: event.target.value })}
                      />
                    </label>
                    <label>
                      Collection purpose
                      <select
                        value={selected.purpose}
                        onChange={(event) =>
                          update({
                            ...selected,
                            purpose: event.target.value as CollectionDraft['purpose'],
                          })
                        }
                      >
                        {collectionPurposes.map((purpose) => (
                          <option key={purpose.id} value={purpose.id}>
                            {purpose.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p className="collection-guidance">
                    {collectionPurposes.find(({ id }) => id === selected.purpose)?.hint}
                  </p>
                  <label>
                    Description
                    <textarea
                      rows={3}
                      maxLength={600}
                      value={selected.description}
                      onChange={(event) => update({ ...selected, description: event.target.value })}
                    />
                    <small>{selected.description.length}/600 characters</small>
                  </label>
                  <section
                    id="collection-preview"
                    className="collection-preview"
                    hidden={!preview}
                    aria-label="Draft text preview"
                  >
                    <span className="admin-eyebrow">
                      Private text preview · review artwork in each print area
                    </span>
                    <h2>{selected.title || 'Untitled collection'}</h2>
                    <p>{selected.description}</p>
                    <ol>
                      {selected.items.map((item) => (
                        <li key={item.id}>
                          <strong>{item.title}</strong>
                          <span>
                            {artworkModes.find(({ id }) => id === item.artworkMode)?.label}
                            {item.targetPriceCents === null
                              ? ''
                              : ` · Target $${(item.targetPriceCents / 100).toFixed(2)}`}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </section>
                  <section className="admin-section">
                    <div className="collection-editor-heading">
                      <h2>
                        Products <small>{selected.items.length}/15</small>
                      </h2>
                    </div>
                    {!saved?.catalog.length && (
                      <p className="admin-message">
                        No products are available in this installation’s catalog. You can save
                        collection details while the catalog is set up.
                      </p>
                    )}
                    {selected.items.map((item, index) => (
                      <CollectionProductEditor
                        key={item.id}
                        item={item}
                        index={index}
                        total={selected.items.length}
                        catalog={saved?.catalog ?? []}
                        library={library}
                        request={request}
                        readArtwork={readArtwork}
                        uploaded={artworkUploaded}
                        working={setArtworkBusy}
                        update={(next) =>
                          update({
                            ...selected,
                            items: selected.items.map((entry) =>
                              entry.id === item.id ? next : entry
                            ),
                          })
                        }
                        remove={() =>
                          update({
                            ...selected,
                            items: selected.items.filter(({ id }) => id !== item.id),
                          })
                        }
                        move={(direction) => {
                          const items = [...selected.items];
                          [items[index], items[index + direction]] = [
                            items[index + direction],
                            items[index],
                          ];
                          update({ ...selected, items });
                        }}
                      />
                    ))}
                    <button
                      className="collection-add"
                      type="button"
                      disabled={
                        !saved?.catalog.some(
                          (product) => product.variants.length && product.placements.length
                        ) || selected.items.length >= 15
                      }
                      onClick={() => {
                        const product = saved?.catalog.find(
                          (entry) => entry.variants.length && entry.placements.length
                        );
                        if (product)
                          update({
                            ...selected,
                            items: [...selected.items, initialProduct(product)],
                          });
                      }}
                    >
                      + Add product
                    </button>
                  </section>
                  <div className="collection-remove">
                    <p className="admin-fine">
                      Removing a draft takes effect when you save. It does not delete artwork or
                      affect a live collection.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const next = collections.filter(({ id }) => id !== selected.id);
                        setCollections(next);
                        setSelectedId(next[0]?.id ?? '');
                        changed();
                      }}
                    >
                      Remove this draft
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          {library && (
            <CollectionArtworkLibrary
              library={library}
              request={request}
              refresh={refreshLibrary}
            />
          )}
          <CollectionPublicationPanel
            collection={selected}
            revision={saved?.revision ?? 0}
            dirty={dirty}
            library={library}
            request={request}
            readArtwork={readArtwork}
            working={setArtworkBusy}
          />
        </fieldset>
      </form>
    </div>
  );
}
