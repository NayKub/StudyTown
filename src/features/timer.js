// The study timer: choose a length, start / pause / end, and turn elapsed time into study time.
//
// Time is measured from the wall clock (`startedAt`), not by counting ticks, so the session keeps
// its place while the app is in the background or even closed. `credit()` moves the seconds that
// have passed since the last call into the saved totals.
import { G } from '../core/state.js';
import { clamp } from '../core/util.js';
import { todayKey } from '../core/dates.js';
import { t } from '../i18n/index.js';
import { $, toast, showModal, hideModal } from '../ui/dom.js';
import * as native from '../platform/native.js';
import { markDirty, saveNow } from './persistence.js';
import { checkGrowth } from './growth.js';
import { chime, unlockAudio } from './audio.js';
import { leavePreview, endVisit } from './townView.js';
import { renderWeek } from './studyLog.js';
import { sync } from './account/index.js';

const PRESET_MINUTES = [15, 25, 45, 60];
const MAX_CUSTOM_MINUTES = 240;
const RING_LENGTH = 540.35; // circumference of the progress ring in index.html
const MIN_SESSION_SEC = 30; // shorter sessions are treated as accidental taps
const MAX_SESSIONS_KEPT = 2000;

const timer = G.timer;

/** Seconds studied in this session so far. */
const elapsed = () => timer.before + (timer.running ? (Date.now() - timer.startedAt) / 1000 : 0);

const formatClock = (sec) =>
  String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(Math.floor(sec % 60)).padStart(2, '0');

// ---------- choosing the length ----------
const presetChips = () => document.querySelectorAll('#presets .chip');

function setPresetsDisabled(disabled) {
  presetChips().forEach((chip) => {
    chip.disabled = disabled;
  });
  const custom = $('customMin');
  if (custom) custom.disabled = disabled;
}

export function renderPresets() {
  const minutes = Math.round(timer.dur / 60);
  const isCustom = !PRESET_MINUTES.includes(minutes);
  const chips = PRESET_MINUTES.map(
    (m) => `<button class="chip${m === minutes ? ' on' : ''}" data-m="${m}">${t('unit.min', { m })}</button>`,
  ).join('');
  $('presets').innerHTML =
    chips +
    `<span class="custom">${t('custom.or')} <input id="customMin" type="number" inputmode="numeric" min="1" max="240" placeholder="${t('custom.placeholder')}" value="${isCustom ? minutes : ''}"></span>`;
  setPresetsDisabled(timer.active);
}

function setDuration(minutes) {
  if (timer.active) return;
  timer.dur = Math.round(minutes * 60);
  renderTimer();
}

function onPresetClick(e) {
  const chip = e.target.closest('.chip');
  if (!chip || timer.active) return;
  setDuration(+chip.dataset.m);
  renderPresets();
}

function onCustomInput(e) {
  if (e.target.id !== 'customMin' || timer.active) return;
  const minutes = clamp(Math.floor(+e.target.value || 0), 0, MAX_CUSTOM_MINUTES);
  if (minutes < 1) return;
  presetChips().forEach((chip) => chip.classList.remove('on'));
  setDuration(minutes);
}

// ---------- running ----------
/** Keep the screen on while studying, if the user asked for that. */
export function applyAwake() {
  native.setAwake(timer.running && G.settings.keepAwake);
}

/** Move newly elapsed seconds into the saved totals. Safe to call at any time. */
export function credit() {
  const add = Math.floor(Math.min(elapsed(), timer.dur)) - timer.credited;
  if (add <= 0) return;
  timer.credited += add;
  G.state.totalSec += add;
  const k = todayKey();
  G.state.days[k] = (G.state.days[k] || 0) + add;
  markDirty();
  checkGrowth();
}

function pause() {
  timer.before = elapsed();
  timer.running = false;
  credit();
}

