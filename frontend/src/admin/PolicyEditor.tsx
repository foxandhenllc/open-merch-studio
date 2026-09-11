import { useState } from 'react';
import type { ProfileDraft, PolicyPage } from './profile.types';

export function PolicyEditor({
  draft,
  disabled,
  update,
}: {
  draft: ProfileDraft;
  disabled: boolean;
  update: (draft: ProfileDraft) => void;
}) {
  const [path, setPath] = useState('/privacy');
  const page = draft.pages[path];
  function change(next: PolicyPage) {
    update({ ...draft, pages: { ...draft.pages, [path]: next } });
  }
  return (
    <section className="profile-policies">
      <h2>Policy & support pages</h2>
      <p>
        Supply your own reviewed content. Names and promises in these pages are never rewritten
        automatically.
      </p>
      <label className="profile-field">
        Page to edit
        <select value={path} onChange={(event) => setPath(event.target.value)}>
          {Object.keys(draft.pages).map((key) => (
            <option value={key} key={key}>
              {key}
            </option>
          ))}
        </select>
      </label>
      <fieldset disabled={disabled}>
        {(['eyebrow', 'title', 'summary'] as const).map((key) => (
          <label className="profile-field" key={key}>
            {key === 'eyebrow' ? 'Page label' : key === 'title' ? 'Page title' : 'Page summary'}
            <textarea
              aria-label={
                key === 'eyebrow' ? 'Page label' : key === 'title' ? 'Page title' : 'Page summary'
              }
              rows={key === 'summary' ? 3 : 1}
              value={page[key]}
              maxLength={20000}
              required
              onChange={(event) => change({ ...page, [key]: event.target.value })}
            />
          </label>
        ))}
        {page.sections.map((section, index) => (
          <div className="profile-policy-section" key={index}>
            <div className="profile-section-row">
              <h3>Section {index + 1}</h3>
              <button
                type="button"
                className="admin-text-button"
                disabled={page.sections.length <= 1}
                onClick={() =>
                  change({ ...page, sections: page.sections.filter((_, item) => item !== index) })
                }
              >
                Remove section {index + 1}
              </button>
            </div>
            <label className="profile-field">
              Heading {index + 1}
              <input
                value={section.heading}
                maxLength={20000}
                required
                onChange={(event) =>
                  change({
                    ...page,
                    sections: page.sections.map((item, key) =>
                      key === index ? { ...item, heading: event.target.value } : item
                    ),
                  })
                }
              />
            </label>
            <label className="profile-field">
              Text {index + 1}
              <textarea
                aria-label={`Text ${index + 1}`}
                rows={6}
                value={section.body}
                maxLength={20000}
                required
                onChange={(event) =>
                  change({
                    ...page,
                    sections: page.sections.map((item, key) =>
                      key === index ? { ...item, body: event.target.value } : item
                    ),
                  })
                }
              />
            </label>
          </div>
        ))}
        <button
          type="button"
          className="admin-secondary"
          disabled={page.sections.length >= 50}
          onClick={() =>
            change({ ...page, sections: [...page.sections, { heading: '', body: '' }] })
          }
        >
          Add section
        </button>
        <div className="profile-approval-fields">
          <label className="profile-field">
            Policy version
            <input
              value={draft.policyVersion}
              maxLength={64}
              required
              onChange={(event) => update({ ...draft, policyVersion: event.target.value })}
            />
          </label>
          <label className="profile-field">
            Policy approval date
            <input
              type="date"
              value={draft.policyDate}
              required
              onChange={(event) => update({ ...draft, policyDate: event.target.value })}
            />
          </label>
        </div>
        <p className="admin-fine">
          Changed merchant details or policy content require a new version and explicit approval at
          publication.
        </p>
      </fieldset>
    </section>
  );
}
