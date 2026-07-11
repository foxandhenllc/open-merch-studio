import type { ReactNode } from 'react';

export type StatusNoteProps = {
  tone: 'success' | 'warning' | 'error' | 'info';
  title: string;
  children: ReactNode;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
};
