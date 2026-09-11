import { useState } from 'react';
import type { FormEvent } from 'react';
import type { ConnectionFormProps } from './admin.types';

export function ConnectionForm({ connection, available, busy, save }: ConnectionFormProps) {
  const [open, setOpen] = useState(false);
  const configured = connection.fields.filter((field) => field.secret && field.configured).length;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(
      [...new FormData(form).entries()]
        .filter(([, value]) => typeof value === 'string' && value.trim())
        .map(([key, value]) => [key, String(value)])
    );
    if (await save(connection.id, values)) form.reset();
  }
  return (
    <section className="admin-connection">
      <button
        className="admin-connection__toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span>
          <strong>{connection.name}</strong>
          <span>{connection.purpose}</span>
        </span>
        <span className="admin-connection__state">
          {configured ? 'Values configured' : 'Setup needed'}{' '}
          <span aria-hidden="true">{open ? '−' : '+'}</span>
        </span>
      </button>
      {open && (
        <form className="admin-connection__form" onSubmit={submit} autoComplete="off">
          <p>
            Values shown below describe the running deployment. Saved secrets are never displayed.
            Leave a field blank to keep its current value.
          </p>
          <a href={connection.accountUrl} target="_blank" rel="noreferrer">
            Open {connection.name} account ↗
          </a>
          <div className="admin-fields">
            {connection.fields.map((field) => (
              <label key={field.key}>
                <span>
                  {field.label} <small>{field.configured ? 'Configured' : 'Not configured'}</small>
                </span>
                {field.options ? (
                  <select name={field.key} defaultValue="" disabled={!available || busy}>
                    <option value="">
                      Keep current (
                      {field.selection === 'true'
                        ? 'enabled'
                        : field.selection === 'false'
                          ? 'disabled'
                          : field.selection}
                      )
                    </option>
                    {field.options.map((value) => (
                      <option key={value} value={value}>
                        {value === 'true' ? 'Enabled' : value === 'false' ? 'Disabled' : value}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name={field.key}
                    type={field.secret ? 'password' : 'text'}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={4096}
                    disabled={!available || busy}
                    placeholder={field.configured ? 'Enter a replacement' : 'Enter a value'}
                  />
                )}
                {field.hint && <small>{field.hint}</small>}
              </label>
            ))}
          </div>
          <button className="admin-primary" disabled={!available || busy} type="submit">
            Save {connection.name} settings
          </button>
          <p className="admin-fine">
            Saved values take effect after a successful redeploy. Credentials alone do not verify an
            account or open checkout.
          </p>
        </form>
      )}
    </section>
  );
}
