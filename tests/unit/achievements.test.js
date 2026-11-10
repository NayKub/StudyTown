import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS, achievementStats, newlyEarned } from '../../src/core/achievements.js';
import en from '../../src/i18n/locales/en.json';
import th from '../../src/i18n/locales/th.json';

const NOW = new Date(2026, 10, 10, 15, 0);
const at = (hour) => new Date(2026, 10, 10, hour, 0).getTime();
const state = (over = {}) => ({
  totalSec: 0,
  days: {},
  sessions: [],
  choices: {},
  badges: {},
  flags: {},
  goalMin: 60,
  ...over,
});
const earned = (st, extra) => newlyEarned(st, { now: NOW, ...extra });

describe('achievements', () => {
  it('gives a brand-new player nothing', () => {
    expect(earned(state())).toEqual([]);
  });

  it('awards the first session and total-time badges', () => {
    const st = state({ totalSec: 5 * 3600, sessions: [{ at: at(14), sec: 1500 }] });
    expect(earned(st)).toEqual(expect.arrayContaining(['first', 'h1', 'h5']));
    expect(earned(st)).not.toContain('h10');
  });

  it('does not award a badge twice', () => {
    const st = state({ totalSec: 3600, sessions: [{ at: at(14), sec: 1500 }], badges: { first: 1, h1: 1 } });
    expect(earned(st)).not.toContain('first');
    expect(earned(st)).not.toContain('h1');
  });

  it('needs a real session for early bird and night owl', () => {
    expect(earned(state({ sessions: [{ at: at(6), sec: 60 }] }))).not.toContain('early');
    expect(earned(state({ sessions: [{ at: at(6), sec: 1500 }] }))).toContain('early');
    expect(earned(state({ sessions: [{ at: at(23), sec: 1500 }] }))).toContain('night');
  });

  it('counts the longest single session, not the total', () => {
    const many = state({
      sessions: [
        { at: at(9), sec: 1800 },
        { at: at(11), sec: 1800 },
      ],
    });
    expect(achievementStats(many, { now: NOW }).longestMin).toBe(30);
    expect(earned(state({ sessions: [{ at: at(9), sec: 2700 }] }))).toContain('focus45');
  });

  it('awards goal, builder and friend badges', () => {
    expect(earned(state({ days: { '2026-11-10': 3600 } }))).toContain('goal1');
    expect(earned(state({ choices: { 1: 'pond' } }))).toContain('builder');
    expect(earned(state(), { friends: 1 })).toContain('friend');
    expect(earned(state({ flags: { friend: true, visited: true, replayed: true } }))).toEqual(
      expect.arrayContaining(['friend', 'visit', 'replay']),
    );
  });

  it('has a name and description for every badge in both languages', () => {
    ACHIEVEMENTS.forEach(({ id }) => {
      for (const locale of [en, th]) {
        expect(locale.ach[id], id).toBeTruthy();
        expect(locale.ach[id].name, id).toBeTruthy();
        expect(locale.ach[id].desc, id).toBeTruthy();
      }
    });
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
});

describe('translations', () => {
  const keys = (obj, prefix = '') =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object' && !Array.isArray(v) ? keys(v, prefix + k + '.') : [prefix + k],
    );
  // English has singular and plural forms; Thai only needs one, so plural suffixes are ignored
  const base = (list) => new Set(list.map((k) => k.replace(/_(one|other)$/, '')));

  it('has the same keys in Thai and English', () => {
    expect([...base(keys(th))].sort()).toEqual([...base(keys(en))].sort());
  });
});
