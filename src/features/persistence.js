// Saving to the device. Study time is written at most every 30 s while it changes,
// and immediately at the moments that matter (pause, end of session, app going to the background).
import { G } from '../core/state.js';
import { saveState } from '../platform/storage.js';

const SAVE_EVERY_MS = 30000;
let lastSaved = 0;
let dirty = false;

export function markDirty() {
  dirty = true;
}

export function saveNow() {
  // keeping the timer in the saved state lets a running session survive the app being closed
  G.state.timer = G.timer.active ? { ...G.timer } : null;
  saveState(G.state);
  lastSaved = Date.now();
  dirty = false;
}

export function saveIfDue() {
  if (dirty && Date.now() - lastSaved > SAVE_EVERY_MS) saveNow();
}
