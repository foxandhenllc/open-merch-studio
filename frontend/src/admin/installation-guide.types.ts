import type { AdminSection } from './admin.types';
export type Progress = {
  revision: number;
  basis: string;
  persona: string;
  completed: string[];
  contextChanged: boolean;
  storage: 'database' | 'fixture';
  personas: Array<{ id: string; label: string; focus: string }>;
  tasks: Array<{ id: string; title: string; detail: string; section: AdminSection }>;
};
export type Checks = {
  checkedAt: string;
  checkoutAccessMode: string;
  checks: Array<{
    id: string;
    title: string;
    status: 'verified' | 'action' | 'simulated' | 'configured';
    detail: string;
  }>;
};
