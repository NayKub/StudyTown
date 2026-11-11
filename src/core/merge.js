import { cityAt } from './city.js';

/** Plots from this index on wait for the player's choice. Backups made before choosing existed have none. */
const chooseFromOf = (state) =>
  state.chooseFrom == null ? Math.max(1, cityAt(Math.floor((state.totalSec || 0) / 60)).n) : state.chooseFrom;

/** Keep the earliest date for badges both sides have. */
function mergeBadges(a = {}, b = {}) {
  const out = { ...a };
  Object.entries(b).forEach(([id, at]) => {
    out[id] = out[id] ? Math.min(out[id], at) : at;
  });
  return out;
}

/**
 * Combine this device's data with the cloud copy without losing or double-counting anything.
 * Per day the larger total wins; sessions are de-duplicated by start time; choices and badges
 * from both sides are kept.
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
  const goalHitDay = [local.goalHitDay || '', remote.goalHitDay || ''].sort().pop();
  // the profile picture changed most recently wins, whichever device it was changed on
  const lp = local.profile || {};
  const rp = remote.profile || {};
  const profile = (rp.at || 0) > (lp.at || 0) ? rp : lp;
  return {
    ...local,
    days,
    sessions: sessions.slice(-2000),
    totalSec: Math.max(local.totalSec || 0, remote.totalSec || 0, sum),
    choices: { ...(remote.choices || {}), ...(local.choices || {}) },
    // the later starting point wins, so a town built before choosing existed is never torn up
    chooseFrom: Math.max(chooseFromOf(local), chooseFromOf(remote)),
    badges: mergeBadges(local.badges, remote.badges),
    flags: { ...(remote.flags || {}), ...(local.flags || {}) },
    goalMin: local.goalMin || remote.goalMin || 60,
    goalHitDay,
    profile: { avatar: profile.avatar || '', photo: profile.photo || '', at: profile.at || 0 },
  };
}
