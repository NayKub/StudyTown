import { describe, it, expect } from 'vitest';
import { todayKey, lastDays, dayMin, streak, weekMinutes, publicStats } from '../../src/core/dates.js';

const NOW = new Date(2026, 10, 10, 15, 0); // 10 Nov 2026, 15:00 local time
const MIN = 60;

describe('day keys', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(todayKey(NOW)).toBe('2026-11-10');
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('lists the last n days, oldest first, ending today', () => {
    const days = lastDays(7, NOW);
    expect(days.map((x) => x.k)).toEqual([
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
    ]);
  });

  it('crosses month boundaries', () => {
    expect(lastDays(3, new Date(2026, 2, 1)).map((x) => x.k)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
  });
});

describe('study statistics', () => {
  it('rounds seconds to whole minutes', () => {
    expect(dayMin({ a: 89 }, 'a')).toBe(1);
    expect(dayMin({ a: 90 }, 'a')).toBe(2);
    expect(dayMin({}, 'a')).toBe(0);
  });

  it('counts a streak back from today', () => {
    const days = { '2026-11-10': 5 * MIN, '2026-11-09': 30 * MIN, '2026-11-08': MIN, '2026-11-06': 90 * MIN };
    expect(streak(days, NOW)).toBe(3);
  });

  it('keeps yesterday’s streak alive until today is studied', () => {
    const days = { '2026-11-09': 30 * MIN, '2026-11-08': 30 * MIN };
    expect(streak(days, NOW)).toBe(2);
  });

  it('ignores days with less than a minute', () => {
    expect(streak({ '2026-11-10': 59 }, NOW)).toBe(0);
    expect(streak({}, NOW)).toBe(0);
  });

  it('adds up the last 7 days only', () => {
    const days = { '2026-11-10': 10 * MIN, '2026-11-04': 20 * MIN, '2026-11-03': 99 * MIN };
    expect(weekMinutes(days, NOW)).toBe(30);
  });

  it('builds the stats friends can see', () => {
    const state = { totalSec: 3725, days: { '2026-11-10': 25 * MIN, '2026-11-09': 37 * MIN } };
    expect(publicStats(state, NOW)).toEqual({
      totalMin: 62,
      todayMin: 25,
      dayKey: '2026-11-10',
      weekMin: 62,
      streak: 2,
    });
  });
});
