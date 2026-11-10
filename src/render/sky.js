// Sky that follows the real time of day: blue by day, warm at dusk and dawn, starry at night.
import { cv, ctx } from './canvas.js';
import { G } from '../core/state.js';
import { view } from './camera.js';

/** [x, y, twinkle offset] for each star, as fractions of the canvas. */
const stars = Array.from({ length: 60 }, () => [Math.random(), Math.random() * 0.6, Math.random()]);

/** { night, dusk } for the current local time. */
export function timeOfDay() {
  const hr = new Date().getHours() + new Date().getMinutes() / 60;
  return {
    night: hr >= 19 || hr < 6,
    dusk: (hr >= 17 && hr < 19) || (hr >= 5 && hr < 7),
  };
}

function skyGradient(night, dusk) {
  const sky = ctx.createLinearGradient(0, 0, 0, view.H * view.DPR);
  if (night) {
    sky.addColorStop(0, '#2b2d5c');
    sky.addColorStop(1, '#5b5590');
  } else if (dusk) {
    sky.addColorStop(0, '#ffb4a2');
    sky.addColorStop(1, '#ffe5c4');
  } else {
    sky.addColorStop(0, '#bfe6ff');
    sky.addColorStop(1, '#eaf7ff');
  }
  return sky;
}

function drawStars(now) {
  const { DPR } = view;
  ctx.fillStyle = '#fff';
  for (const [x, y, offset] of stars) {
    ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(now / 900 + offset * 9));
    ctx.fillRect(x * cv.width, y * cv.height, 2 * DPR, 2 * DPR);
  }
  ctx.globalAlpha = 1;
}

function drawClouds(now) {
  const { W, DPR } = view;
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  for (let k = 0; k < 4; k++) {
    // each cloud drifts across at its own speed and wraps around
    const x = ((((now / 60000) * (k + 1) * 0.6 + k * 0.27) % 1.2) - 0.1) * W * DPR;
    const y = (40 + k * 55) * DPR;
    ctx.beginPath();
    ctx.ellipse(x, y, 40 * DPR, 14 * DPR, 0, 0, 7);
    ctx.ellipse(x + 26 * DPR, y - 8 * DPR, 24 * DPR, 14 * DPR, 0, 0, 7);
    ctx.fill();
  }
}

/** Fills the whole canvas (in raw pixels, ignoring the camera). */
export function drawSky(now, { night, dusk }) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = skyGradient(night, dusk);
  ctx.fillRect(0, 0, cv.width, cv.height);
  if (G.visit) {
    ctx.fillStyle = 'rgba(160,120,255,.22)'; // lavender sky = a friend's town
    ctx.fillRect(0, 0, cv.width, cv.height);
  }
  if (night) drawStars(now);
  else drawClouds(now);
}
