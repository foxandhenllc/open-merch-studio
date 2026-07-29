import type { DesignDraft } from '../types/catalog.js';

const deprecatedAdvisoryLabels = new Set(['Prompt specificity']);

export function productionPrintReadiness(
  readiness: DesignDraft['readiness']
): DesignDraft['readiness'] {
  const removedChecks = readiness.checks.filter((check) =>
    deprecatedAdvisoryLabels.has(check.label)
  );
  const checks = readiness.checks.filter((check) => !deprecatedAdvisoryLabels.has(check.label));
  const hasBlock = checks.some((check) => check.severity === 'block');
  const hasWarning = checks.some((check) => check.severity === 'warning');
  const removedTheOnlyWarning =
    readiness.status === 'warning' &&
    removedChecks.some((check) => check.severity === 'warning') &&
    !hasBlock &&
    !hasWarning;

  const status =
    readiness.status === 'blocked' || hasBlock
      ? 'blocked'
      : readiness.status === 'needs_review'
        ? 'needs_review'
        : hasWarning || (readiness.status === 'warning' && !removedTheOnlyWarning)
          ? 'warning'
          : 'pass';

  return { status, checks };
}
