import { ErrorNote } from './ErrorNote';
import type { ArtworkSourcePanelProps } from './ArtworkSourcePanel.types';

export function ArtworkSourcePanel({
  productTitle,
  variantName,
  activePlacement,
  creationPath,
  uploadFile,
  uploadPreview,
  uploadRightsConfirmed,
  removeUploadBackground,
  referenceAssets,
  referenceRightsConfirmed,
  prompt,
  promptBlocked,
  generating,
  error,
  promptRef,
  onShowConfigure,
  onCreationPathChange,
  onUploadFileChange,
  onUploadRightsChange,
  onRemoveUploadBackgroundChange,
  onReferenceRightsChange,
  onAddReferenceImages,
  onRemoveReferenceAsset,
  onPromptChange,
  onSubmit,
}: ArtworkSourcePanelProps) {
  return (
    <div className={`panel-stack${error ? ' has-generation-error' : ''}`}>
      <button className="selection-summary" type="button" onClick={onShowConfigure}>
        <span>{productTitle}</span>
        <b>{variantName}</b>
        <small>Edit</small>
      </button>
      {activePlacement && (
        <div className="placement-target" role="status">
          <b>Creating artwork for {activePlacement.displayName}</b>
          <p>
            Your other print area stays unchanged. Generate, upload, or use references for this side
            only.
          </p>
        </div>
      )}
      <div className="artwork-source" role="group" aria-label="Choose how to make artwork">
        <button
          type="button"
          aria-pressed={creationPath === 'generate'}
          onClick={() => onCreationPathChange('generate')}
        >
          <b>Create with AI</b>
          <small>Start with an idea</small>
        </button>
        <button
          type="button"
          aria-pressed={creationPath === 'upload'}
          onClick={() => onCreationPathChange('upload')}
        >
          <b>Use my artwork</b>
          <small>No AI generation</small>
        </button>
        <button
          type="button"
          aria-pressed={creationPath === 'reference'}
          onClick={() => onCreationPathChange('reference')}
        >
          <b>Use references</b>
          <small>Create something new</small>
        </button>
      </div>

      {creationPath === 'upload' ? (
        <div className="upload-workspace">
          <label className={`upload-drop${uploadPreview ? ' has-preview' : ''}`}>
            {uploadPreview ? (
              <img src={uploadPreview} alt="Selected artwork preview" />
            ) : (
              <span>
                <b>Choose your artwork</b>
                <small>PNG, JPEG, or WebP · up to 20 MB</small>
              </span>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => onUploadFileChange(event.target.files?.[0] ?? null)}
            />
          </label>
          {uploadFile && (
            <p className="upload-file-name">
              <span>{uploadFile.name}</span>
              <small>{(uploadFile.size / 1024 / 1024).toFixed(1)} MB</small>
            </p>
          )}
          <label className="option-check">
            <input
              type="checkbox"
              checked={removeUploadBackground}
              onChange={(event) => onRemoveUploadBackgroundChange(event.target.checked)}
            />
            <span>
              <b>Remove the background</b>
              <small>Useful for logos and isolated subjects. Leave off for full photos.</small>
            </span>
          </label>
          <label className="option-check rights-check">
            <input
              type="checkbox"
              checked={uploadRightsConfirmed}
              onChange={(event) => onUploadRightsChange(event.target.checked)}
            />
            <span>I created this artwork or have permission to reproduce it on merchandise.</span>
          </label>
        </div>
      ) : (
        <>
          {creationPath === 'reference' && (
            <div className="reference-workspace">
              <label className="option-check rights-check">
                <input
                  type="checkbox"
                  checked={referenceRightsConfirmed}
                  onChange={(event) => onReferenceRightsChange(event.target.checked)}
                />
                <span>
                  I created these references or have permission to use them as creative input.
                </span>
              </label>
              <label className="reference-add">
                <span>Add reference images</span>
                <small>Up to five · style, mood, color, or composition</small>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  disabled={!referenceRightsConfirmed || referenceAssets.length >= 5 || generating}
                  onChange={(event) => {
                    onAddReferenceImages(Array.from(event.target.files ?? []));
                    event.currentTarget.value = '';
                  }}
                />
              </label>
              {referenceAssets.length > 0 && (
                <div className="reference-strip" aria-label="Uploaded references">
                  {referenceAssets.map((asset) => (
                    <figure key={asset.id}>
                      <img src={asset.imageUrl} alt={asset.asset?.originalFilename ?? 'Reference'} />
                      <button
                        type="button"
                        aria-label="Remove reference"
                        onClick={() => {
                          if (asset.id) onRemoveReferenceAsset(asset.id);
                        }}
                      >
                        ×
                      </button>
                    </figure>
                  ))}
                </div>
              )}
            </div>
          )}
          <label className="prompt-field streamlined-prompt">
            <span>
              {creationPath === 'reference'
                ? 'What new design should these inspire?'
                : 'What should we make?'}
            </span>
            <textarea
              ref={promptRef}
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              rows={6}
              maxLength={600}
              placeholder={
                creationPath === 'reference'
                  ? 'Use the warm colors and handmade texture, but create a new original raccoon mechanic graphic…'
                  : 'A cheerful red panda tending a tiny garden, bold screen-print style, no words…'
              }
            />
            <small className="prompt-help">
              {creationPath === 'reference'
                ? 'Describe what to borrow and what the new artwork should become.'
                : 'Describe the subject, style, colors, and any essential words.'}
            </small>
            {prompt.length >= 450 && <b>{prompt.length}/600</b>}
          </label>
        </>
      )}
      <ErrorNote error={error} onRetry={onSubmit} />
      <button
        className="button button--primary button--wide"
        type="button"
        onClick={onSubmit}
        disabled={
          generating ||
          (creationPath === 'upload' ? !uploadFile || !uploadRightsConfirmed : promptBlocked)
        }
      >
        {creationPath === 'upload'
          ? 'Prepare my artwork'
          : creationPath === 'reference'
            ? 'Create from references'
            : 'Generate my design'}
      </button>
    </div>
  );
}