function startOrResume() {
  if (!timer.active) {
    timer.before = 0;
    timer.credited = 0;
    timer.active = true;
    timer.sessionStart = Date.now();
  }
  timer.startedAt = Date.now();
  timer.running = true;
  leavePreview();
  if (G.settings.notify) native.ensureNotifyPermission();
}

function onStartClick() {
  if (G.visit) return; // the timer can only be used in your own town
  unlockAudio();
  if (timer.running) pause();
  else startOrResume();
  if (G.settings.haptics) native.buzz('light');
  applyAwake();
  setPresetsDisabled(timer.active);
  renderTimer();
  saveNow();
}

function onStopClick() {
  if (!timer.active || G.visit) return;
  pause();
  endSession(false, Math.floor(timer.credited / 60));
}

/** Add the finished session to the study log. */
function recordSession() {
  if (timer.credited < MIN_SESSION_SEC) return;
  if (!Array.isArray(G.state.sessions)) G.state.sessions = [];
  const start = timer.sessionStart || Date.now();
  // if the app was closed for days mid-session, don't show a session that long
  const latestEnd = start + Math.max(timer.dur, timer.credited) * 1000 + 3600e3;
  G.state.sessions.push({ at: start, end: Math.min(Date.now(), latestEnd), sec: timer.credited });
  const extra = G.state.sessions.length - MAX_SESSIONS_KEPT;
  if (extra > 0) G.state.sessions.splice(0, extra);
}

/** completed = the timer ran out (as opposed to the user pressing End). */
function endSession(completed, minutes) {
  recordSession();
  timer.active = false;
  timer.running = false;
  timer.before = 0;
  timer.credited = 0;
  native.cancelDone();
  applyAwake();
  setPresetsDisabled(false);
  saveNow();
  renderTimer();
  renderWeek();
  sync(true);
  if (completed) {
    chime();
    if (G.settings.haptics) native.buzz('success');
    $('doneText').textContent = t('done.text', { m: minutes });
    showModal('doneModal');
  } else if (minutes > 0) {
    toast(t('toast.saved', { m: minutes }));
  }
}

/** Called four times a second. */
export function tickTimer() {
  if (!timer.running) return;
  credit();
  if (elapsed() >= timer.dur) {
    const minutes = Math.round(timer.dur / 60);
    timer.before = timer.dur;
    timer.running = false;
    credit();
    endSession(true, minutes);
  }
}

/** When the running session will end, or null if nothing is running (used for the notification). */
export function sessionEndTime() {
  if (!timer.running) return null;
  return new Date(timer.startedAt + (timer.dur - timer.before) * 1000);
}

export const sessionMinutes = () => Math.round(timer.dur / 60);

// ---------- display ----------
export function renderTimer() {
  const done = timer.active ? Math.min(elapsed(), timer.dur) : 0;
  const text = formatClock(Math.max(0, timer.dur - done));
  $('clock').textContent = text;
  $('ring').setAttribute('stroke-dashoffset', RING_LENGTH * (1 - done / timer.dur));
  $('status').textContent = t(!timer.active ? 'status.ready' : timer.running ? 'status.studying' : 'status.paused');
  $('startBtn').textContent = t(timer.running ? 'btn.pause' : timer.active ? 'btn.resume' : 'btn.start');
  document.title = timer.running ? text + ' • ' + t('app.title') : t('app.title');

  // while visiting a friend, your own session shows on the purple banner
  const banner = $('visitTimer');
  banner.hidden = !(G.visit && timer.active);
  if (!banner.hidden) banner.textContent = (timer.running ? '⏱ ' : '⏸ ') + text;
}

export function initTimer() {
  $('presets').addEventListener('click', onPresetClick);
  $('presets').addEventListener('input', onCustomInput);
  $('startBtn').addEventListener('click', onStartClick);
  $('stopBtn').addEventListener('click', onStopClick);
  $('doneOk').addEventListener('click', () => {
    hideModal('doneModal');
    if (G.visit) endVisit(); // "See my town"
  });
}
