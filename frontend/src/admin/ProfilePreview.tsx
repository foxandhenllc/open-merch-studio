import { BrandAssetPreview } from './BrandAssetPreview';
import type { AdminBinaryRequest } from './admin.types';
import type { CSSProperties } from 'react';
import { useId, useState } from 'react';
import type { ProfileDraft } from './profile.types';

export function ProfilePreview({
  draft,
  readFile,
}: {
  draft: ProfileDraft;
  readFile: AdminBinaryRequest;
}) {
  const value = draft.fields;
  const [expanded, setExpanded] = useState(false);
  const previewId = useId();
  return (
    <aside
      className={expanded ? 'profile-preview is-open' : 'profile-preview'}
      aria-label="Storefront identity preview"
    >
      <button
        type="button"
        className="profile-preview-toggle admin-secondary"
        aria-expanded={expanded}
        aria-controls={previewId}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Hide preview' : 'Preview storefront identity'}
      </button>
      <div className="profile-preview-body" id={previewId}>
        <span className="admin-eyebrow">Draft preview · not live</span>
        <div
          className="profile-preview-surface"
          style={
            {
              '--preview-paper': value['brand.colors.background'],
              '--preview-ink': value['brand.colors.foreground'],
              '--preview-accent': value['brand.colors.accent'],
            } as CSSProperties
          }
        >
          <div className="profile-preview-brand">
            <BrandAssetPreview
              path={value['brand.logoPath']}
              label="Draft store logo"
              readFile={readFile}
            />
            <strong>{value['brand.displayName']}</strong>
          </div>
          <div className="profile-preview-content">
            <span>YOUR MERCH STUDIO</span>
            <h2>{value['brand.displayName']}</h2>
            <p>{value['brand.shortDescription']}</p>
            <span className="profile-preview-action">Create your merch →</span>
          </div>
          <div className="profile-preview-footer">{value['operator.supportEmail']}</div>
        </div>
        <p className="admin-fine">
          An identity preview. Your product catalog and saved artwork stay in place.
        </p>
        <div className="profile-search-preview">
          <span className="admin-eyebrow">Search & sharing preview</span>
          <BrandAssetPreview
            path={value['brand.socialImagePath']}
            label="Draft sharing image"
            readFile={readFile}
          />
          <strong>{value['web.title']}</strong>
          <p>{value['web.description']}</p>
        </div>
      </div>
    </aside>
  );
}
