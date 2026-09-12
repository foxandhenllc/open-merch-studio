import {
  readPendingGeneration,
  savePendingGeneration,
  type PendingGeneration,
} from './pending-generation';
import { useRef, useState } from 'react';
import type { PublicCollection } from '@open-merch-studio/collection-drafts';
import type { DesignDraft } from '../types/catalog';
import { api } from '../services/api';
import { collectionPost } from './collection-request';
import './collection-personalization.css';

export function CollectionArtworkInput({
  collection,
  item,
  sessionId,
  assetId,
  changed,
  working,
}: {
  collection: PublicCollection;
  item: PublicCollection['products'][number];
  sessionId: string;
  assetId?: string;
  changed: (assetId?: string) => void;
  working: (busy: boolean) => void;
}) {
  const pendingKey = `oms-collection-generation:${sessionId}:${collection.id}:${collection.version}:${item.id}`;
  const [initialRequest] = useState(() => readPendingGeneration(pendingKey));
  const [file, setFile] = useState<File | null>(null);
  const [rights, setRights] = useState(false);
  const [reference, setReference] = useState<string | undefined>(initialRequest?.reference);
  const [prompt, setPrompt] = useState(initialRequest?.prompt ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  const [pending, setPending] = useState(Boolean(initialRequest));
  const request = useRef<PendingGeneration | undefined>(initialRequest);
  async function run(generate: boolean) {
    setBusy(true);
    working(true);
    setError('');
    try {
      let draft: DesignDraft;
      if (generate) {
        if (!request.current) request.current = { id: crypto.randomUUID(), prompt, reference };
        const saved = request.current;
        if (!savePendingGeneration(pendingKey, saved))
          setError(
            'Keep this tab open while generation is pending. This browser cannot save request recovery.'
          );
        setPending(true);
        draft = await collectionPost<DesignDraft>(`/api/collections/${collection.id}/artwork`, {
          sessionId,
          requestId: saved.id,
          version: collection.version,
          itemId: item.id,
          prompt: saved.prompt,
          ...(saved.reference ? { referenceAssetId: saved.reference } : {}),
        });
        setPending(false);
        savePendingGeneration(pendingKey);
        request.current = undefined;
      } else {
        if (!file || !rights)
          throw new Error('Choose an image and confirm your reproduction rights.');
        draft = (
          await api.uploadArtwork({
            file,
            sessionId,
            rightsConfirmed: true,
            purpose: item.artworkMode === 'reference' ? 'reference' : 'collection',
          })
        ).data;
      }
      if (!draft.id || draft.generationStatus !== 'complete')
        throw new Error('Artwork preparation did not finish. Check the request before continuing.');
      setPreview(draft.imageUrl);
      if (!generate && item.artworkMode === 'reference') setReference(draft.id);
      else changed(draft.id);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Artwork could not be prepared.');
    } finally {
      setBusy(false);
      working(false);
    }
  }
  const needsUpload = item.artworkMode === 'upload' || item.artworkMode === 'reference';
  return (
    <section className="collection-artwork-input" aria-label={`Personalize ${item.title}`}>
      <h3>{item.artworkMode === 'upload' ? 'Add your artwork' : 'Create your artwork'}</h3>
      <p>
        {item.artworkMode === 'upload'
          ? 'Your original image keeps its colors and background. It fits inside the store’s approved print area without cropping.'
          : item.artworkMode === 'reference'
            ? 'Upload a reference, then describe a new image inspired by it. This creates new artwork rather than printing your original.'
            : 'Describe a new design. AI generation uses this store’s model and allowance.'}
      </p>
      {assetId && (
        <p className="collection-purchase-note">
          Artwork selected for this product. Review the saved print preview with your order
          estimate.
        </p>
      )}
      {preview && <img src={preview} alt={`Selected artwork for ${item.title}`} />}
      {needsUpload && (
        <>
          <label>
            {item.artworkMode === 'reference' ? 'Reference image' : 'Original artwork'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy || pending}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setRights(false);
                setReference(undefined);
                setPreview('');
                changed();
              }}
            />
          </label>
          <label className="collection-purchase-consent">
            <input
              type="checkbox"
              checked={rights}
              disabled={busy || pending}
              onChange={(event) => setRights(event.target.checked)}
            />
            I have permission to reproduce this image on merchandise.
          </label>
          <button
            type="button"
            disabled={!file || !rights || busy || pending}
            onClick={() => void run(false)}
          >
            {busy && !pending
              ? 'Preparing image…'
              : item.artworkMode === 'reference'
                ? 'Prepare reference'
                : 'Use my original'}
          </button>
        </>
      )}
      {item.artworkMode !== 'upload' && (
        <>
          <label>
            Describe your design
            <textarea
              maxLength={2000}
              rows={3}
              value={prompt}
              disabled={busy || pending}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </label>
          {pending && (
            <p>
              The previous request may still be processing. Checking that request will not start
              another generation.
            </p>
          )}
          <button
            type="button"
            disabled={
              busy ||
              (!pending && (!prompt.trim() || (item.artworkMode === 'reference' && !reference)))
            }
            onClick={() => void run(true)}
          >
            {busy
              ? 'Preparing artwork…'
              : pending
                ? 'Check previous generation'
                : 'Generate my design'}
          </button>
          {pending && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                savePendingGeneration(pendingKey);
                request.current = undefined;
                setPending(false);
                setError(
                  'A new generation may use additional AI budget. The previous request will not be repeated.'
                );
              }}
            >
              Start a separate generation
            </button>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
