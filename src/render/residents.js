// The little animals that wander around the town.
import { ctx } from './canvas.js';
import { G, curMin } from '../core/state.js';
import { clamp } from '../core/util.js';
import { isRoad, ring, plotAt, cityAt, kindOf } from '../core/city.js';
import { iso, shade, pts } from './primitives.js';

const SPECIES = ['bunny', 'cat', 'bear', 'chick', 'frog', 'pig'];
const BODY_COLOR = {
  bunny: '#fff4f8',
  cat: '#ffd9a8',
  bear: '#d9b08c',
  chick: '#ffe680',
  frog: '#a8e6a1',
  pig: '#ffc4d6',
};
const WALK_SPEED = 0.9; // tiles per second
// prettier-ignore
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BUBBLES_STUDYING = ['📖', '✏️', '💪', '⭐'];
const BUBBLES_IDLE = ['♪', '💕', '✨', '🌸'];
const EYE = '#3b2f40';

/** Each resident: species, position (x, y), the tile it stands on (cx, cy) and walks to (tx, ty). */
export let residents = [];

// The town the residents currently live in. The scene updates it once per frame, so after
// switching towns (peek ahead, visiting) they move in on the next frame.
let town = cityAt(0);
let buildings = { choices: {}, chooseFrom: Infinity, unlocked: Infinity }; // whose buildings stand there
export function setTown(city, shownBuildings) {
  town = city;
  buildings = shownBuildings;
}

/** Residents walk on roads, empty land, and through parks. */
function walkable(x, y) {
  if (ring(x, y) > town.R) return false;
  if (isRoad(x, y)) return true;
  const p = plotAt[x + ',' + y];
  if (!p) return false;
  if (p.t > curMin()) return true; // not built yet
  const kind = kindOf(p, buildings);
  return kind === 'trees' || kind === 'garden';
}

function randomWalkable() {
  const side = 2 * town.R + 1;
  for (let k = 0; k < 200; k++) {
    const x = Math.floor(Math.random() * side) - town.R;
    const y = Math.floor(Math.random() * side) - town.R;
    if (walkable(x, y)) return { x, y };
  }
  return { x: town.R, y: town.R };
}

function newResident(i) {
  const sp = SPECIES[i % SPECIES.length];
  const c = randomWalkable();
  return {
    sp,
    x: c.x,
    y: c.y,
    cx: c.x,
    cy: c.y,
    tx: c.x,
    ty: c.y,
    wait: Math.random() * 2,
    phase: Math.random() * 6,
    dir: 1,
    bubble: 0,
    bt: '',
  };
}

/** Match the number of residents to the town's population. all = start over with new residents. */
export function syncResidents(all) {
  if (all) residents = [];
  while (residents.length < town.pop) residents.push(newResident(residents.length));
  if (residents.length > town.pop) residents.length = town.pop;
  residents.forEach((c) => {
    if (walkable(c.cx, c.cy)) return;
    const p = randomWalkable(); // a building appeared where they stood
    c.x = c.cx = c.tx = p.x;
    c.y = c.cy = c.ty = p.y;
  });
}

function pickNextStep(c, studying) {
  const options = STEPS.map(([a, b]) => [c.cx + a, c.cy + b]).filter(([a, b]) => walkable(a, b));
  if (options.length) {
    const o = options[Math.floor(Math.random() * options.length)];
    c.tx = o[0];
    c.ty = o[1];
  }
  c.wait = Math.random() < 0.3 ? 1 + Math.random() * 3 : 0;
  if (Math.random() < 0.06) {
    c.bubble = 2.2;
    c.bt = (studying ? BUBBLES_STUDYING : BUBBLES_IDLE)[Math.floor(Math.random() * 4)];
  }
}

export function updateResidents(dt) {
  const studying = G.timer.running;
  for (const c of residents) {
    const dx = c.tx - c.x;
    const dy = c.ty - c.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.01) {
      // walking towards the next tile
      const step = WALK_SPEED * dt;
      if (d <= step) {
        c.x = c.tx;
        c.y = c.ty;
      } else {
        c.x += (dx / d) * step;
        c.y += (dy / d) * step;
      }
      c.phase += dt * 12;
      if (Math.abs(dx - dy) > 0.01) c.dir = dx - dy > 0 ? 1 : -1;
    } else {
      // arrived: rest a moment, then choose where to go
      c.cx = c.tx;
      c.cy = c.ty;
      c.wait -= dt;
      if (c.wait <= 0) pickNextStep(c, studying);
    }
    if (c.bubble > 0) c.bubble -= dt;
  }
}

// ---------- drawing ----------
function ear(x, y, rx, ry, rot, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, 7);
  ctx.fill();
  ctx.stroke();
}

