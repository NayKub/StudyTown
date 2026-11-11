// Full clear: the town fills the whole screen with everything else hidden, like a video player's
// full-screen mode. A tap or a mouse move shows the exit button (and the timer, if one is running)
// for a few seconds.
import { G } from '../core/state.js';
import { $ } from '../ui/dom.js';
import * as native from '../platform/native.js';
import { setSheet } from './bottomSheet.js';

const CONTROLS_MS = 2500;
let hideTimer = 0;
let usedBrowserFullscreen = false;

export const isFullClear = () => document.body.classList.contains('fullClear');

function showControls() {
  document.body.classList.add('controls');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => document.body.classList.remove('controls'), CONTROLS_MS);
}

export function enterFullClear() {
  if (isFullClear()) return;
  setSheet(false);
  document.body.classList.add('fullClear');
  renderFullTime();
  showControls();
  native.setBarsHidden(true);
  // in a browser, also take over the whole monitor (the app on a phone hides the system bars instead)
  const root = document.documentElement;
  if (!native.isNative && root.requestFullscreen && !document.fullscreenElement) {
    root.requestFullscreen({ navigationUI: 'hide' }).then(
      () => {
        usedBrowserFullscreen = true;
      },
      () => {},
    );
  }
}

export function exitFullClear() {
  if (!isFullClear()) return;
  document.body.classList.remove('fullClear', 'controls');
  clearTimeout(hideTimer);
  native.setBarsHidden(false);
  if (usedBrowserFullscreen && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  usedBrowserFullscreen = false;
}

/** The running timer, shown next to the exit button. Called on every tick. */
export function renderFullTime() {
  if (!isFullClear()) return;
  const text = G.timer.active ? $('clock').textContent : '';
  if ($('fullTime').textContent !== text) $('fullTime').textContent = text;
}

export function initFullClear() {
  $('fullBtn').addEventListener('click', enterFullClear);
  $('fullExit').addEventListener('click', exitFullClear);
  const stage = $('stage');
  stage.addEventListener('pointerup', (e) => {
    if (isFullClear() && !e.target.closest('.fullBar')) showControls();
  });
  stage.addEventListener('mousemove', () => {
    if (isFullClear()) showControls();
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    if (e.key === 'Escape' && isFullClear()) exitFullClear();
    else if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey) {
      if (isFullClear()) exitFullClear();
      else enterFullClear();
    }
  });
  // leaving the browser's full screen (Esc, F11) also leaves full clear
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && usedBrowserFullscreen) {
      usedBrowserFullscreen = false;
      exitFullClear();
    }
  });
}
