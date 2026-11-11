// Small DOM helpers shared by the feature modules.
import { t } from '../i18n/index.js';

export const $ = (id) => document.getElementById(id);

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escape text before putting it into innerHTML. */
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESCAPES[c]);

export const isShown = (id) => $(id).classList.contains('show');
export const showModal = (id) => $(id).classList.add('show');
export const hideModal = (id) => $(id).classList.remove('show');

// ---------- toasts ----------
// Only one toast is on screen at a time. Things that happen in the same moment (a building, a new
// rank and an achievement, say) are gathered into a single message instead of a stack.
const GATHER_MS = 60; // messages arriving within this window count as "the same moment"
const BASE_MS = 2600; // time on screen for a one-line toast
const PER_LINE_MS = 900; // extra reading time for each further line
const MAX_LINES = 3;
const GAP_MS = 250; // pause between two toasts

let gathering = []; // lines waiting to be combined
const waiting = []; // combined messages waiting for their turn
let showing = false;

function showNext() {
  const lines = waiting.shift();
  if (!lines) {
    showing = false;
    return;
  }
  showing = true;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = lines.join('\n');
  $('toasts').replaceChildren(el);
  const stay = BASE_MS + PER_LINE_MS * (lines.length - 1);
  el.style.setProperty('--stay', stay + 'ms');
  setTimeout(() => {
    el.remove();
    setTimeout(showNext, GAP_MS);
  }, stay);
}

function flushGathered() {
  let lines = [...new Set(gathering)]; // the same news twice is still one line
  gathering = [];
  if (lines.length > MAX_LINES) {
    const extra = lines.length - (MAX_LINES - 1);
    lines = [...lines.slice(0, MAX_LINES - 1), t('toast.more', { count: extra })];
  }
  waiting.push(lines);
  if (!showing) showNext();
}

/** Show a short message at the top of the town. */
export function toast(text) {
  if (!gathering.length) setTimeout(flushGathered, GATHER_MS);
  gathering.push(text);
}