/** Triangular ears on both sides. points = [[dx, dy], ...] for the right ear, mirrored for the left. */
function pointedEars(sx, by, col, points) {
  for (const side of [-1, 1]) {
    ctx.fillStyle = col;
    ctx.beginPath();
    points.forEach(([dx, dy], i) => {
      if (i === 0) ctx.moveTo(sx + side * dx, by + dy);
      else ctx.lineTo(sx + side * dx, by + dy);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawEars(sp, sx, by, col) {
  if (sp === 'bunny') {
    ear(sx - 3.5, by - 10, 2.6, 6.5, -0.2, col);
    ear(sx + 3.5, by - 10, 2.6, 6.5, 0.2, col);
    ctx.fillStyle = '#ffc4d6'; // inner ears
    ctx.beginPath();
    ctx.ellipse(sx - 3.5, by - 10, 1.1, 4, -0.2, 0, 7);
    ctx.ellipse(sx + 3.5, by - 10, 1.1, 4, 0.2, 0, 7);
    ctx.fill();
  }
  if (sp === 'bear') {
    ear(sx - 6, by - 6, 3, 3, 0, col);
    ear(sx + 6, by - 6, 3, 3, 0, col);
  }
  if (sp === 'cat') pointedEars(sx, by, col, pts(7.5, -3, 6, -12, 1.5, -7));
  if (sp === 'pig') pointedEars(sx, by, col, pts(7, -4, 7, -10, 2.5, -7));
  if (sp === 'frog') {
    // bulging eyes sit where ears would be
    ear(sx - 4.5, by - 7, 3.4, 3.4, 0, col);
    ear(sx + 4.5, by - 7, 3.4, 3.4, 0, col);
  }
}

function drawFace(sp, sx, by, look, dark) {
  const eyeY = sp === 'frog' ? -7 : -1;
  const eyeX = sp === 'frog' ? 4.5 : 3;
  ctx.fillStyle = EYE;
  ctx.beginPath();
  ctx.arc(sx - eyeX + look, by + eyeY, 1.4, 0, 7);
  ctx.arc(sx + eyeX + look, by + eyeY, 1.4, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#fff'; // eye shine
  ctx.beginPath();
  ctx.arc(sx - eyeX + look + 0.5, by + eyeY - 0.5, 0.5, 0, 7);
  ctx.arc(sx + eyeX + look + 0.5, by + eyeY - 0.5, 0.5, 0, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,130,160,.55)'; // cheeks
  ctx.beginPath();
  ctx.arc(sx - 5.5 + look, by + 2.5, 1.8, 0, 7);
  ctx.arc(sx + 5.5 + look, by + 2.5, 1.8, 0, 7);
  ctx.fill();

  if (sp === 'chick') {
    ctx.fillStyle = '#ff9f43'; // beak
    ctx.beginPath();
    ctx.moveTo(sx + look - 1.6, by + 1.5);
    ctx.lineTo(sx + look + 1.6, by + 1.5);
    ctx.lineTo(sx + look, by + 3.5);
    ctx.fill();
  } else if (sp === 'pig') {
    ctx.fillStyle = '#ff9fbf'; // snout
    ctx.beginPath();
    ctx.ellipse(sx + look, by + 2.5, 2.6, 1.8, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.fillRect(sx + look - 1.2, by + 2, 0.8, 1);
    ctx.fillRect(sx + look + 0.4, by + 2, 0.8, 1);
  } else {
    ctx.strokeStyle = EYE; // smile
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(sx + look - 0.9, by + 2, 0.9, 0, Math.PI);
    ctx.arc(sx + look + 0.9, by + 2, 0.9, 0, Math.PI);
    ctx.stroke();
  }
}

function drawBubble(c, sx, by) {
  ctx.globalAlpha = clamp(c.bubble, 0, 1);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(sx + 10, by - 20, 8, 7, 0, 0, 7);
  ctx.fill();
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#4a3b52';
  ctx.fillText(c.bt, sx + 10, by - 17);
  ctx.textAlign = 'start';
  ctx.globalAlpha = 1;
}

export function drawResident(c, now) {
  const [sx, sy] = iso(c.x, c.y);
  const moving = Math.hypot(c.tx - c.x, c.ty - c.y) > 0.01;
  const bob = moving ? Math.abs(Math.sin(c.phase)) * 3 : Math.sin(now / 400 + c.phase) * 0.6;
  const by = sy - 10 - bob; // centre of the body
  const col = BODY_COLOR[c.sp];
  const dark = shade(col, -0.35);

  ctx.fillStyle = 'rgba(0,0,0,.15)'; // shadow
  ctx.beginPath();
  ctx.ellipse(sx, sy, 7, 3, 0, 0, 7);
  ctx.fill();

  ctx.lineWidth = 1.2;
  ctx.strokeStyle = dark;
  drawEars(c.sp, sx, by, col);

  const stride = moving ? Math.sin(c.phase) * 1.5 : 0; // feet
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(sx - 3.5, sy - 1 + stride, 2.4, 1.5, 0, 0, 7);
  ctx.ellipse(sx + 3.5, sy - 1 - stride, 2.4, 1.5, 0, 0, 7);
  ctx.fill();

  ctx.fillStyle = col; // body
  ctx.beginPath();
  ctx.ellipse(sx, by, 8.5, 8, 0, 0, 7);
  ctx.fill();
  ctx.stroke();

  if (c.sp === 'chick') {
    ctx.strokeStyle = '#e0b000'; // tuft
    ctx.beginPath();
    ctx.moveTo(sx, by - 8);
    ctx.quadraticCurveTo(sx + 1, by - 13, sx + 3, by - 12);
    ctx.stroke();
  }

  drawFace(c.sp, sx, by, c.dir * 1.2, dark);
  if (c.bubble > 0) drawBubble(c, sx, by);
}
