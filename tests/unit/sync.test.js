// The account backup must never be overwritten by a device that hasn't downloaded it yet
// (a fresh install logging in has an empty town until the download arrives).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const cloudCalls = { pushed: [] };
let releasePull;
vi.mock('#cloud', () => ({
  pullBackup: () => new Promise((r) => (releasePull = r)),
  pushBackup: (st) => {
    cloudCalls.pushed.push(st);
    return Promise.resolve();
  },
  pushStats: () => Promise.resolve(),
  watchBackup: () => () => {},
}));

const { session } = await import('../../src/features/account/session.js');
const { restoreAndSync, sync, resetSync } = await import('../../src/features/account/sync.js');

const town = (minutes) => ({
  totalSec: minutes * 60,
  days: minutes ? { '2026-11-01': minutes * 60 } : {},
  sessions: [],
  choices: {},
  badges: {},
  flags: {},
  goalMin: 60,
  profile: { avatar: '', photo: '', at: 0 },
});

describe('logging in on a fresh install', () => {
  let local;
  beforeEach(() => {
    cloudCalls.pushed = [];
    local = town(0);
    session.user = { uid: 'u1' };
    session.hooks = {
      getState: () => local,
      replaceState: (m) => {
        local = m;
      },
      stats: () => ({}),
    };
    resetSync();
  });

  it('does not upload the empty town before the backup has been downloaded', async () => {
    const restoring = restoreAndSync();
    await sync(true); // the app's regular tick, or anything else asking for an upload
    await sync(false);
    expect(cloudCalls.pushed).toHaveLength(0);
    releasePull(town(3000));
    await restoring;
    expect(local.totalSec).toBe(3000 * 60);
    expect(cloudCalls.pushed.every((st) => st.totalSec === 3000 * 60)).toBe(true);
  });
});
