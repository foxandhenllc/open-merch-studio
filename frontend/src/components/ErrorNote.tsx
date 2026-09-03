import { StatusNote } from './StatusNote';
import type { SurfaceError } from '../studio-view-model.types';

export function ErrorNote({ error, onRetry }: { error?: SurfaceError; onRetry: () => void }) {
  if (!error) return null;
  return (
    <StatusNote
      tone="error"
      title={error.title}
      primaryAction={error.retryable ? { label: 'Try again', onClick: onRetry } : undefined}
    >
      <p>{error.message}</p>
      <p>{error.recovery}</p>
    </StatusNote>
  );
}
