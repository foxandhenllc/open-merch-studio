export type PendingGeneration = { id: string; prompt: string; reference?: string };
export function readPendingGeneration(key: string): PendingGeneration | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null') as PendingGeneration | null;
    if (
      value &&
      typeof value.id === 'string' &&
      /^[a-f0-9-]{36}$/.test(value.id) &&
      typeof value.prompt === 'string' &&
      value.prompt.length <= 2000 &&
      (!value.reference || /^[A-Za-z0-9_-]{1,100}$/.test(value.reference))
    )
      return value;
  } catch {
    /* A private-browsing session can still prepare artwork in this tab. */
  }
}
export function savePendingGeneration(key: string, value?: PendingGeneration) {
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
