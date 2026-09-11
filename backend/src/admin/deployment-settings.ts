import { randomUUID } from 'node:crypto';
import { HttpError } from '../middleware.js';
import { validateConnectionUpdate } from './provider-connections.js';

type BridgeConfig = {
  token: string;
  projectId: string;
  teamId: string;
  deployHook?: string;
  activeRevision?: string;
};
type Request = typeof fetch;
const revisionKey = 'OMS_CONNECTIONS_REVISION';

function bridgeConfig(): BridgeConfig | undefined {
  const {
    OMS_SETUP_VERCEL_TOKEN: token,
    OMS_SETUP_VERCEL_PROJECT_ID: projectId,
    OMS_SETUP_VERCEL_TEAM_ID: teamId,
  } = process.env;
  // Production credentials must never be editable by a branch-preview deployment.
  if (process.env.VERCEL_ENV !== 'production' || !token || !projectId || !teamId) return undefined;
  if (!/^prj_[A-Za-z0-9]+$/.test(projectId) || !/^team_[A-Za-z0-9]+$/.test(teamId))
    return undefined;
  if (process.env.VERCEL_PROJECT_ID && process.env.VERCEL_PROJECT_ID !== projectId)
    return undefined;
  return {
    token,
    projectId,
    teamId,
    deployHook: process.env.OMS_SETUP_DEPLOY_HOOK_URL,
    activeRevision: process.env[revisionKey],
  };
}

const unavailable = () =>
  new HttpError(
    'Connect this deployment to Vercel in the installation settings first.',
    503,
    'deployment_setup_required'
  );
const providerFailure = () =>
  new HttpError(
    'Vercel could not complete the request. Check the hosting connection and try again.',
    502,
    'hosting_request_failed'
  );

/** All targets come from deployment configuration; never accept a host, project, or token from a request. */
export function createDeploymentSettings(
  config: BridgeConfig | undefined,
  request: Request = fetch
) {
  async function call(path: string, init: RequestInit = {}) {
    if (!config) throw unavailable();
    const url = new URL(path, 'https://api.vercel.com');
    url.searchParams.set('teamId', config.teamId);
    let response: Response;
    try {
      response = await request(url, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw providerFailure();
      return (await response.json()) as Record<string, unknown>;
    } catch {
      throw providerFailure();
    }
  }
  async function verifyProject() {
    if (!config) throw unavailable();
    const project = await call(`/v9/projects/${config.projectId}`);
    if (project.id !== config.projectId || project.accountId !== config.teamId) {
      throw new HttpError(
        'The hosting project does not match this installation.',
        409,
        'hosting_project_mismatch'
      );
    }
  }
  function hookUrl() {
    if (!config?.deployHook) return undefined;
    try {
      const url = new URL(config.deployHook);
      if (
        url.origin !== 'https://api.vercel.com' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !new RegExp(`^/v1/integrations/deploy/${config.projectId}/[A-Za-z0-9_-]+$`).test(
          url.pathname
        )
      )
        return undefined;
      return url;
    } catch {
      return undefined;
    }
  }
  async function saveVariables(variables: Array<{ key: string; value: string; type: string }>) {
    await verifyProject();
    const revision = randomUUID();
    const result = await call(`/v10/projects/${config!.projectId}/env?upsert=true`, {
      method: 'POST',
      body: JSON.stringify([
        ...variables.map((item) => ({ ...item, target: ['production'] })),
        { key: revisionKey, value: revision, type: 'plain', target: ['production'] },
      ]),
    });
    // Bulk requests may partially fail despite an HTTP 200. Do not report completion in that case.
    if (Array.isArray(result.failed) && result.failed.length) {
      throw new HttpError(
        'Some values could not be saved. Review the hosting settings before redeploying.',
        502,
        'hosting_partial_save'
      );
    }
    const created = Array.isArray(result.created)
      ? result.created
      : result.created
        ? [result.created]
        : [];
    if (
      ![...variables, { key: revisionKey }].every((item) =>
        created.some(
          (row) => row && typeof row === 'object' && (row as { key?: string }).key === item.key
        )
      )
    ) {
      throw new HttpError(
        'The save could not be verified. Check the hosting settings before redeploying.',
        502,
        'hosting_save_unverified'
      );
    }
    return { savedKeys: variables.map((item) => item.key), pending: true };
  }
  return {
    async status() {
      if (!config)
        return {
          available: false,
          redeployAvailable: false,
          pending: false,
          status: 'setup_required',
        };
      try {
        await verifyProject();
        const result = await call(`/v10/projects/${config.projectId}/env`);
        if (!Array.isArray(result.envs)) throw providerFailure();
        const variables = result.envs as Array<Record<string, unknown>>;
        const revision = variables.find(
          (item) =>
            item.key === revisionKey &&
            Array.isArray(item.target) &&
            item.target.includes('production')
        );
        return {
          available: true,
          redeployAvailable: Boolean(hookUrl()),
          pending: typeof revision?.value === 'string' && revision.value !== config.activeRevision,
          status: 'ready',
        };
      } catch {
        return {
          available: false,
          redeployAvailable: false,
          pending: false,
          status: 'connection_failed',
        };
      }
    },
    async save(id: string, input: unknown) {
      return saveVariables(validateConnectionUpdate(id, input));
    },
    async saveProfile(encoded: string) {
      // This internal method is only called after review and shared profile validation.
      if (Buffer.byteLength(encoded) > 32768)
        throw new HttpError('The store profile exceeds 32 KB.', 400);
      return saveVariables([{ key: 'OMS_MERCHANT_PROFILE', value: encoded, type: 'encrypted' }]);
    },
    async redeploy() {
      await verifyProject();
      const url = hookUrl();
      if (!url)
        throw new HttpError(
          'Add a deploy hook for this project before redeploying from admin.',
          503,
          'deploy_hook_required'
        );
      try {
        const response = await request(url, {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw providerFailure();
        const result = (await response.json()) as { job?: { id?: string; state?: string } };
        if (!result.job?.id) throw providerFailure();
        return { status: 'requested' as const };
      } catch {
        throw providerFailure();
      }
    },
  };
}

export const deploymentSettings = () => createDeploymentSettings(bridgeConfig());
