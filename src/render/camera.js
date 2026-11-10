// Where we are looking: canvas size, automatic zoom-to-fit, and the user's own pan and zoom.
import { cv, ctx } from './canvas.js';
import { clamp } from '../core/util.js';
import { TW, TH } from '../core/city.js';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.5;
const TAP_MOVE_PX = 8; // a press that moves less than this is a tap, not a drag
const DOUBLE_TAP_MS = 320;

export const view = {
  W: 0, // canvas size in CSS pixels
  H: 0,
  DPR: 1,
  fit: 1, // zoom that fits the whole town, eased towards its target
  zoom: 1, // extra zoom chosen by the user
  panX: 0,
  panY: 0,
};

export function resize() {
  const r = cv.getBoundingClientRect();
  view.DPR = Math.min(2, window.devicePixelRatio || 1);
  view.W = r.width;
  view.H = r.height;
  cv.width = Math.max(1, view.W * view.DPR);
  cv.height = Math.max(1, view.H * view.DPR);
}

export function resetView() {
  view.zoom = 1;
  view.panX = 0;
  view.panY = 0;
}

/** Point the canvas at a town of radius R (in tiles). Called once per frame. */
export function applyCamera(R) {
  const { W, H, DPR } = view;
  const span = 2 * R + 1;
  const target = clamp(Math.min(W / (span * TW * 1.08), H / (span * TH * 1.08 + 140)), 0.3, 2.6);
  view.fit += (target - view.fit) * 0.06; // ease, so a growing town zooms out smoothly
  const s = view.fit * view.zoom;
  ctx.setTransform(DPR * s, 0, 0, DPR * s, DPR * (W / 2 + view.panX), DPR * (H / 2 + view.panY + 45 * s));
}

/** Drag to pan, pinch or wheel to zoom, double-tap to recentre. */
export function bindCameraInput() {
  const pointers = new Map(); // pointerId -> { x, y }
  let drag = null; // one finger: where the drag started
  let pinch = null; // two fingers: distance, zoom and midpoint when the pinch started
  let lastTap = 0;
  let moved = 0;

  const twoPoints = () => [...pointers.values()];
  const distance = () => {
    const [a, b] = twoPoints();
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const midpoint = () => {
    const [a, b] = twoPoints();
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  const dragFromFirstPointer = () => {
    const p = pointers.values().next().value;
    return p ? { x: p.x, y: p.y, px: view.panX, py: view.panY } : null;
  };

  cv.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      cv.setPointerCapture(e.pointerId);
    } catch {
      /* the pointer is already gone */
    }
    if (pointers.size === 1) {
      drag = dragFromFirstPointer();
      moved = 0;
      cv.classList.add('drag');
    } else if (pointers.size === 2) {
      const m = midpoint();
      pinch = { d: distance(), zoom: view.zoom, mx: m.x, my: m.y, px: view.panX, py: view.panY };
      drag = null;
    }
  });

  cv.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size >= 2 && pinch) {
      const m = midpoint();
      view.zoom = clamp((pinch.zoom * distance()) / Math.max(1, pinch.d), MIN_ZOOM, MAX_ZOOM);
      view.panX = pinch.px + m.x - pinch.mx;
      view.panY = pinch.py + m.y - pinch.my;
    } else if (drag) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      moved = Math.max(moved, Math.hypot(dx, dy));
      view.panX = drag.px + dx;
      view.panY = drag.py + dy;
    }
  });

  const release = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 1) drag = dragFromFirstPointer(); // one finger left: keep panning with it
    if (pointers.size === 0) {
      drag = null;
      cv.classList.remove('drag');
      if (e.type === 'pointerup' && moved < TAP_MOVE_PX) {
        const now = performance.now();
        if (now - lastTap < DOUBLE_TAP_MS) {
          resetView();
          lastTap = 0;
        } else {
          lastTap = now;
        }
      }
    }
  };
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', release);

  cv.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      view.zoom = clamp(view.zoom * (e.deltaY < 0 ? 1.1 : 0.9), MIN_ZOOM, MAX_ZOOM);
    },
    { passive: false },
  );
}
