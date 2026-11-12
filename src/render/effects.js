// Things that happen to a town: damaged buildings, bombs falling, the shield dome, rain and petals.
import { cv, ctx } from './canvas.js';
import { view } from './camera.js';
import { G } from '../core/state.js';
import { TW } from '../core/city.js';
import { iso } from './primitives.js';

export const BLAST_MS = 1500;
const FALL = 0.42; // share of the blast spent falling

/** True while a bomb is still falling on this plot (the building isn't damaged yet). */
export const stillFalling = (plot, now) => G.blasts.some((b) => b.plot === plot && (now - b.at) / BLAST_MS < FALL);

/** Desaturate a building while it is drawn (where the browser supports canvas filters). */
export function startDamaged() {
  if ('filter' in ctx) ctx.filter = 'saturate(0.35) brightness(0.86)';
}
export function endDamaged() {
  if ('filter' in ctx) ctx.filter = 'none';
}

/** Cracks, rubble and a thread of smoke on a damaged building. */
export function drawDamage(p, now) {
  const [cx, cy] = iso(p.x, p.y);
  ctx.fillStyle = 'rgba(60,45,50,.18)'; // scorch mark
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 22, 9, 0, 0, 7);
  ctx.fill();

  ctx.strokeStyle = 'rgba(55,40,45,.75)';
  ctx.lineWidth = 1.4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 9, cy - 26);
  ctx.lineTo(cx - 5, cy - 20);
  ctx.lineTo(cx - 8, cy - 15);
  ctx.lineTo(cx - 3, cy - 9);
  ctx.moveTo(cx - 5, cy - 20);
  ctx.lineTo(cx - 1, cy - 18);
  ctx.moveTo(cx + 7, cy - 18);
  ctx.lineTo(cx + 10, cy - 13);
  ctx.lineTo(cx + 7, cy - 8);
  ctx.stroke();

  const stones = [
    [-14, 4, 3.2, '#9a8f95'],
    [-9, 7, 2.4, '#b3a8ad'],
    [12, 5, 2.8, '#9a8f95'],
    [16, 2, 2, '#b3a8ad'],
  ];
  for (const [dx, dy, r, c] of stones) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(cx + dx, cy + dy, r * 1.3, r, 0, 0, 7);
    ctx.fill();
  }

  for (let k = 0; k < 3; k++) {
    const life = (((now / 2200 + k / 3 + p.i * 0.13) % 1) + 1) % 1;
    ctx.fillStyle = `rgba(120,115,125,${0.4 * (1 - life)})`;
    ctx.beginPath();
    ctx.arc(cx + 3 + Math.sin(life * 5 + k) * 4, cy - 30 - life * 28, 3 + life * 6, 0, 7);
    ctx.fill();
  }
}

/** A cartoon bomb, centred at (x, y). */
function bombShape(x, y, r, now) {
  ctx.fillStyle = '#3d3445';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.28, 0, 7);
  ctx.fill();
  ctx.strokeStyle = '#a8754f';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x + r * 0.5, y - r * 0.8);
  ctx.quadraticCurveTo(x + r, y - r * 1.6, x + r * 1.4, y - r * 1.3);
  ctx.stroke();
  ctx.fillStyle = now % 200 < 100 ? '#ffd36e' : '#ff8fab'; // fizzing fuse
  ctx.beginPath();
  ctx.arc(x + r * 1.45, y - r * 1.35, 2.2, 0, 7);
  ctx.fill();
}

/** A cloud of smoke with a few bright stars. k = 0..1 through the burst. */
function puff(x, y, k, colors = ['#ffffff', '#ffe4a8', '#c9c2cc']) {
  const fade = 1 - k;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const d = 6 + k * 24;
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = 0.85 * fade;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, 7 + k * 8, 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = fade;
  ctx.fillStyle = '#ffd36e';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    const d = 12 + k * 34;
    ctx.fillRect(x + Math.cos(a) * d - 1.5, y + Math.sin(a) * d * 0.7 - 1.5, 3, 3);
  }
  ctx.globalAlpha = 1;
}

/** Shape of the shield dome over a town of radius R: [centreX, centreY, radiusX, radiusY]. */
function domeOf(R) {
  const [cx, cy] = iso(0, 0);
  const rx = (R + 0.6) * TW;
  return [cx, cy, rx, rx * 0.78];
}

/** Bombs falling and bursting (in town coordinates, after everything on the ground). */
export function drawBlasts(now, R) {
  G.blasts = G.blasts.filter((b) => now - b.at < BLAST_MS);
  for (const b of G.blasts) {
    const k = (now - b.at) / BLAST_MS;
    if (k < 0) continue; // waiting its turn
    let x;
    let y;
    if (b.plot < 0) {
      // stopped by the shield: it bursts on top of the dome
      const [cx, cy, , ry] = domeOf(R);
      x = cx;
      y = cy - ry * 0.95;
    } else {
      [x, y] = iso(b.px, b.py);
      y -= 14;
    }
    if (k < FALL) {
      const f = k / FALL;
      bombShape(x, y - 240 * (1 - f * f), 7, now);
    } else {
      const shieldColors = ['#d6efff', '#a9d4ff', '#ffffff'];
      puff(x, y, (k - FALL) / (1 - FALL), b.plot < 0 ? shieldColors : undefined);
    }
  }
}

/** A clear bubble over a protected town. */
export function drawShield(now, R) {
  const [cx, cy, rx, ry] = domeOf(R);
  const shimmer = 0.5 + 0.5 * Math.sin(now / 900);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0);
  ctx.ellipse(cx, cy, rx, ry * 0.35, 0, 0, Math.PI);
  ctx.closePath();
  ctx.fillStyle = `rgba(150,205,255,${0.1 + shimmer * 0.04})`;
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,205,255,.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.7)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.82, ry * 0.82, 0, Math.PI * 1.18, Math.PI * 1.38);
  ctx.stroke();
  ctx.restore();
}

const drops = Array.from({ length: 90 }, () => [Math.random(), Math.random(), 0.7 + Math.random() * 0.6]);
const petals = Array.from({ length: 26 }, () => [Math.random(), Math.random(), Math.random()]);

/** Rain and falling petals, drawn over everything in screen pixels. */
export function drawWeather(now, { rain, petalsFall }) {
  if (!rain && !petalsFall) return;
  const { DPR } = view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const W = cv.width;
  const H = cv.height;
  if (rain) {
    ctx.strokeStyle = 'rgba(190,210,235,.55)';
    ctx.lineWidth = 1.2 * DPR;
    ctx.beginPath();
    for (const [x, y, speed] of drops) {
      const py = ((y + (now / 900) * speed) % 1) * (H + 40 * DPR) - 20 * DPR;
      const px = ((x + py / H / 6) % 1) * W;
      ctx.moveTo(px, py);
      ctx.lineTo(px - 4 * DPR, py + 14 * DPR);
    }
    ctx.stroke();
  }
  if (petalsFall) {
    for (const [x, y, s] of petals) {
      const t = now / (9000 + s * 5000);
      const py = ((y + t) % 1) * (H + 30 * DPR) - 15 * DPR;
      const px = ((x + Math.sin(t * 6 + s * 9) * 0.03 + t * 0.15) % 1) * W;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(t * 8 + s * 6);
      ctx.fillStyle = s > 0.5 ? 'rgba(255,183,207,.9)' : 'rgba(255,214,228,.95)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 4 * DPR, 2.4 * DPR, 0, 0, 7);
      ctx.fill();
      ctx.restore();
    }
  }
}
