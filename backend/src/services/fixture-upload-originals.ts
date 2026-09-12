// Local-only originals for faithful upload rehearsal; never a production persistence fallback.
const originals = new Map<string, { sessionId: string; bytes: Buffer; expiresAt: number }>();
const limit = 64 * 1024 * 1024;
function sweep() {
  for (const [id, value] of originals) if (value.expiresAt <= Date.now()) originals.delete(id);
}
export function rememberFixtureOriginal(id: string, sessionId: string, bytes: Buffer) {
  sweep();
  originals.delete(id);
  let total = [...originals.values()].reduce((sum, value) => sum + value.bytes.length, 0);
  for (const [key, value] of originals) {
    if (total + bytes.length <= limit) break;
    originals.delete(key);
    total -= value.bytes.length;
  }
  if (bytes.length <= limit)
    originals.set(id, {
      sessionId,
      bytes: Buffer.from(bytes),
      expiresAt: Date.now() + 60 * 60 * 1000,
    });
}
export function fixtureOriginal(id: string, sessionId: string) {
  sweep();
  const value = originals.get(id);
  return value?.sessionId === sessionId ? Buffer.from(value.bytes) : null;
}
export function forgetFixtureOriginal(id: string, sessionId: string) {
  if (originals.get(id)?.sessionId === sessionId) originals.delete(id);
}
export function forgetFixtureSessionOriginals(sessionId: string) {
  for (const [id, value] of originals) if (value.sessionId === sessionId) originals.delete(id);
}
