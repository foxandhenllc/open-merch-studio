import { useEffect, useRef, useState } from 'react';
import type {
  CollectionPublicationSummary,
  CollectionPrintLayouts as LayoutSnapshot,
  CollectionPrintLayout,
} from '@open-merch-studio/collection-drafts';
import type { AdminRequest, AdminBinaryRequest } from './admin.types';
import './collection-print-layouts.css';
import type { PrintLayoutFields as Fields } from './collection-print-layouts.types';

const fieldNames = {
  templateWidthInches: 'Template width (inches)',
  templateHeightInches: 'Template height (inches)',
  leftInches: 'Distance from left (inches)',
  topInches: 'Distance from top (inches)',
};

const emptyFields = (): Fields => ({
  templateWidthInches: '',
  templateHeightInches: '',
  leftInches: '0',
  topInches: '0',
});

export function CollectionPrintLayouts({
  publication,
  request,
  readArtwork,
  changed,
}: {
  publication: CollectionPublicationSummary;
  request: AdminRequest;
  readArtwork: AdminBinaryRequest;
  changed: () => Promise<void>;
}) {
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [saved, setSaved] = useState<LayoutSnapshot | null>(null);
  const [areaKey, setAreaKey] = useState('');
  const [fields, setFields] = useState<Fields>(emptyFields);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const area = saved?.areas.find((item) => `${item.itemId}:${item.placementCode}` === areaKey);
  const layout = saved?.layouts.find((item) => `${item.itemId}:${item.placementCode}` === areaKey);
  const dirty =
    Object.values(fields).some((value) => !value.trim()) ||
    !layout ||
    Object.keys(fieldNames).some(
      (key) => Number(fields[key as keyof Fields]) !== layout[key as keyof Fields]
    );
  const unsaved =
    saved !== null &&
    (layout
      ? dirty
      : Object.keys(fields).some(
          (key) => fields[key as keyof Fields] !== emptyFields()[key as keyof Fields]
        ));
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);
  const base = `/collection-publications/${publication.id}/print-layouts`;
  useEffect(() => {
    if (!preview) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(preview);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [preview]);
  function select(key: string, state = saved) {
    setAreaKey(key);
    setConfirmed(false);
    setPreview(null);
    setNotice('');
    setError('');
    const selected = state?.layouts.find((item) => `${item.itemId}:${item.placementCode}` === key);
    setFields(
      selected
        ? {
            templateWidthInches: String(selected.templateWidthInches),
            templateHeightInches: String(selected.templateHeightInches),
            leftInches: String(selected.leftInches),
            topInches: String(selected.topInches),
          }
        : emptyFields()
    );
  }
  async function act(action: 'load' | 'save' | 'preview' | 'export') {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (action === 'load') {
        const state = await request<LayoutSnapshot>(`${base}?version=${publication.version}`);
        if (!active.current) return;
        setSaved(state);
        select(
          state.areas[0] ? `${state.areas[0].itemId}:${state.areas[0].placementCode}` : '',
          state
        );
      } else if (saved && area) {
        if (action === 'save') {
          const next: CollectionPrintLayout = {
            itemId: area.itemId,
            placementCode: area.placementCode,
            ...Object.fromEntries(
              Object.entries(fields).map(([key, value]) => [
                key,
                value.trim() ? Number(value) : null,
              ])
            ),
          } as CollectionPrintLayout;
          const state = await request<LayoutSnapshot>(base, 'PUT', {
            version: publication.version,
            revision: saved.revision,
            layouts: [
              ...saved.layouts.filter((item) => `${item.itemId}:${item.placementCode}` !== areaKey),
              next,
            ],
            templateConfirmed: confirmed,
          });
          if (!active.current) return;
          setSaved(state);
          setPreview(null);
          setNotice('Print layout saved. Preview the canvas before downloading.');
          await changed();
        } else {
          const blob = await readArtwork(
            `${base}/${area.itemId}/${encodeURIComponent(area.placementCode)}/${action}?version=${publication.version}&revision=${saved.revision}`
          );
          if (!active.current) return;
          if (action === 'preview') setPreview(blob);
          else {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'print-layout.png';
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            setNotice(
              'Prepared PNG downloaded. Check it against the provider template before production.'
            );
          }
        }
      }
    } catch (failure) {
      setPreview(null);
      setError(
        failure instanceof Error ? failure.message : 'The print layout could not be prepared.'
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="collection-print-layouts"
      aria-label={`Print layouts for ${publication.title}`}
    >
      <button type="button" disabled={busy} onClick={() => void act('load')}>
        {saved ? 'Reopen saved print layouts' : 'Prepare print layouts'}
      </button>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {saved && (
        <fieldset
          disabled={busy}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && event.target instanceof HTMLInputElement)
              event.preventDefault();
          }}
        >
          <legend>Print template · published version {saved.version}</legend>
          <p>
            Use the selected product variant’s template dimensions. This canvas shows placement, not
            the finished product. Reopening layouts discards unsaved entries.
          </p>
          <label>
            Print area
            <select value={areaKey} onChange={(event) => select(event.target.value)}>
              {saved.areas.map((item) => (
                <option
                  key={`${item.itemId}:${item.placementCode}`}
                  value={`${item.itemId}:${item.placementCode}`}
                >
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          {area && (
            <>
              <p>
                Approved artwork: {area.widthInches} × {area.heightInches} inches ·{' '}
                {area.pixelsPerInch} pixels per inch. Change artwork size by reviewing and
                republishing the collection.
              </p>
              <div className="collection-print-inputs">
                {Object.entries(fieldNames).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      step="0.01"
                      min={key.startsWith('template') ? '0.25' : '0'}
                      max="48"
                      value={fields[key as keyof Fields]}
                      onChange={(event) => {
                        setFields((value) => ({ ...value, [key]: event.target.value }));
                        setConfirmed(false);
                        setPreview(null);
                        setNotice('');
                      }}
                    />
                  </label>
                ))}
              </div>
              <label className="collection-artwork-consent">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                I checked these dimensions and offsets against this product variant’s template,
                including required bleed.
              </label>
              <div className="collection-row-actions">
                <button type="button" disabled={!confirmed} onClick={() => void act('save')}>
                  Save print layout
                </button>
                <button type="button" disabled={dirty} onClick={() => void act('preview')}>
                  Preview saved canvas
                </button>
                <button
                  type="button"
                  disabled={dirty || !previewUrl}
                  onClick={() => void act('export')}
                >
                  Download prepared PNG
                </button>
              </div>
              <p>
                Export: transparent PNG, 300 pixels per inch. Resampling does not add detail to the
                original. Checkout and automatic production remain unavailable for this collection.
              </p>
              {previewUrl && (
                <figure>
                  <div className="collection-print-canvas">
                    <img src={previewUrl} alt={`Template canvas for ${area.label}`} />
                  </div>
                  <figcaption>
                    Saved placement on a transparent template canvas. No automatic cropping or
                    bleed.
                  </figcaption>
                </figure>
              )}
            </>
          )}
        </fieldset>
      )}
    </section>
  );
}
