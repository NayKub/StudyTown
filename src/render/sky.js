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

function skyGradient(night, dusk, theme) {
  const sky = ctx.createLinearGradient(0, 0, 0, view.H * view.DPR);
  if (theme === 'aurora') {
    sky.addColorStop(0, '#16203f');
    sky.addColorStop(1, '#2f4a6b');
  } else if (theme === 'sunset') {
    sky.addColorStop(0, '#ff9a8b');
    sky.addColorStop(0.6, '#ffc3a0');
    sky.addColorStop(1, '#ffe3b8');
  } else if (theme === 'petals' && !night) {
    sky.addColorStop(0, dusk ? '#ffb4c2' : '#ffd6e4');
    sky.addColorStop(1, '#fff3f6');
  } else if (night) {
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

/** Soft green and violet curtains of light. */
function drawAurora(now) {
  const { DPR } = view;
  const w = cv.width;
  const bands = [
    ['rgba(120,255,190,', 0.16, 0],
    ['rgba(170,140,255,', 0.26, 2],
  ];
  for (const [rgba, top, offset] of bands) {
    const y0 = cv.height * top;
    const g = ctx.createLinearGradient(0, y0 - 60 * DPR, 0, y0 + 70 * DPR);
    g.addColorStop(0, rgba + '0)');
    g.addColorStop(0.5, rgba + '.35)');
    g.addColorStop(1, rgba + '0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 12 * DPR) {
      const y = y0 + Math.sin(x / (140 * DPR) + now / 2600 + offset) * 26 * DPR;
      if (x === 0) ctx.moveTo(x, y - 50 * DPR);
      else ctx.lineTo(x, y - 50 * DPR);
    }
    for (let x = w; x >= 0; x -= 12 * DPR) {
      const y = y0 + Math.sin(x / (140 * DPR) + now / 2600 + offset + 0.6) * 26 * DPR;
      ctx.lineTo(x, y + 50 * DPR);
    }
    ctx.closePath();
    ctx.fill();
  }
}

/** A big low sun for the sunset sky. */
function drawSun() {
  const { DPR } = view;
  const x = cv.width * 0.8;
  const y = cv.height * 0.3;
  const g = ctx.createRadialGradient(x, y, 0, x, y, 70 * DPR);
  g.addColorStop(0, 'rgba(255,240,190,.95)');
  g.addColorStop(0.45, 'rgba(255,214,150,.6)');
  g.addColorStop(1, 'rgba(255,200,140,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 70 * DPR, y - 70 * DPR, 140 * DPR, 140 * DPR);
}

/** Every few seconds a star shoots across the starry sky. */
function drawShootingStar(now) {
  const { DPR } = view;
  const period = 7000;
  const k = (now % period) / 900;
  if (k > 1) return;
  const n = Math.floor(now / period);
  const x = cv.width * (0.2 + ((n * 0.37) % 0.6)) - k * 160 * DPR;
  const y = cv.height * (0.08 + ((n * 0.21) % 0.2)) + k * 70 * DPR;
  const g = ctx.createLinearGradient(x, y, x + 60 * DPR, y - 26 * DPR);
  g.addColorStop(0, `rgba(255,255,255,${1 - k})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = g;
  ctx.lineWidth = 2 * DPR;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 60 * DPR, y - 26 * DPR);
  ctx.stroke();
}

/** Fills the whole canvas (in raw pixels, ignoring the camera). */
export function drawSky(now, { night, dusk, sky: theme }, gloomy = false) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = skyGradient(night, dusk, theme);
  ctx.fillRect(0, 0, cv.width, cv.height);
  if (G.visit) {
    ctx.fillStyle = 'rgba(160,120,255,.22)'; // lavender sky = a friend's town
    ctx.fillRect(0, 0, cv.width, cv.height);
  }
  if (theme === 'sunset') drawSun();
  if (theme === 'aurora') drawAurora(now);
  if (night) drawStars(now);
  else drawClouds(now);
  if (theme === 'starry') drawShootingStar(now);
  if (gloomy) {
    ctx.fillStyle = 'rgba(70,80,100,.28)'; // a thunder cloud's rain: the sky turns grey
    ctx.fillRect(0, 0, cv.width, cv.height);
  }
}
