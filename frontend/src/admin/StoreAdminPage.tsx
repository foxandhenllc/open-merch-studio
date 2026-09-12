import { AdminSectionGuide, ChangeVisibilityGuide } from './SetupGuidance';
import { InstallationGuide } from './InstallationGuide';
import { OrderOperations } from './OrderOperations';
import { useCallback, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { merchantConfig } from '../generated/merchant-config';
import { adminRequest, adminBinaryRequest } from './admin-api';
import { ConnectionForm } from './ConnectionForm';
import { MerchantProfileEditor } from './MerchantProfileEditor';
import { CollectionDraftEditor } from './CollectionDraftEditor';
import type { AdminRequest, AdminBinaryRequest } from './admin.types';
import type { AdminSection, AdminSetup, SettingsSnapshot, StoreValues } from './admin.types';
import './admin.css';

const sections: Array<{ id: AdminSection; label: string; number: string }> = [
  { id: 'overview', label: 'Overview', number: '01' },
  { id: 'profile', label: 'Store profile', number: '02' },
  { id: 'collections', label: 'Collections', number: '03' },
  { id: 'connections', label: 'Connections', number: '04' },
  { id: 'artwork', label: 'Artwork & limits', number: '05' },
  { id: 'installation', label: 'Installation', number: '06' },
  { id: 'orders', label: 'Orders & review', number: '07' },
];

export function StoreAdminPage() {
  const credential = useRef('');
  const [setup, setSetup] = useState<AdminSetup | null>(null);
  const [section, setSection] = useState<AdminSection>('overview');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deploymentRequested, setDeploymentRequested] = useState(false);
  const [profileOpened, setProfileOpened] = useState(false);
  const [collectionsOpened, setCollectionsOpened] = useState(false);
  const profileRequest: AdminRequest = useCallback(
    (path, method, body) => adminRequest(credential.current, path, method, body),
    []
  );
  const artworkRequest: AdminBinaryRequest = useCallback(
    (path) => adminBinaryRequest(credential.current, path),
    []
  );

  function navigate(next: AdminSection) {
    if (next === 'profile') setProfileOpened(true);
    if (next === 'collections') setCollectionsOpened(true);
    setSection(next);
    setError('');
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  async function work(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The request failed.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const code = String(new FormData(form).get('accessCode') || '');
    await work(async () => {
      const data = await adminRequest<AdminSetup>(code, '/setup');
      credential.current = code;
      form.reset();
      setSetup(data);
    });
  }
  async function refresh() {
    await work(async () => {
      setSetup(await adminRequest<AdminSetup>(credential.current, '/setup'));
      setNotice('Status refreshed from the running store.');
    });
  }
  async function saveSettings(values: Partial<StoreValues>) {
    if (!setup?.settings) return;
    await work(async () => {
      const result = await adminRequest<SettingsSnapshot>(
        credential.current,
        '/store-settings',
        'PATCH',
        { values, revision: setup.settings!.revision }
      );
      setSetup({ ...setup, settings: result });
      setNotice(
        result.storage === 'fixture'
          ? 'Saved in this local server. These demo settings reset when the server restarts.'
          : 'Settings saved. New artwork requests will use these choices.'
      );
    });
  }
  async function saveConnection(id: string, values: Record<string, string>) {
    return work(async () => {
      await adminRequest(credential.current, `/connections/${id}`, 'PUT', values);
      setSetup((previous) =>
        previous ? { ...previous, hosting: { ...previous.hosting, pending: true } } : previous
      );
      setDeploymentRequested(false);
      setNotice('Connection values saved to production hosting. Redeploy to apply them.');
    });
  }
  async function redeploy() {
    await work(async () => {
      await adminRequest(credential.current, '/deployment', 'POST');
      setDeploymentRequested(true);
      setNotice(
        'Deployment requested. Wait for the hosting build to finish, then refresh status to verify the saved values are active.'
      );
    });
  }
  function logout() {
    credential.current = '';
    setSetup(null);
    setError('');
    setNotice('');
    setDeploymentRequested(false);
  }
  function submitBudgets(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void saveSettings({
      dailyAiBudgetCents: Math.round(Number(data.get('daily')) * 100),
      perSessionBudgetCents: Math.round(Number(data.get('session')) * 100),
      freeDraftLimit: Number(data.get('freeDrafts')),
    });
  }
  const settings = setup?.settings;
  const selected = setup?.models.find((model) => model.id === settings?.values.imageModel);

  if (!setup)
    return (
      <div className="store-admin admin-login">
        <a className="admin-brand" href="/">
          {import.meta.env.VITE_OWNER_START_EMPTY === 'true'
            ? 'Open Merch Studio'
            : merchantConfig.brand.displayName}
        </a>
        <main>
          <span className="admin-eyebrow">Store administration</span>
          <h1>
            Your store.
            <br />
            Your controls.
          </h1>
          <p>Manage artwork, budgets, and the services behind your shop.</p>
          <form onSubmit={login}>
            <label>
              Admin access code
              <input name="accessCode" type="password" required autoComplete="current-password" />
            </label>
            {error && (
              <p className="admin-message admin-message--error" role="alert">
                {error}
              </p>
            )}
            <button className="admin-primary" disabled={busy}>
              {busy ? 'Signing in…' : 'Open store admin →'}
            </button>
          </form>
          <p className="admin-fine">
            Use the access code configured by this installation’s owner. Your code is kept only for
            this open page.
          </p>
          <a className="admin-text-link" href="/admin/setup-guide.txt">
            Setting up a new store? Read the installation guide ↗
          </a>
        </main>
        <footer>Powered by {merchantConfig.attribution.projectName}</footer>
      </div>
    );

  return (
    <div className="store-admin admin-layout">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/">
          {setup.store.name}
        </a>
        <span className="admin-eyebrow">Store admin</span>
        <nav aria-label="Store administration">
          {sections.map((item) => (
            <button
              key={item.id}
              aria-current={section === item.id ? 'page' : undefined}
              onClick={() => {
                navigate(item.id);
                setError('');
                setNotice('');
              }}
            >
              <span aria-hidden="true">{item.id === 'overview' ? '→' : '·'}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar__bottom">
          <a href="/" target="_blank" rel="noreferrer">
            View storefront ↗
          </a>
          <button onClick={logout} disabled={busy}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <span>
            {setup.store.name} / {sections.find((item) => item.id === section)?.label}
          </span>
          <button onClick={() => void refresh()} disabled={busy}>
            Refresh status ↻
          </button>
        </header>
        <div className="admin-content">
          {settings?.storage === 'fixture' && (
            <p className="admin-message">
              Local demo · Settings persist for this server session. Connect a database for durable
              settings.
            </p>
          )}
          {error && (
            <p className="admin-message admin-message--error" role="alert">
              {error}
            </p>
          )}
          {notice && section !== 'profile' && (
            <p className="admin-message admin-message--success" role="status">
              {notice}
            </p>
          )}
          {setup.hosting.pending && (
            <div className="admin-pending">
              <div>
                <strong>Deployment changes are waiting</strong>
                <p>A successful redeploy applies your saved connections and store profile.</p>
              </div>
              <button
                className="admin-primary"
                disabled={busy || !setup.hosting.redeployAvailable || deploymentRequested}
                onClick={() => void redeploy()}
              >
                {deploymentRequested ? 'Deployment requested' : 'Redeploy with saved values'}
              </button>
            </div>
          )}
          {section === 'overview' && (
            <>
              <header className="admin-page-heading">
                <span className="admin-eyebrow">Your store</span>
                <h1>Store overview</h1>
                <p>
                  Begin with a private draft. Work through the setup path and check each change
                  before customers see it.
                </p>
              </header>
              {setup.content?.empty && (
                <p className="admin-message">
                  Empty installation · No collections, artwork, orders, merchant identity, or policy
                  text have been added for you. Colors and AI limits are product defaults; provider
                  choices are unconnected until you supply values.
                </p>
              )}
              <InstallationGuide request={profileRequest} navigate={navigate} compact />
              <ChangeVisibilityGuide />
              <details className="admin-section">
                <summary>Current operating defaults</summary>
                <p>
                  Artwork: {selected?.name}. Daily AI budget:{' '}
                  {settings
                    ? `$${(settings.values.dailyAiBudgetCents / 100).toFixed(2)}`
                    : 'Unavailable'}
                  . Checkout access: {setup.commerce.checkoutAccessMode}.
                </p>
                <p>These are software settings, not sample store content. AI remains optional.</p>
              </details>
            </>
          )}
          {section !== 'overview' && <AdminSectionGuide section={section} navigate={navigate} />}
          {section === 'orders' && (
            <OrderOperations request={profileRequest} readFile={artworkRequest} />
          )}
          {section === 'artwork' && (
            <>
              <header className="admin-page-heading">
                <span className="admin-eyebrow">Creation settings</span>
                <h1>Artwork & limits</h1>
                <p>Choose how new artwork is made. Existing designs keep their saved files.</p>
              </header>
              {!settings && (
                <p className="admin-message admin-message--error">
                  Settings storage is unavailable. Check the database connection before changing the
                  model.
                </p>
              )}
              <section className="admin-section">
                <h2>Image model</h2>
                <p>Used for new designs, reference images, and revisions.</p>
                <div className="admin-models">
                  {setup.models.map((model) => {
                    const active = settings?.values.imageModel === model.id;
                    return (
                      <article
                        key={model.id}
                        className={active ? 'admin-model is-active' : 'admin-model'}
                      >
                        <div>
                          <span className="admin-eyebrow">
                            {active
                              ? 'Active model'
                              : model.transparent
                                ? 'Transparent PNG output'
                                : 'Background removal required'}
                          </span>
                          <h3>{model.name}</h3>
                          <p>{model.description}</p>
                        </div>
                        <button
                          className={active ? 'admin-selected' : 'admin-primary'}
                          disabled={active || busy || !settings}
                          onClick={() => void saveSettings({ imageModel: model.id })}
                        >
                          {active ? 'Selected ✓' : `Use ${model.name.replace('GPT Image ', '')}`}
                        </button>
                      </article>
                    );
                  })}
                </div>
                <p className="admin-fine">
                  No redeploy needed. Selection does not make a paid test request or verify access
                  to the model. Image 2.5 budget reservations are $0.50 per draft/revision and $1.00
                  per final. Verified response usage updates the counted estimate; missing usage
                  keeps the reservation. These are estimates, not a provider billing cap.
                </p>
              </section>
              {settings && (
                <section className="admin-section">
                  <h2>Visitor allowance & AI budget</h2>
                  <form key={settings.revision} onSubmit={submitBudgets}>
                    <div className="admin-fields admin-fields--three">
                      <label>
                        Daily budget (USD)
                        <input
                          name="daily"
                          type="number"
                          min="0.01"
                          max="10000"
                          step="0.01"
                          defaultValue={(settings.values.dailyAiBudgetCents / 100).toFixed(2)}
                          required
                        />
                      </label>
                      <label>
                        Budget per session (USD)
                        <input
                          name="session"
                          type="number"
                          min="0.01"
                          max="1000"
                          step="0.01"
                          defaultValue={(settings.values.perSessionBudgetCents / 100).toFixed(2)}
                          required
                        />
                      </label>
                      <label>
                        Free drafts for new visitors
                        <input
                          name="freeDrafts"
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          defaultValue={settings.values.freeDraftLimit}
                          required
                        />
                      </label>
                    </div>
                    <p className="admin-fine">
                      Budget checks use estimated spend, including configured background-removal
                      costs. Set provider-side spending limits too. Existing visitors retain
                      allowances already granted.
                    </p>
                    <button className="admin-primary" disabled={busy}>
                      Save limits
                    </button>
                  </form>
                </section>
              )}
            </>
          )}
          {section === 'connections' && (
            <>
              <header className="admin-page-heading">
                <span className="admin-eyebrow">Your services</span>
                <h1>Connections</h1>
                <p>Use your own accounts. Save credentials to this store’s production hosting.</p>
              </header>
              {!setup.hosting.available && (
                <div className="admin-message">
                  <strong>
                    {setup.hosting.status === 'connection_failed'
                      ? 'Hosting connection needs attention'
                      : 'Connect hosting to enable these forms'}
                  </strong>
                  <p>
                    {setup.hosting.status === 'connection_failed'
                      ? 'The configured Vercel connection could not be verified.'
                      : 'An installation owner must complete the one-time hosting setup before credentials can be saved here.'}
                  </p>
                  <button onClick={() => navigate('installation')}>
                    View installation steps →
                  </button>
                </div>
              )}
              <div>
                {setup.connections.map((connection) => (
                  <ConnectionForm
                    key={connection.id}
                    connection={connection}
                    available={setup.hosting.available}
                    busy={busy}
                    save={saveConnection}
                  />
                ))}
              </div>
            </>
          )}
          {section === 'installation' && (
            <>
              <header className="admin-page-heading">
                <span className="admin-eyebrow">Owner setup</span>
                <h1>Installation</h1>
                <p>Each store has its own deployment, accounts, credentials, and data.</p>
              </header>
              <InstallationGuide request={profileRequest} navigate={navigate} />
              <section className="admin-section">
                <h2>Current store identity</h2>
                <dl className="admin-detail-list">
                  <div>
                    <dt>Store</dt>
                    <dd>{setup.store.name}</dd>
                  </div>
                  <div>
                    <dt>Canonical address</dt>
                    <dd>{setup.store.url}</dd>
                  </div>
                  <div>
                    <dt>Support</dt>
                    <dd>{setup.store.supportEmail}</dd>
                  </div>
                  <div>
                    <dt>Settings storage</dt>
                    <dd>
                      {settings?.storage === 'database'
                        ? 'PostgreSQL · persistent'
                        : settings?.storage === 'fixture'
                          ? 'Local demo · server session only'
                          : 'Unavailable'}
                    </dd>
                  </div>
                  <div>
                    <dt>Credential management</dt>
                    <dd>
                      {setup.hosting.available ? 'Vercel · production' : 'Hosting setup required'}
                    </dd>
                  </div>
                </dl>
              </section>
              <section className="admin-section">
                <h2>Connect hosting once</h2>
                <p>
                  In this store’s Vercel production environment, configure the admin access code, a
                  Vercel token, and the exact project and team IDs. Add a deploy hook for the
                  production branch to enable the redeploy button.
                </p>
                <a
                  className="admin-text-link"
                  href="/admin/setup-guide.txt"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open the installation checklist ↗
                </a>
                <p className="admin-fine">
                  Hosting credentials are configured outside this form so the admin cannot redirect
                  secrets to another project. Preview deployments cannot edit production
                  credentials.
                </p>
              </section>
              <section className="admin-section">
                <h2>Before opening sales</h2>
                <p>
                  Verify your merchant identity and policies, payment account, signed webhooks,
                  catalog, and fulfillment review. Saving provider keys does not open checkout or
                  automatically confirm production orders.
                </p>
                <dl className="admin-detail-list">
                  <div>
                    <dt>Payments authorized</dt>
                    <dd>{setup.commerce.paymentsAuthorized ? 'Yes' : 'No'}</dd>
                  </div>
                  <div>
                    <dt>Fulfillment authorized</dt>
                    <dd>{setup.commerce.fulfillmentAuthorized ? 'Yes' : 'No'}</dd>
                  </div>
                  <div>
                    <dt>Automatic production confirmation</dt>
                    <dd>
                      {setup.commerce.autoConfirm
                        ? 'Enabled — review deployment configuration'
                        : 'Disabled · manual review'}
                    </dd>
                  </div>
                </dl>
              </section>
              <section className="admin-section">
                <h2>Make it your own</h2>
                <p>
                  Edit branding, support details, and policy pages in Store profile. Save a private
                  draft, review it, then publish it with the next deployment.
                </p>
                <p className="admin-fine">
                  This admin operates one installation. It does not grant access to another
                  organization’s mini-store.
                </p>
              </section>
            </>
          )}
          <div hidden={section !== 'collections'}>
            {collectionsOpened && (
              <CollectionDraftEditor request={profileRequest} readArtwork={artworkRequest} />
            )}
          </div>
          <div hidden={section !== 'profile'}>
            {profileOpened && (
              <MerchantProfileEditor
                readFile={artworkRequest}
                request={profileRequest}
                hostingAvailable={setup.hosting.available}
                onPublished={refresh}
              />
            )}
          </div>
        </div>
        <footer className="admin-footer">
          {merchantConfig.attribution.projectName} <span>Store owner controls</span>
        </footer>
      </main>
    </div>
  );
}
