import { describe, it, expect } from 'vitest';
import { plots, cityAt, tierOf, isRoad } from '../../src/core/city.js';

describe('town plan', () => {
  it('starts as empty land with one resident', () => {
    expect(cityAt(0)).toEqual({ n: 0, R: 1, rank: 0, pop: 1 });
  });

  it('builds the tent in the middle after 3 minutes', () => {
    expect(plots[0]).toMatchObject({ x: 0, y: 0, kind: 'hall', t: 3 });
    expect(cityAt(2).n).toBe(0);
    expect(cityAt(3).n).toBe(1);
  });

  it('unlocks plots in order, each needing more time than the last', () => {
    for (let i = 1; i < plots.length; i++) expect(plots[i].t).toBeGreaterThan(plots[i - 1].t);
  });

  it('never puts a building on a road', () => {
    expect(plots.some((p) => isRoad(p.x, p.y))).toBe(false);
  });

  it('only grows as study time increases', () => {
    let previous = cityAt(0);
    for (let m = 0; m <= 5000; m += 25) {
      const city = cityAt(m);
      expect(city.n).toBeGreaterThanOrEqual(previous.n);
      expect(city.R).toBeGreaterThanOrEqual(previous.R);
      expect(city.rank).toBeGreaterThanOrEqual(previous.rank);
      previous = city;
    }
  });

  it('is complete, a metropolis with 36 residents, after about 80 hours', () => {
    const last = plots[plots.length - 1];
    expect(last.t / 60).toBeGreaterThan(70);
    expect(last.t / 60).toBeLessThan(90);
    expect(cityAt(last.t)).toMatchObject({ n: plots.length, R: 10, rank: 7, pop: 36 });
  });
});

describe('upgrades', () => {
  const hall = plots[0];

  it('upgrades the hall 45, 180 and 480 minutes after it was built', () => {
    expect(tierOf(hall, hall.t)).toBe(0);
    expect(tierOf(hall, hall.t + 44)).toBe(0);
    expect(tierOf(hall, hall.t + 45)).toBe(1);
    expect(tierOf(hall, hall.t + 180)).toBe(2);
    expect(tierOf(hall, hall.t + 480)).toBe(3);
  });

  it('never upgrades past what a plot allows', () => {
    plots.forEach((p) => expect(tierOf(p, 1e6)).toBe(p.cap));
    expect(plots.find((p) => p.kind === 'pond').cap).toBe(0);
  });
});
