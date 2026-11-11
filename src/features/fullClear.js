// Full clear: the town fills the whole screen with everything else hidden, like a video player's
// full-screen mode. The timer stays as a ring in the top-left corner with start/pause and end
// buttons under it; a tap or a mouse move shows the exit button for a few seconds.
import { G } from '../core/state.js';
import { $ } from '../ui/dom.js';
import * as native from '../platform/native.js';
import { setSheet } from './bottomSheet.js';
import { sessionProgress, onStartClick, onStopClick } from './timer.js';
import { t } from '../i18n/index.js';
import { icon } from '../ui/icons.js';

const CONTROLS_MS = 2500;
const ARC_LENGTH = 175.93; // circumference of the ring in index.html (r = 28)
const fresh = () => ({ text: null, paused: null, offset: null, play: null, visit: null });
let shown = fresh();
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
  shown = fresh();
  if (usedBrowserFullscreen && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  usedBrowserFullscreen = false;
}

/** The timer ring and its buttons. Called on every tick and after each button press. */
export function renderFullTime() {
  if (!isFullClear()) return;
  const box = $('fullTimer');
  const visiting = Boolean(G.visit);
  // in a friend's town the timer can't be used, so only a session already running is shown
  box.hidden = visiting && !G.timer.active;
  if (box.hidden) return;
  const text = $('clock').textContent;
  if (shown.text !== text) {
    $('fullTime').textContent = text;
    $('fullTime').classList.toggle('long', text.length > 5);
    shown.text = text;
  }
  const paused = G.timer.active && !G.timer.running;
  if (shown.paused !== paused) {
    box.classList.toggle('paused', paused);
    shown.paused = paused;
  }
  const offset = (ARC_LENGTH * (1 - sessionProgress())).toFixed(2);
  if (shown.offset !== offset) {
    $('fullArc').setAttribute('stroke-dashoffset', offset);
    shown.offset = offset;
  }
  const play = G.timer.running ? 'pause' : G.timer.active ? 'resume' : 'start';
  if (shown.play !== play || shown.visit !== visiting) {
    const btn = $('fullPlay');
    btn.innerHTML = icon(G.timer.running ? 'pause' : 'play');
    btn.setAttribute('aria-label', t('btn.' + play));
    btn.title = t('btn.' + play);
    $('fullStop').hidden = !G.timer.active;
    $('fullStop').title = t('btn.stop');
    $('fullCtl').hidden = visiting;
    shown.play = play;
    shown.visit = visiting;
  }
}

export function initFullClear() {
  $('fullBtn').addEventListener('click', enterFullClear);
  $('fullExit').addEventListener('click', exitFullClear);
  $('fullPlay').addEventListener('click', () => {
    onStartClick();
    renderFullTime();
  });
  $('fullStop').addEventListener('click', () => {
    onStopClick();
    renderFullTime();
  });
  const stage = $('stage');
  stage.addEventListener('pointerup', (e) => {
    if (isFullClear() && !e.target.closest('.fullBar, .fullTimer')) showControls();
  });
  stage.addEventListener('mousemove', () => {
    if (isFullClear()) showControls();
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    if (e.key === 'Escape' && isFullClear()) exitFullClear();
    else if (e.key === ' ' && isFullClear() && !e.target.closest('button')) {
      e.preventDefault(); // space starts or pauses the timer, like a video player
      if (!G.visit) $('fullPlay').click();
    } else if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey) {
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
