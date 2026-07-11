import type { ProviderState } from './ProviderChip.types';

export type { ProviderState } from './ProviderChip.types';

export function ProviderChip({ label, state }: { label: string; state: ProviderState }) {
  return (
    <span className={`provider-chip provider-chip--${state}`}>
      <i aria-hidden="true" />
      {label}
      <b>{state}</b>
    </span>
  );
}
