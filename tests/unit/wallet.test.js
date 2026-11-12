import { describe, it, expect } from 'vitest';
import {
  newWallet,
  balance,
  buy,
  owned,
  addBonus,
  wear,
  lookOf,
  receiveAttack,
  repairWithIQ,
  studyRepair,
  minutesToRepair,
  raiseShield,
  shieldOn,
  damageCount,
  mergeShop,
  WELCOME_IQ,
  REPAIR_STUDY_SEC,
} from '../../src/core/wallet.js';
import { mergeStates } from '../../src/core/merge.js';

const NOW = 1_800_000_000_000;
const make = (min = 0, extra = {}) => ({ totalSec: min * 60, wallet: newWallet(min, NOW), ...extra });

describe('IQ', () => {
  it('starts with the welcome gift and earns 1 per minute studied after that', () => {
    const s = make(500);
    expect(balance(s)).toBe(WELCOME_IQ);
    s.totalSec += 30 * 60;
    expect(balance(s)).toBe(WELCOME_IQ + 30);
  });

  it('adds each bonus only once', () => {
    const s = make();
    expect(addBonus(s, 'goal:2026-11-12', 15)).toBe(true);
    expect(addBonus(s, 'goal:2026-11-12', 15)).toBe(false);
    expect(balance(s)).toBe(WELCOME_IQ + 15);
  });

  it('buys looks once and refuses when short of IQ', () => {
    const s = make();
    expect(buy(s, 'snow', NOW)).toBe('poor');
    s.totalSec += 60 * 60;
    expect(buy(s, 'autumn', NOW)).toBe('');
    expect(buy(s, 'autumn', NOW + 1)).toBe('owned');
    expect(balance(s)).toBe(WELCOME_IQ + 60 - 120);
    expect(owned(s, 'meadow')).toBe(1); // free looks are always owned
  });

  it('only wears looks you own', () => {
    const s = make(0);
    expect(wear(s, 'snow')).toBe(false);
    s.totalSec = 200 * 60;
    buy(s, 'snow', NOW);
    expect(wear(s, 'snow', NOW)).toBe(true);
    expect(lookOf(s)).toMatchObject({ ground: 'snow', sky: 'live', card: 'plain' });
  });

  it('counts bombs bought and used', () => {
    const s = make();
    buy(s, 'mini', NOW);
    buy(s, 'mini', NOW + 1);
    expect(owned(s, 'mini')).toBe(2);
    s.wallet.used['atk:x:1'] = 'mini';
    expect(owned(s, 'mini')).toBe(1);
  });
});

describe('attacks', () => {
  const attack = (id, it = 'big') => ({ id, item: it, fromName: 'Ploy' });

  it('damages up to half the town, never more', () => {
    const s = make();
    expect(receiveAttack(s, attack('a', 'thunder'), 6, NOW).plots).toHaveLength(3);
    expect(s.damage.rain).toBe(true);
    expect(receiveAttack(s, attack('b', 'mini'), 6, NOW).result).toBe('full');
  });

  it('applies the same attack only once and picks the same buildings everywhere', () => {
    const a = make();
    const b = make();
    const ra = receiveAttack(a, attack('same'), 10, NOW);
    expect(receiveAttack(b, attack('same'), 10, NOW).plots).toEqual(ra.plots);
    expect(receiveAttack(a, attack('same'), 10, NOW).result).toBe('seen');
  });

  it('protects small towns and is stopped by a shield', () => {
    const s = make();
    expect(receiveAttack(s, attack('a'), 2, NOW).result).toBe('small');
    buy(s, 'shield', NOW);
    expect(raiseShield(s, NOW)).toBe(true);
    expect(shieldOn(s, NOW + 1000)).toBe(true);
    expect(receiveAttack(s, attack('b'), 10, NOW + 1000).result).toBe('shield');
    expect(shieldOn(s, NOW + 2000)).toBe(false);
    expect(damageCount(s)).toBe(0);
  });

  it('repairs with IQ or by studying', () => {
    const s = make();
    receiveAttack(s, attack('a'), 10, NOW);
    expect(damageCount(s)).toBe(3);
    expect(minutesToRepair(s)).toBe(30);
    expect(studyRepair(s, REPAIR_STUDY_SEC + 60, NOW)).toHaveLength(1);
    expect(minutesToRepair(s)).toBe(19);
    expect(repairWithIQ(s, NOW)).toBe(20);
    expect(damageCount(s)).toBe(0);
    expect(balance(s)).toBe(WELCOME_IQ - 20);
  });
});

describe('merging two devices', () => {
  it('keeps purchases from both and never doubles IQ', () => {
    const a = make(100);
    const b = { ...make(100), wallet: newWallet(120, NOW + 5) };
    a.totalSec = b.totalSec = 200 * 60;
    buy(a, 'autumn', NOW + 1);
    buy(b, 'mini', NOW + 2);
    const m = { totalSec: 200 * 60, ...mergeShop(a, b) };
    expect(owned(m, 'autumn')).toBe(1);
    expect(owned(m, 'mini')).toBe(1);
    expect(balance(m)).toBe(WELCOME_IQ + 80 - 120 - 25);
  });

  it('gives no IQ for minutes from a backup made before IQ existed', () => {
    const fresh = make(0);
    const oldBackup = { totalSec: 3000 * 60 };
    const m = { totalSec: 3000 * 60, ...mergeShop(fresh, oldBackup) };
    expect(balance(m)).toBe(WELCOME_IQ);
  });

  it('takes the newest look, damage and shield through mergeStates', () => {
    const a = make(10, { look: { ground: 'snow', at: 5 }, damage: { plots: { 1: { at: 1 } }, at: 1 } });
    const b = make(10, {
      look: { ground: 'autumn', at: 9 },
      damage: { plots: {}, at: 7 },
      shieldUntil: 99,
      shieldAt: 3,
    });
    const m = mergeStates(a, b);
    expect(m.look.ground).toBe('autumn');
    expect(Object.keys(m.damage.plots)).toHaveLength(0);
    expect(m.shieldUntil).toBe(99);
  });
});
