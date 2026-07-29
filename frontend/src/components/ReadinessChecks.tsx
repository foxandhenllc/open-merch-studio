import { useEffect, useState } from 'react';
import type { DesignDraft } from '@app-types/catalog';
import { customerPrintReadiness } from '../utils/print-readiness';

export function ReadinessChecks({ draft }: { draft: DesignDraft }) {
  const readiness = customerPrintReadiness(draft.readiness);
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [draft.id]);
  return (
    <details
      className="readiness"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="section-heading">
        <div>
          <span className="readiness__compact-label">Print details</span>
          <span className="kicker">Production check</span>
          <h3>Print readiness</h3>
        </div>
        <span
          className={`status-pill status-pill--${readiness.status === 'blocked' ? 'bad' : readiness.status === 'warning' || readiness.status === 'needs_review' ? 'warn' : 'ok'}`}
        >
          {readiness.status.replace('_', ' ')}
        </span>
      </summary>
      <div className="readiness__list">
        {readiness.checks.map((check) => (
          <div key={check.label} className={`readiness__item is-${check.severity ?? 'pass'}`}>
            <span aria-hidden="true">
              {check.severity === 'block' ? '×' : check.severity === 'warning' ? '!' : '✓'}
            </span>
            <strong>{check.label}</strong>
            <p>{check.result}</p>
          </div>
        ))}
      </div>
    </details>
  );
}
