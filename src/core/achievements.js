// Achievements: what they are and when they are earned. Pure: everything is worked out from the
// saved state, so they can be re-checked at any time and can never be lost.
import { cityAt } from './city.js';
import { streak, goalDays } from './dates.js';

const HOUR = 60;
const MIN_SESSION_FOR_TIME_BADGES = 10 * 60; // seconds; a quick tap at 6am is not an "early bird"

/** The numbers achievements are judged on. friends = how many friends the player has right now. */
export function achievementStats(state, { friends = 0, now = new Date() } = {}) {
  const totalMin = Math.floor((state.totalSec || 0) / 60);
  const sessions = state.sessions || [];
  const real = sessions.filter((s) => s.sec >= MIN_SESSION_FOR_TIME_BADGES);
  const hourOf = (s) => new Date(s.at).getHours();
  const flags = state.flags || {};
  return {
    totalMin,
    sessions: sessions.length,
    longestMin: Math.floor(Math.max(0, ...sessions.map((s) => s.sec)) / 60),
    streak: streak(state.days || {}, now),
    goalDays: goalDays(state),
    rank: cityAt(totalMin).rank,
    chosen: Object.keys(state.choices || {}).length,
    early: real.some((s) => hourOf(s) < 7),
    night: real.some((s) => hourOf(s) >= 22),
    friends: Math.max(friends, flags.friend ? 1 : 0),
    visited: !!flags.visited,
    replayed: !!flags.replayed,
  };
}

/** In display order. `test` gets the stats above. Names and descriptions live in the locale files. */
export const ACHIEVEMENTS = [
  { id: 'first', icon: '🌱', test: (s) => s.sessions >= 1 },
  { id: 'h1', icon: '⏱️', test: (s) => s.totalMin >= 1 * HOUR },
  { id: 'h5', icon: '📚', test: (s) => s.totalMin >= 5 * HOUR },
  { id: 'h10', icon: '🎓', test: (s) => s.totalMin >= 10 * HOUR },
  { id: 'h25', icon: '🚀', test: (s) => s.totalMin >= 25 * HOUR },
  { id: 'h50', icon: '👑', test: (s) => s.totalMin >= 50 * HOUR },
  { id: 'village', icon: '🏘️', test: (s) => s.rank >= 2 },
  { id: 'town', icon: '🏙️', test: (s) => s.rank >= 5 },
  { id: 'metro', icon: '🌆', test: (s) => s.rank >= 7 },
  { id: 'focus45', icon: '🎯', test: (s) => s.longestMin >= 45 },
  { id: 'focus90', icon: '🧘', test: (s) => s.longestMin >= 90 },
  { id: 'goal1', icon: '✅', test: (s) => s.goalDays >= 1 },
  { id: 'goal7', icon: '🏅', test: (s) => s.goalDays >= 7 },
  { id: 'streak3', icon: '🔥', test: (s) => s.streak >= 3 },
  { id: 'streak7', icon: '💪', test: (s) => s.streak >= 7 },
  { id: 'streak30', icon: '🏆', test: (s) => s.streak >= 30 },
  { id: 'early', icon: '🌅', test: (s) => s.early },
  { id: 'night', icon: '🦉', test: (s) => s.night },
  { id: 'builder', icon: '🔨', test: (s) => s.chosen >= 1 },
  { id: 'architect', icon: '📐', test: (s) => s.chosen >= 15 },
  { id: 'replay', icon: '🎬', test: (s) => s.replayed },
  { id: 'friend', icon: '👫', test: (s) => s.friends >= 1 },
  { id: 'visit', icon: '🏡', test: (s) => s.visited },
];

/** Ids of achievements that are now deserved but not yet in state.badges. */
export function newlyEarned(state, extra) {
  const stats = achievementStats(state, extra);
  const have = state.badges || {};
  return ACHIEVEMENTS.filter((a) => !have[a.id] && a.test(stats)).map((a) => a.id);
}
