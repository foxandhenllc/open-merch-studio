import type { AllowanceState } from '@app-types/catalog';

export function AllowanceMeter({
  allowance,
  onBuyPass,
  busy,
}: {
  allowance: AllowanceState;
  onBuyPass: () => void;
  busy: boolean;
}) {
  const needsPass = allowance.nextAction === 'buy_studio_pass';
  return (
    <section className="allowance">
      <div>
        <span className="kicker">Session allowance</span>
        <strong>{allowance.message}</strong>
      </div>
      <div className="allowance__counts">
        <span>
          <b>{allowance.freeDraftsRemaining}</b> free
        </span>
        <span>
          <b>{allowance.roughDraftsRemaining}</b> pass drafts
        </span>
        <span>
          <b>{allowance.editsRemaining}</b> edits
        </span>
      </div>
      {needsPass && (
        <div className="pass-offer">
          <div>
            <strong>$5 Studio Pass</strong>
            <p>Eight rough drafts, two edits, one final, and a $5 eligible order credit.</p>
          </div>
          <button
            className="button button--secondary"
            type="button"
            onClick={onBuyPass}
            disabled={busy}
          >
            {busy ? 'Activating…' : 'Get Studio Pass'}
          </button>
        </div>
      )}
    </section>
  );
}
