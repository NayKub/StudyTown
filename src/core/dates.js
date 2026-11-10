// Day keys ("2026-11-10") and study-time statistics. Pure functions: pass the data in.

/** Local-date key for a Date, e.g. "2026-11-10". */
export const todayKey = (d = new Date()) =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/** The last n days, oldest first, as [{ k: dayKey, d: Date }]. */
export function lastDays(n, now = new Date()) {
  const out = [];
  const d = new Date(now);
  d.setHours(12); // midday avoids daylight-saving edge cases
  d.setDate(d.getDate() - (n - 1));
  for (let i = 0; i < n; i++) {
    out.push({ k: todayKey(d), d: new Date(d) });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Whole minutes studied on a day. `days` maps dayKey -> seconds. */
export const dayMin = (days, k) => Math.round((days[k] || 0) / 60);

/** Consecutive days with at least a minute of study, counting back from today (or yesterday). */
export function streak(days, now = new Date()) {
  let n = 0;
  const d = new Date(now);
  if (!(days[todayKey(d)] >= 60)) d.setDate(d.getDate() - 1);
  while (days[todayKey(d)] >= 60) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export const weekMinutes = (days, now = new Date()) => lastDays(7, now).reduce((a, x) => a + dayMin(days, x.k), 0);

/** The numbers friends can see: total, today, this week, streak. */
export function publicStats(state, now = new Date()) {
  const k = todayKey(now);
  return {
    totalMin: Math.floor(state.totalSec / 60),
    todayMin: dayMin(state.days, k),
    dayKey: k,
    weekMin: weekMinutes(state.days, now),
    streak: streak(state.days, now),
  };
}
