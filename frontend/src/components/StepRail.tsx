import { useRef, type KeyboardEvent } from 'react';
import type { StepState, StudioStep } from './StepRail.types';

export type { StepState, StudioStep } from './StepRail.types';

const steps: Array<{ id: StudioStep; label: string }> = [
  { id: 'product', label: 'Product' },
  { id: 'design', label: 'Design' },
  { id: 'preview', label: 'Preview' },
  { id: 'price', label: 'Price' },
  { id: 'order', label: 'Order' },
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
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? steps.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + steps.length) % steps.length;
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
