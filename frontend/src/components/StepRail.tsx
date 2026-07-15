import { useRef, type KeyboardEvent } from 'react';
import type { StepState, StudioStep } from './StepRail.types';

export type { StepState, StudioStep } from './StepRail.types';

const steps: Array<{ id: StudioStep; label: string }> = [
  { id: 'product', label: 'Product' },
  { id: 'make', label: 'Make' },
  { id: 'order', label: 'Checkout' },
];

export function StepRail({
  states,
  onNavigate,
}: {
  states: Record<StudioStep, StepState>;
  onNavigate: (step: StudioStep) => void;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const enabledIndexes = steps
      .map((step, stepIndex) => (states[step.id] === 'todo' ? -1 : stepIndex))
      .filter((stepIndex) => stepIndex >= 0);
    const enabledPosition = enabledIndexes.indexOf(index);
    const next =
      event.key === 'Home'
        ? enabledIndexes[0]
        : event.key === 'End'
          ? enabledIndexes.at(-1)
          : enabledIndexes[
              (enabledPosition + (event.key === 'ArrowRight' ? 1 : -1) + enabledIndexes.length) %
                enabledIndexes.length
            ];
    if (next === undefined) return;
    refs.current[next]?.focus();
  };
  return (
    <nav className="step-rail" aria-label="Studio progress">
      {steps.map((step, index) => {
        const state = states[step.id];
        const enabled = state !== 'todo';
        return (
          <button
            key={step.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            className={`step-rail__item is-${state}`}
            aria-label={`Step ${index + 1}: ${step.label}${state === 'stale' ? ' — update required' : ''}`}
            aria-current={state === 'active' ? 'step' : undefined}
            disabled={!enabled}
            onClick={() => onNavigate(step.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <span>{state === 'done' ? '✓' : index + 1}</span>
            <b>{step.label}</b>
            {state === 'stale' && <small>Update</small>}
          </button>
        );
      })}
    </nav>
  );
}
