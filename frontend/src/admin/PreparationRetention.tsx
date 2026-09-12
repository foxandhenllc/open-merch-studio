import { useState } from 'react';
import type { AdminRequest } from './admin.types';
import type { RetentionReport } from './PreparationRetention.types';

export function PreparationRetention({ request }: { request: AdminRequest }) {
  const [report, setReport] = useState<RetentionReport | null>(null);
  const [cursor, setCursor] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState(false);
  async function run(clear: boolean, nextCursor?: string) {
    setBusy(true);
    setError('');
    setNotice('');
    setConfirm(false);
    try {
      const result = await request<RetentionReport>('/preparation-retention', 'POST', {
        clear,
        ...(nextCursor ? { cursor: nextCursor } : {}),
      });
      setReport(result);
      setCursor(nextCursor);
      if (clear)
        setNotice(
          `${result.cleared} expired preparation${result.cleared === 1 ? '' : 's'} cleared. ${result.failed ? `${result.failed} could not finish; check private storage and review again to retry.` : 'Order files and original artwork are retained.'}`
        );
    } catch {
      setError(
        'Preparation cleanup could not finish. Review again to check current progress before retrying.'
      );
      setReport(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="operation-retention" aria-label="Private storage maintenance">
      <h2>Keep private storage tidy</h2>
      <p>
        Clear collection print preparations left by abandoned carts after their estimate has been
        expired for seven days. Every preparation attached to an order is kept, including pending,
        cancelled, and refunded orders. Original artwork stays in your library.
      </p>
      <div className="operation-actions">
        <button type="button" disabled={busy} onClick={() => void run(false)}>
          Review expired preparations
        </button>
        {report?.nextCursor && (
          <button type="button" disabled={busy} onClick={() => void run(false, report.nextCursor)}>
            Review next batch
          </button>
        )}
      </div>
      {busy && <p role="status">Checking private preparations…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {report && !report.available && (
        <p>
          Fixture mode has no durable storage to clean. This control becomes available when the
          installation has PostgreSQL and private storage connected.
        </p>
      )}
      {report?.available && (
        <>
          <p>
            {report.eligible} eligible preparation{report.eligible === 1 ? '' : 's'} in this batch ·{' '}
            {report.fileCount} print file{report.fileCount === 1 ? '' : 's'} ·{' '}
            {(report.bytes / 1024 / 1024).toFixed(1)} MB. Eligibility is checked again before
            clearing.
          </p>
          {report.eligible > report.cleared && (
            <div className="operation-actions">
              {confirm ? (
                <>
                  <button type="button" disabled={busy} onClick={() => void run(true, cursor)}>
                    Confirm clearing expired files
                  </button>
                  <button type="button" disabled={busy} onClick={() => setConfirm(false)}>
                    Keep files
                  </button>
                </>
              ) : (
                <button type="button" disabled={busy} onClick={() => setConfirm(true)}>
                  Clear eligible preparations
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
