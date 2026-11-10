import { describe, it, expect } from 'vitest';
import { mergeStates } from '../../src/core/merge.js';

const session = (at, sec) => ({ at, end: at + sec * 1000, sec });

describe('merging two devices', () => {
  it('returns this device unchanged when there is no backup', () => {
    const local = { totalSec: 60, days: { a: 60 }, sessions: [] };
    expect(mergeStates(local, null)).toBe(local);
  });

  it('keeps days that only one side has', () => {
    const phone = { totalSec: 600, days: { mon: 600 }, sessions: [session(1, 600)] };
    const laptop = { totalSec: 900, days: { tue: 900 }, sessions: [session(2, 900)] };
    const merged = mergeStates(phone, laptop);
    expect(merged.days).toEqual({ mon: 600, tue: 900 });
    expect(merged.totalSec).toBe(1500);
    expect(merged.sessions.map((s) => s.at)).toEqual([1, 2]);
  });

  it('takes the larger total for a day both sides have, instead of adding them', () => {
    const merged = mergeStates({ totalSec: 300, days: { mon: 300 } }, { totalSec: 500, days: { mon: 500 } });
    expect(merged.days.mon).toBe(500);
    expect(merged.totalSec).toBe(500);
  });

  it('does not duplicate a session that is on both devices', () => {
    const shared = session(10, 1500);
    const merged = mergeStates(
      { totalSec: 1500, days: { mon: 1500 }, sessions: [shared] },
      { totalSec: 1500, days: { mon: 1500 }, sessions: [shared, session(5, 60)] },
    );
    expect(merged.sessions.map((s) => s.at)).toEqual([5, 10]);
  });

  it('gives the same result whichever device merges', () => {
    const a = { totalSec: 700, days: { mon: 400, tue: 300 }, sessions: [session(1, 400)] };
    const b = { totalSec: 650, days: { mon: 200, wed: 450 }, sessions: [session(2, 450)] };
    const ab = mergeStates(a, b);
    const ba = mergeStates(b, a);
    expect(ab.days).toEqual(ba.days);
    expect(ab.totalSec).toBe(ba.totalSec);
    expect(ab.sessions).toEqual(ba.sessions);
  });

  it('never lowers the total, even if day records are missing', () => {
    const merged = mergeStates({ totalSec: 5000, days: {} }, { totalSec: 100, days: { mon: 100 } });
    expect(merged.totalSec).toBe(5000);
  });

  it('keeps device-only fields such as the running timer', () => {
    const timer = { active: true };
    expect(mergeStates({ totalSec: 0, days: {}, timer }, { totalSec: 0, days: {} }).timer).toBe(timer);
  });

  it('keeps the buildings chosen on both devices', () => {
    const merged = mergeStates(
      { totalSec: 0, days: {}, choices: { 3: 'pond' }, chooseFrom: 2 },
      { totalSec: 0, days: {}, choices: { 4: 'shop' }, chooseFrom: 2 },
    );
    expect(merged.choices).toEqual({ 3: 'pond', 4: 'shop' });
    expect(merged.chooseFrom).toBe(2);
  });

  it('does not tear up a town when a fresh install logs in to an old account', () => {
    const freshInstall = { totalSec: 0, days: {}, choices: {}, chooseFrom: 1 };
    const oldBackup = { totalSec: 600 * 60, days: { mon: 600 * 60 } }; // made before choosing existed
    const merged = mergeStates(freshInstall, oldBackup);
    expect(merged.chooseFrom).toBeGreaterThan(50);
  });

  it('keeps badges from both devices with the earliest date', () => {
    const merged = mergeStates(
      { totalSec: 0, days: {}, badges: { first: 200, h1: 300 } },
      { totalSec: 0, days: {}, badges: { first: 100, early: 400 } },
    );
    expect(merged.badges).toEqual({ first: 100, h1: 300, early: 400 });
  });
});
