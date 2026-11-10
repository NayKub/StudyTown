/**
 * Combine this device's data with the cloud copy without losing or double-counting days.
 * Per day the larger total wins; sessions are de-duplicated by start time.
 */
export function mergeStates(local, remote) {
  if (!remote) return local;
  const days = { ...(remote.days || {}) };
  Object.entries(local.days || {}).forEach(([k, v]) => {
    days[k] = Math.max(days[k] || 0, v);
  });
  const seen = new Set();
  const sessions = [];
  [...(remote.sessions || []), ...(local.sessions || [])].forEach((s) => {
    if (!seen.has(s.at)) {
      seen.add(s.at);
      sessions.push(s);
    }
  });
  sessions.sort((a, b) => a.at - b.at);
  const sum = Object.values(days).reduce((a, b) => a + b, 0);
  return {
    ...local,
    days,
    sessions: sessions.slice(-2000),
    totalSec: Math.max(local.totalSec || 0, remote.totalSec || 0, sum),
  };
}
