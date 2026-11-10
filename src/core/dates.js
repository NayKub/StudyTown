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

const STUDIED_SEC = 60; // a day counts once it has a minute of study
const REST_DAYS_ALLOWED = 1; // missing this many days in a row does not end a streak

/**
 * Study days in the current streak. It is forgiving on purpose: one rest day between study days
 * is fine, and today only counts against you once it is over.
 */
export function streak(days, now = new Date()) {
  const studied = (d) => days[todayKey(d)] >= STUDIED_SEC;
  const d = new Date(now);
  if (!studied(d)) d.setDate(d.getDate() - 1);
  let count = 0;
  let missed = 0;
  for (let guard = 0; guard < 5000 && missed <= REST_DAYS_ALLOWED; guard++) {
    if (studied(d)) {
      count++;
      missed = 0;
    } else {
      missed++;
    }
    d.setDate(d.getDate() - 1);
  }
  return count;
}

/** Today against the daily goal: { minutes, goal, ratio (0..1), reached }. */
export function goalProgress(state, now = new Date()) {
  const goal = Math.max(1, state.goalMin || 60);
  const minutes = Math.floor((state.days[todayKey(now)] || 0) / 60);
  return { minutes, goal, ratio: Math.min(1, minutes / goal), reached: minutes >= goal };
}

/** How many days the current goal was reached. */
export const goalDays = (state) =>
  Object.values(state.days).filter((sec) => sec >= Math.max(1, state.goalMin || 60) * 60).length;

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
