import type { StatusNoteProps } from './StatusNote.types';

export function StatusNote({
  tone,
  title,
  children,
  primaryAction,
  secondaryAction,
}: StatusNoteProps) {
  return (
    <div
      className={`status-note status-note--${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <span className="status-note__mark" aria-hidden="true">
        {tone === 'success' ? '✓' : tone === 'error' ? '!' : tone === 'warning' ? '△' : 'i'}
      </span>
      <div>
        <strong>{title}</strong>
        <div className="status-note__body">{children}</div>
        {(primaryAction || secondaryAction) && (
          <div className="status-note__actions">
            {primaryAction && (
              <button className="text-action" type="button" onClick={primaryAction.onClick}>
                {primaryAction.label}
              </button>
            )}
            {secondaryAction && (
              <button className="text-action" type="button" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
