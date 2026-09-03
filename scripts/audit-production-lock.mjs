import { readFile } from 'node:fs/promises';

const OSV_BATCH_URL = 'https://api.osv.dev/v1/querybatch';
const OSV_VULNERABILITY_URL = 'https://api.osv.dev/v1/vulns/';
const BLOCKED_SEVERITIES = new Set(['HIGH', 'CRITICAL']);

const packageNameFromLockPath = (lockPath, entry) => {
  if (typeof entry.name === 'string' && entry.name) return entry.name;
  const marker = 'node_modules/';
  const markerIndex = lockPath.lastIndexOf(marker);
  return markerIndex === -1 ? null : lockPath.slice(markerIndex + marker.length);
};

const productionInventory = (lockfile) => {
  const inventory = new Map();
  for (const [lockPath, entry] of Object.entries(lockfile.packages ?? {})) {
    // Lockfile v3 marks packages reached only through development dependencies. Optional runtime
    // packages remain included so this stays conservative across every deployment platform.
    if (!entry || entry.dev || typeof entry.version !== 'string') continue;
    const name = packageNameFromLockPath(lockPath, entry);
    if (!name) continue;
    inventory.set(`${name}@${entry.version}`, { name, version: entry.version });
  }
  return [...inventory.values()].sort((left, right) =>
    `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`)
  );
};

const requestJson = async (url, init = {}) => {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'user-agent': 'open-merch-studio-production-lock-audit/1.0',
          ...init.headers,
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`advisory service returned HTTP ${response.status}`);
      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }
  throw lastError;
};

const queryVulnerabilityIds = async (inventory) => {
  const response = await requestJson(OSV_BATCH_URL, {
    method: 'POST',
    body: JSON.stringify({
      queries: inventory.map(({ name, version }) => ({
        package: { ecosystem: 'npm', name },
        version,
      })),
    }),
  });
  if (!Array.isArray(response.results) || response.results.length !== inventory.length) {
    throw new Error('OSV returned an incomplete production dependency result set');
  }
  if (response.results.some((result) => result.next_page_token)) {
    throw new Error('OSV paginated a dependency result; refusing to report partial coverage');
  }
  return [
    ...new Set(
      response.results.flatMap((result) =>
        (result.vulns ?? []).map((vulnerability) => vulnerability.id)
      )
    ),
  ];
};

const queryVulnerabilityDetails = async (ids) => {
  const details = [];
  // Keep concurrency bounded even if a compromised lockfile resolves to an unusually large set.
  for (let index = 0; index < ids.length; index += 20) {
    const batch = ids.slice(index, index + 20);
    details.push(
      ...(await Promise.all(
        batch.map((id) => requestJson(`${OSV_VULNERABILITY_URL}${encodeURIComponent(id)}`))
      ))
    );
  }
  return details;
};

const run = async () => {
  const lockfile = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
  if (lockfile.lockfileVersion !== 3) {
    throw new Error(`Expected package-lock v3, received v${String(lockfile.lockfileVersion)}`);
  }

  const inventory = productionInventory(lockfile);
  const ids = await queryVulnerabilityIds(inventory);
  const advisories = await queryVulnerabilityDetails(ids);
  const blocked = advisories.filter((advisory) => {
    const severity = advisory.database_specific?.severity?.toUpperCase();
    // An unclassified applicable advisory blocks the build rather than silently passing below the
    // requested threshold; a maintainer can assess and document it before relaxing the gate.
    return !severity || BLOCKED_SEVERITIES.has(severity);
  });

  console.log(
    `Audited ${inventory.length} production package versions; OSV returned ${advisories.length} applicable advisories.`
  );
  if (!blocked.length) {
    console.log('No high-, critical-, or unclassified production advisories found.');
    return;
  }

  for (const advisory of blocked) {
    const severity = advisory.database_specific?.severity?.toUpperCase() ?? 'UNCLASSIFIED';
    console.error(`[${severity}] ${advisory.summary ?? advisory.id} (https://osv.dev/${advisory.id})`);
  }
  throw new Error(`${blocked.length} blocking production advisories found`);
};

run().catch((error) => {
  console.error(`Production dependency audit failed: ${error.message}`);
  process.exitCode = 1;
});
