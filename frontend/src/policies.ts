import type { PolicyRoute } from './policies.types';
import { policyPages } from './generated/policy-content';

// Rendering accepts plain text only; policy files never supply HTML, scripts, or runtime templates.
export const policyRoutes: Readonly<Record<string, PolicyRoute>> = policyPages;
export { policyApproval } from './generated/policy-content';
