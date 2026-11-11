// On phones in portrait the side panel is a bottom sheet: the timer peeks out, and tapping or
// swiping the handle slides the rest (weekly chart, friends, stats) into view.
import { clamp } from '../core/util.js';
import { t } from '../i18n/index.js';
import { $ } from '../ui/dom.js';

const OPEN_HEIGHT = 0.88; // of the screen height; must match `.side.open` in styles.css
const TAP_MOVE_PX = 6;
const SWIPE_PX = 40; // how far the handle must travel to open or close
const PULL_DOWN_PX = 90; // pulling the open sheet's content down this far closes it

const side = document.querySelector('.side');
const portrait = window.matchMedia('(max-width:820px) and (orientation:portrait)');
let open = false;

export const isSheetOpen = () => open;

export function renderSheetLabel() {
  $('sheetLabel').textContent = t(open ? 'sheet.less' : 'sheet.more');
}

export function setSheet(wantOpen) {
  open = wantOpen && portrait.matches;
  side.classList.toggle('open', open);
  document.body.classList.toggle('sheetOpen', open);
  $('sheetHandle').setAttribute('aria-expanded', String(open));
  renderSheetLabel();
  if (!open) side.scrollTop = 0;
  side.style.height = ''; // hand control back to the stylesheet after a drag
}

/**
 * The closed sheet shows everything down to the "next building" card (or, while visiting, the
 * friend's details); tell the CSS how tall that is.
 */
function measurePeek() {
  if (!portrait.matches) return;
  const visiting = document.body.classList.contains('visiting');
  const next = document.querySelector(visiting ? '.friendPanel' : '.next');
  const pad = parseFloat(getComputedStyle(side).paddingBottom) || 10;
  const peek = Math.ceil(next.offsetTop + next.offsetHeight + pad);
  document.documentElement.style.setProperty('--peek', peek + 'px');
}

function bindHandle() {
  const handle = $('sheetHandle');
  let drag = null; // { y, h, moved } while a finger is on the handle

  handle.addEventListener('pointerdown', (e) => {
    if (!portrait.matches) return;
    drag = { y: e.clientY, h: side.getBoundingClientRect().height, moved: 0 };
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      /* the pointer is already gone */
    }
    side.classList.add('dragging'); // turns the height transition off so the sheet follows the finger
  });

  handle.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.y;
    drag.moved = Math.max(drag.moved, Math.abs(dy));
    const max = window.innerHeight * OPEN_HEIGHT;
    const min = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--peek')) || 200;
    side.style.height = clamp(drag.h - dy, min, max) + 'px';
  });

  const release = () => {
    if (!drag) return;
    side.classList.remove('dragging');
    const height = side.getBoundingClientRect().height;
    const { h: startHeight, moved } = drag;
    drag = null;
    if (moved < TAP_MOVE_PX)
      setSheet(!open); // a tap toggles
    else if (height > startHeight)
      setSheet(height - startHeight > SWIPE_PX); // swiped up
    else setSheet(startHeight - height < SWIPE_PX); // swiped down
  };
  handle.addEventListener('pointerup', release);
  handle.addEventListener('pointercancel', release);
}

/** Pulling down on the open sheet while it is scrolled to the top closes it. */
function bindPullDownToClose() {
  let startY = null;
  side.addEventListener(
    'touchstart',
    (e) => {
      startY = open && side.scrollTop <= 0 ? e.touches[0].clientY : null;
    },
    { passive: true },
  );
  side.addEventListener(
    'touchmove',
    (e) => {
      if (startY != null && e.touches[0].clientY - startY > PULL_DOWN_PX) {
        startY = null;
        setSheet(false);
      }
    },
    { passive: true },
  );
}

export function initSheet() {
  bindHandle();
  bindPullDownToClose();
  $('sheetShade').addEventListener('click', () => setSheet(false));
  new ResizeObserver(measurePeek).observe(document.querySelector('.timerCard'));
  new ResizeObserver(measurePeek).observe(document.querySelector('.next'));
  new ResizeObserver(measurePeek).observe(document.querySelector('.friendPanel'));
  portrait.addEventListener('change', () => {
    setSheet(false);
    measurePeek();
  });
  measurePeek();
  setSheet(false);
}
