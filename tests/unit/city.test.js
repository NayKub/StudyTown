import { describe, it, expect } from 'vitest';
import {
  plots,
  cityAt,
  tierOf,
  isRoad,
  KINDS,
  kindOf,
  optionsFor,
  pendingPlots,
  encodeChoices,
  decodeChoices,
} from '../../src/core/city.js';

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

describe('choosing what to build', () => {
  const town = (over = {}) => ({ choices: {}, chooseFrom: 5, unlocked: 8, ...over });

  it('keeps the planned kind for plots built before choosing existed', () => {
    expect(kindOf(plots[3], town())).toBe(plots[3].kind);
  });

  it('shows a building site until the owner chooses', () => {
    expect(kindOf(plots[6], town())).toBe('site');
    expect(kindOf(plots[6], town({ choices: { 6: 'pond' } }))).toBe('pond');
  });

  it('never turns the hall or a locked plot into a site', () => {
    expect(kindOf(plots[0], town({ chooseFrom: 0 }))).toBe('hall');
    expect(kindOf(plots[9], town())).toBe(plots[9].kind);
  });

  it('lists the plots waiting for a choice, oldest first', () => {
    expect(pendingPlots(town({ choices: { 6: 'shop' } }))).toEqual([5, 7]);
    expect(pendingPlots(town({ chooseFrom: Infinity }))).toEqual([]);
  });

  it('offers three different kinds, the same ones every time', () => {
    plots.slice(1, 40).forEach((p) => {
      const options = optionsFor(p);
      expect(new Set(options).size).toBe(3);
      options.forEach((kind) => expect(KINDS).toContain(kind));
      expect(optionsFor(p)).toEqual(options);
    });
  });

  it('upgrades a chosen kind by that kind’s own limits', () => {
    const p = plots[5];
    expect(tierOf(p, 1e6, 'pond')).toBe(0);
    expect(tierOf(p, 1e6, 'shop')).toBe(2);
  });

  it('round-trips choices through the short text friends receive', () => {
    const choices = { 2: 'house', 5: 'pond', 6: 'trees' };
    expect(encodeChoices(choices)).toBe('--h--pt');
    expect(decodeChoices('--h--pt')).toEqual(choices);
    expect(encodeChoices({})).toBe('');
  });

  it('ignores anything unexpected in text from other people', () => {
    expect(decodeChoices('x<h>!')).toEqual({ 2: 'house' });
    expect(decodeChoices(null)).toEqual({});
    expect(Object.keys(decodeChoices('h'.repeat(5000))).length).toBe(plots.length);
  });
});
