// Keeps this device and the account's cloud backup in step, without the user doing anything:
//   - on login / launch: download, merge, upload (restoreAndSync)
//   - while open: a live listener merges what other devices upload (onRemoteBackup)
//   - while studying: upload at most once a minute, and when a session ends (sync)
//   - after an error or when the app returns to the front: retry by itself (refresh)
import * as cloud from '#cloud';
import { mergeStates } from '../../core/merge.js';
import { todayKey } from '../../core/dates.js';
import { session } from './session.js';

const UPLOAD_EVERY_MS = 60000;
const RESUME_PULL_AFTER_MS = 15000;
const RETRY_AFTER_MS = 30000;

/** Shown in the account sheet so a failure is visible instead of silent. status: busy | ok | err */
let syncState = { status: 'busy', code: '', at: 0 };
let onChange = () => {};
let stopBackup = null; // stops the live listener
let pushedKey = ''; // what we last uploaded, to skip uploads when nothing changed
let lastUpload = 0;
let uploading = null;
let lastFull = 0;
let fullJob = null;

export const syncStatus = () => syncState;
/** cb runs whenever the status changes (the account sheet re-renders itself). */
export function onSyncChange(cb) {
  onChange = cb;
}

function setSync(status, e) {
  syncState = { status, code: status === 'err' ? (e && e.code) || 'error' : '', at: Date.now() };
  if (status === 'err') console.error('sync failed', e);
  onChange();
}

/** A cheap fingerprint of the saved data: enough to tell "same" from "something new". */
const count = (obj) => Object.keys(obj || {}).length;
const sig = (st) =>
  [st.totalSec, count(st.days), (st.sessions || []).length, count(st.choices), count(st.badges), st.goalMin].join('|');
/** The public stats include "minutes today", so a new day also needs an upload. */
const pushKey = (st) => sig(st) + '|' + todayKey();

const upload = (st) => Promise.all([cloud.pushBackup(st), cloud.pushStats(session.hooks.stats())]);

/** Forget everything about the previous user (called on login and logout). */
export function resetSync() {
  stopWatch();
  pushedKey = '';
  syncState = { status: 'busy', code: '', at: 0 };
}

export function stopWatch() {
  if (stopBackup) stopBackup();
  stopBackup = null;
}

export function startWatch() {
  stopWatch();
  // a listener that hits an error is dead, so it is dropped here and restarted by refresh()
  stopBackup = cloud.watchBackup(onRemoteBackup, (e) => {
    stopBackup = null;
    setSync('err', e);
  });
}

/** Download the cloud copy, merge it with this device, upload the result. */
export async function restoreAndSync() {
  const { hooks } = session;
  if (syncState.status !== 'ok') setSync('busy');
  try {
    const remote = await cloud.pullBackup();
    if (remote) {
      const local = hooks.getState();
      const merged = mergeStates(local, remote);
      if (sig(merged) !== sig(local)) hooks.replaceState(merged);
    }
    const st = hooks.getState();
    if (!remote || sig(st) !== sig(remote) || pushKey(st) !== pushedKey) await upload(st);
    pushedKey = pushKey(st);
    lastUpload = Date.now();
    lastFull = Date.now();
    setSync('ok');
  } catch (e) {
    setSync('err', e);
  }
}

function onRemoteBackup(remote) {
  const { hooks } = session;
  const local = hooks.getState();
  const merged = mergeStates(local, remote);
  if (sig(merged) !== sig(local)) hooks.replaceState(merged); // the other device had something new
  if (sig(merged) !== sig(remote)) {
    sync(true); // this device had something new
  } else {
    pushedKey = pushKey(merged);
    setSync('ok');
  }
}

/** Upload backup + public stats. Skipped when nothing changed; throttled to once a minute unless forced. */
export function sync(force) {
  if (!session.user) return Promise.resolve();
  const st = session.hooks.getState();
  const key = pushKey(st);
  if (key === pushedKey) return Promise.resolve();
  if (!force && Date.now() - lastUpload < UPLOAD_EVERY_MS) return Promise.resolve();
  if (uploading) return uploading;
  lastUpload = Date.now();
  uploading = upload(st)
    .then(() => {
      pushedKey = key;
      setSync('ok');
    })
    .catch((e) => {
      lastUpload = 0;
      setSync('err', e);
    })
    .finally(() => {
      uploading = null;
    });
  return uploading;
}

/** Called when the app comes to the front and on every tick: catches up and repairs a failed sync. */
export function refresh(becameActive) {
  if (!session.user || fullJob) return;
  const since = Date.now() - lastFull;
  const broken = syncState.status === 'err' || !stopBackup;
  if ((becameActive && since > RESUME_PULL_AFTER_MS) || (broken && since > RETRY_AFTER_MS)) {
    lastFull = Date.now();
    fullJob = restoreAndSync()
      .then(() => {
        if (session.user && !stopBackup && syncState.status === 'ok') startWatch();
      })
      .finally(() => {
        fullJob = null;
      });
  }
}
