import type { Progress, Checks } from './installation-guide.types';
import { useEffect, useState } from 'react';
import type { AdminRequest, AdminSection } from './admin.types';
import './installation-guide.css';

export function InstallationGuide({
  request,
  navigate,
}: {
  request: AdminRequest;
  navigate: (section: AdminSection) => void;
}) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [checks, setChecks] = useState<Checks | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [checkError, setCheckError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    request<Progress>('/installation-progress')
      .then((value) => {
        if (active) setProgress(value);
      })
      .catch(() => {
        if (active)
          setError(
            'Your saved setup progress could not be loaded. Check the database connection or retry.'
          );
      });
    return () => {
      active = false;
    };
  }, [request, attempt]);
  async function save(persona: string, completed: string[]) {
    if (!progress) return;
    const previous = progress;
    setProgress({ ...progress, persona, completed });
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await request<Progress>('/installation-progress', 'PUT', {
        revision: progress.revision,
        basis: progress.basis,
        persona,
        completed,
      });
      setProgress(next);
      setNotice(
        next.storage === 'database'
          ? 'Setup progress saved. You can resume here later.'
          : 'Setup progress saved for this local server session.'
      );
    } catch (failure) {
      setProgress(previous);
      setError(failure instanceof Error ? failure.message : 'Setup progress could not be saved.');
    } finally {
      setBusy(false);
    }
  }
  async function inspect() {
    setChecking(true);
    setCheckError('');
    try {
      setChecks(await request<Checks>('/installation-checks'));
    } catch {
      setCheckError('Checks could not finish. Try again; no setup values have been changed.');
    } finally {
      setChecking(false);
    }
  }
  return (
    <div className="installation-guide">
      <section className="admin-section">
        <h2>Your setup path</h2>
        <p>
          Keep track of the work you have reviewed. Your checklist records your confirmation; it
          does not open checkout or certify a live account.
        </p>
        {error && (
          <p role="alert">
            {error}{' '}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setNotice('');
                setAttempt(attempt + 1);
              }}
            >
              Reload setup progress
            </button>
          </p>
        )}
        {notice && (
          <p role="status" className="admin-feedback">
            {notice}
          </p>
        )}
        {!progress && !error && <p role="status">Loading setup progress…</p>}
        {progress && (
          <>
            {progress.contextChanged && (
              <p className="admin-feedback">
                The deployed identity or connected accounts changed. Earlier confirmations have been
                cleared for a new review.
              </p>
            )}
            {progress.storage === 'fixture' && (
              <p className="admin-fine">
                Local rehearsal: progress survives page reloads and resets when this server
                restarts.
              </p>
            )}
            <label className="profile-field">
              What are you building?
              <select
                disabled={busy}
                value={progress.persona}
                onChange={(event) => void save(event.target.value, progress.completed)}
              >
                {progress.personas.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.label}
                  </option>
                ))}
              </select>
            </label>
            <p>{progress.personas.find(({ id }) => id === progress.persona)?.focus}</p>
            <p className="admin-fine">
              {progress.completed.length} of {progress.tasks.length} tasks confirmed by you
            </p>
            <ol className="installation-task-list">
              {progress.tasks.map((task) => (
                <li key={task.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={progress.completed.includes(task.id)}
                      disabled={busy}
                      onChange={(event) =>
                        void save(
                          progress.persona,
                          event.target.checked
                            ? [...progress.completed, task.id]
                            : progress.completed.filter((id) => id !== task.id)
                        )
                      }
                    />
                    <strong>{task.title}</strong>
                  </label>
                  <p>{task.detail}</p>
                  {task.section !== 'installation' && (
                    <button
                      type="button"
                      className="admin-text-link"
                      onClick={() => navigate(task.section)}
                    >
                      Open{' '}
                      {task.section === 'profile'
                        ? 'store profile'
                        : task.section === 'orders'
                          ? 'orders & review'
                          : task.section}{' '}
                      →
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
      <section className="admin-section" aria-label="Installation checks">
        <h2>Check this installation</h2>
        <p>
          Read database migration status, private bucket access and configured account values. These
          checks do not generate artwork, charge a card, send email, or create an order.
        </p>
        <button
          className="admin-secondary"
          type="button"
          disabled={checking}
          onClick={() => void inspect()}
        >
          {checking ? 'Checking installation…' : 'Run installation checks'}
        </button>
        {checkError && <p role="alert">{checkError}</p>}
        {checks && (
          <>
            <p className="admin-fine">
              Checked {new Date(checks.checkedAt).toLocaleString()} · Checkout access:{' '}
              {checks.checkoutAccessMode}
            </p>
            <dl className="installation-check-list">
              {checks.checks.map((check) => (
                <div key={check.id}>
                  <dt>
                    {check.title}
                    <span>
                      {
                        {
                          verified: 'Check passed',
                          configured: 'Values present',
                          action: 'Review needed',
                          simulated: 'Local simulation',
                        }[check.status]
                      }
                    </span>
                  </dt>
                  <dd>{check.detail}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </section>
    </div>
  );
}
