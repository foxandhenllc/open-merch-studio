import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { AdminRequest } from './admin.types';
import type { ProfileDraft, ProfileSnapshot } from './profile.types';
import { ProfilePreview } from './ProfilePreview';
import { PolicyEditor } from './PolicyEditor';
import './profile-editor.css';

export function MerchantProfileEditor({
  request,
  hostingAvailable,
  onPublished,
}: {
  request: AdminRequest;
  hostingAvailable: boolean;
  onPublished: () => Promise<void>;
}) {
  const [saved, setSaved] = useState<ProfileSnapshot | null>(null);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [tab, setTab] = useState<'identity' | 'policies' | 'review'>('identity');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [approved, setApproved] = useState(false);
  useEffect(() => {
    let active = true;
    request<ProfileSnapshot>('/profile')
      .then((data) => {
        if (active) {
          setSaved(data);
          setDraft(data.draft);
        }
      })
      .catch((failure: Error) => {
        if (active) setError(failure.message);
      });
    return () => {
      active = false;
    };
  }, [request]);
  const dirty = Boolean(saved && draft && JSON.stringify(draft) !== JSON.stringify(saved.draft));
  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty]);

  function update(next: ProfileDraft) {
    setDraft(next);
    setApproved(false);
    setNotice('');
    setError('');
  }
  async function reload() {
    setBusy(true);
    setError('');
    setNotice('');
    setApproved(false);
    try {
      const result = await request<ProfileSnapshot>('/profile');
      setSaved(result);
      setDraft(result.draft);
      setNotice('The latest saved draft is loaded. Unsaved edits were discarded.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The draft could not be loaded.');
    } finally {
      setBusy(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || !saved) return;
    setBusy(true);
    setError('');
    setNotice('');
    setApproved(false);
    try {
      const result = await request<ProfileSnapshot>('/profile', 'PUT', {
        draft,
        revision: saved.revision,
        baseDigest: saved.activeDigest,
      });
      setSaved(result);
      setDraft(result.draft);
      setNotice(
        result.storage === 'database'
          ? 'Draft saved privately. The live store has not changed.'
          : 'Draft saved in this local server session. It resets when the server restarts.'
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The draft could not be saved.');
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    if (!saved || dirty) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await request('/profile/publish', 'POST', {
        revision: saved.revision,
        digest: saved.digest,
        approved,
      });
      setApproved(false);
      setNotice(
        'Profile saved to hosting. Redeploy with saved values to apply it to the storefront, email, checkout, and search metadata.'
      );
      await onPublished();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Publication could not be confirmed.');
    } finally {
      setBusy(false);
    }
  }
  if (!saved || !draft)
    return (
      <section className="admin-section">
        <h1>Store profile</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button className="admin-primary" disabled={busy} onClick={() => void reload()}>
              Try again
            </button>
          </>
        ) : (
          <p role="status">Loading the saved profile…</p>
        )}
      </section>
    );
  const changes = saved.fields.filter(
    ({ path }) => draft.fields[path] !== saved.active.fields[path]
  );
  return (
    <div className="profile-editor">
      <header className="admin-page-heading">
        <span className="admin-eyebrow">Your store</span>
        <h1>Store profile</h1>
        <p>Edit your identity and policy pages, then publish one consistent profile.</p>
      </header>
      <nav className="profile-tabs" aria-label="Profile editor">
        {(
          [
            ['identity', 'Brand & details'],
            ['policies', 'Policy pages'],
            ['review', 'Review & publish'],
          ] as const
        ).map(([id, label]) => (
          <button
            type="button"
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
            key={id}
          >
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <p className="admin-feedback admin-feedback-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="admin-feedback" role="status">
          {notice}
        </p>
      )}
      {saved.stale && (
        <p className="admin-feedback">
          The installed profile changed after this draft was started. Compare the current values
          before saving again.
        </p>
      )}
      <form onSubmit={save}>
        {tab === 'identity' && (
          <div className="profile-workspace">
            <div>
              {[...new Set(saved.fields.map((field) => field.group))].map((group) => (
                <fieldset disabled={busy} className="profile-group" key={group}>
                  <legend>{group}</legend>
                  {saved.fields
                    .filter((field) => field.group === group)
                    .map((field) => (
                      <label className="profile-field" key={field.path}>
                        {field.label}
                        <input
                          type={field.type}
                          maxLength={field.maxLength}
                          value={draft.fields[field.path]}
                          required
                          onChange={(event) =>
                            update({
                              ...draft,
                              fields: { ...draft.fields, [field.path]: event.target.value },
                            })
                          }
                        />
                      </label>
                    ))}
                  {group === 'Colors' && (
                    <p className="admin-fine">
                      Choose a readable background/text pair and a dark accent for white button
                      text.
                    </p>
                  )}
                  {group === 'Orders & email' && (
                    <p className="admin-fine">
                      Existing order numbers are preserved. Email sender addresses still require
                      provider verification.
                    </p>
                  )}
                </fieldset>
              ))}
              <p className="admin-fine">
                Domain: {saved.fixed.canonicalUrl}. Domain routing, currency, product pricing, logo
                files, and payment identity remain installation settings.
              </p>
            </div>
            <ProfilePreview draft={draft} />
          </div>
        )}
        {tab === 'policies' && <PolicyEditor draft={draft} disabled={busy} update={update} />}
        {tab === 'review' && (
          <section className="profile-review">
            <h2>Review your saved profile</h2>
            <p>
              Publication saves a reviewed profile for the next deployment. A successful rebuild
              applies it throughout the store.
            </p>
            {dirty && (
              <p className="admin-feedback">
                You have unsaved changes. Save the draft before publishing.
              </p>
            )}
            <dl className="admin-detail-list">
              {changes.map(({ path, label }) => (
                <div key={path}>
                  <dt>{label}</dt>
                  <dd>
                    <span className="profile-old-value">{saved.active.fields[path]}</span>
                    <strong>{draft.fields[path]}</strong>
                  </dd>
                </div>
              ))}
            </dl>
            {!changes.length && <p>No brand or contact changes from the installed profile.</p>}
            <h3>Complete policy content</h3>
            <p>
              Version {draft.policyVersion} · Approval date {draft.policyDate}
            </p>
            {Object.entries(draft.pages).map(([path, page]) => (
              <details className="profile-review-page" key={path}>
                <summary>
                  {page.title} <span>{path}</span>
                </summary>
                <p>{page.summary}</p>
                {page.sections.map((section, index) => (
                  <article key={index}>
                    <h3>{section.heading}</h3>
                    <p>{section.body}</p>
                  </article>
                ))}
              </details>
            ))}
            {saved.requiresPolicyReview && (
              <label className="profile-approval">
                <input
                  type="checkbox"
                  checked={approved}
                  disabled={dirty || busy}
                  onChange={(event) => setApproved(event.target.checked)}
                />
                <span>
                  I reviewed all five pages and approve this saved policy version for the merchant
                  named in this profile.
                </span>
              </label>
            )}
            <p className="admin-fine">
              This records the owner's approval. It does not assess legal adequacy or rewrite policy
              promises.
            </p>
            {!hostingAvailable && (
              <p>Connect production hosting in Installation to publish from admin.</p>
            )}
            <button
              type="button"
              className="admin-primary"
              disabled={
                busy ||
                dirty ||
                !hostingAvailable ||
                !saved.revision ||
                saved.stale ||
                (saved.requiresPolicyReview && !approved)
              }
              onClick={() => void publish()}
            >
              Publish saved profile
            </button>
          </section>
        )}
        <div className="profile-save-bar">
          <span>{dirty ? 'Unsaved changes' : `Saved draft · revision ${saved.revision}`}</span>
          <button
            className="admin-secondary"
            type="button"
            disabled={busy}
            onClick={() => void reload()}
          >
            {dirty ? 'Discard edits & reload' : 'Reload saved draft'}
          </button>
          <button className="admin-primary" type="submit" disabled={busy}>
            {busy ? 'Working…' : 'Save draft'}
          </button>
        </div>
      </form>
    </div>
  );
}
