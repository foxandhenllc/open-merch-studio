import type { DesignDraft } from '@app-types/catalog';

export function ReadinessChecks({ draft }: { draft: DesignDraft }) {
  return (
    <section className="readiness" aria-label="Print readiness checks">
      <div className="section-heading">
        <div>
          <span className="kicker">Production check</span>
          <h3>Print readiness</h3>
        </div>
        <span
          className={`status-pill status-pill--${draft.readiness.status === 'blocked' ? 'bad' : draft.readiness.status === 'warning' || draft.readiness.status === 'needs_review' ? 'warn' : 'ok'}`}
        >
          {draft.readiness.status.replace('_', ' ')}
        </span>
      </div>
      <div className="readiness__list">
        {draft.readiness.checks.map((check) => (
          <div key={check.label} className={`readiness__item is-${check.severity ?? 'pass'}`}>
            <span aria-hidden="true">
              {check.severity === 'block' ? '×' : check.severity === 'warning' ? '!' : '✓'}
            </span>
            <strong>{check.label}</strong>
            <p>{check.result}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
