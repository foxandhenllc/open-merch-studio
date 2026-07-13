import type { ProviderState } from './ProviderChip.types';

export type { ProviderState } from './ProviderChip.types';

export function ProviderChip({ label, state }: { label: string; state: ProviderState }) {
  const stateLabel = state.charAt(0).toUpperCase() + state.slice(1);
  return (
    <span className={`provider-chip provider-chip--${state}`} aria-label={`${label}: ${stateLabel}`}>
      <i aria-hidden="true" />
      {label}
      <b>{stateLabel}</b>
    </span>
  );
}
