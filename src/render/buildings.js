// How every kind of plot looks at every upgrade tier.
// Each painter gets one object: { p, cx, cy, tier, night, now, seed }.
import { ctx } from './canvas.js';
import { G } from '../core/state.js';
import { clamp } from '../core/util.js';
import { tierOf, hash } from '../core/city.js';
import { iso, poly, pts, circle, prism, faceQuad, windows, pyramidRoof, tree, flower } from './primitives.js';
import { shopSign } from './shopSign.js';

const DOOR = '#a8754f';
const WINDOW_DAY = '#cfeaff';
const WINDOW_LIT = '#ffe48a';
const BUILD_ANIM_MS = 900;

// ---------- town hall: tent -> house -> hall -> clock tower ----------
function tent({ cx, cy, now }) {
  poly(pts(cx - 20, cy + 2, cx, cy + 12, cx, cy - 22), '#ffb36b');
  poly(pts(cx, cy + 12, cx + 20, cy + 2, cx, cy - 22), '#f28c3c');
  poly(pts(cx - 6, cy + 9, cx, cy + 12, cx, cy - 4), '#8a5a3c'); // entrance
  ctx.strokeStyle = '#8a5a3c'; // flag pole
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 22);
  ctx.lineTo(cx, cy - 34);
  ctx.stroke();
  poly(pts(cx, cy - 34, cx + 10, cy - 31, cx, cy - 28), '#ff6f91');
  circle(cx + 18, cy + 12, 3, '#ff9f43'); // campfire
  circle(cx + 18, cy + 10, 1.8 + Math.sin(now / 120), '#ffd36e'); // flickering flame
}

function firstHouse({ cx, cy, night, seed }) {
  const box = prism(cx, cy, 0.62, 20, '#ffe3c2');
  windows(box, 1, 16, 0, night, seed);
  faceQuad(box.L, box.B, 0.42, 0.58, 0, 12, DOOR);
  pyramidRoof(cx, cy, 0.74, 20, 18, '#ff7f7f');
}

function townHall({ cx, cy, night, seed }) {
  const box = prism(cx, cy, 0.82, 34, '#fff1dc');
  windows(box, 2, 16, 0, night, seed);
  faceQuad(box.L, box.B, 0.42, 0.58, 0, 14, DOOR);
  ctx.fillStyle = '#ffb3c6'; // dome
  ctx.beginPath();
  ctx.ellipse(cx, cy - 34, 16, 10, 0, Math.PI, 0);
  ctx.fill();
  circle(cx, cy - 46, 3, '#ffd36e');
}

function clockTower({ cx, cy, night, now, seed }) {
  prism(cx, cy, 0.85, 10, '#e9dcc9'); // base
  const box = prism(cx, cy - 10, 0.5, 72, '#fff1dc');
  windows({ L: [box.L[0], box.L[1]], B: box.B, R: box.R }, 3, 16, 0, night, seed);
  // clock face on the left wall, with a turning hand
  const ox = (box.L[0] + box.B[0]) / 2;
  const oy = (box.L[1] + box.B[1]) / 2 - 62;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(ox, oy, 6, 7, 0, 0, 7);
  ctx.fill();
  ctx.strokeStyle = '#4a3b52';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  const angle = now / 2000;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(ox + Math.cos(angle) * 4, oy + Math.sin(angle) * 4);
  ctx.moveTo(ox, oy);
  ctx.lineTo(ox, oy - 5);
  ctx.stroke();
  pyramidRoof(cx, cy - 10, 0.6, 72, 26, '#7fa8ff');
  ctx.strokeStyle = '#4a3b52'; // flag
  ctx.beginPath();
  ctx.moveTo(cx, cy - 108);
  ctx.lineTo(cx, cy - 120);
  ctx.stroke();
  poly(pts(cx, cy - 120, cx + 10, cy - 117, cx, cy - 114), '#ff6f91');
}

const HALL_TIERS = [tent, firstHouse, townHall, clockTower];

// ---------- houses: cottage -> two-storey -> apartment -> tower ----------
function cottage({ p, cx, cy, night }) {
  const box = prism(cx, cy, 0.55, 16, p.color);
  faceQuad(box.L, box.B, 0.4, 0.6, 0, 10, DOOR);
  faceQuad(box.B, box.R, 0.3, 0.7, 5, 11, night ? WINDOW_LIT : WINDOW_DAY);
  pyramidRoof(cx, cy, 0.66, 16, 16, p.roof);
}

function twoStorey({ p, cx, cy, night, seed }) {
  const box = prism(cx, cy, 0.6, 32, p.color);
  windows(box, 2, 16, 0, night, seed);
  faceQuad(box.L, box.B, 0.42, 0.58, 0, 11, DOOR);
  pyramidRoof(cx, cy, 0.72, 32, 18, p.roof);
}

function apartment({ p, cx, cy, night, seed }) {
  const box = prism(cx, cy, 0.7, 50, p.color);
  windows(box, 3, 16, 0, night, seed);
  prism(cx, cy - 50, 0.5, 4, '#dddddd'); // flat roof
  circle(cx + 6, cy - 58, 4, '#8fd694'); // roof garden
}

function tower({ p, cx, cy, night, now, seed }) {
  const box = prism(cx, cy, 0.66, 86, p.color);
  windows(box, 5, 16, 2, night, seed);
  prism(cx, cy - 86, 0.3, 8, '#e6e0ea');
  ctx.strokeStyle = '#888'; // antenna with a blinking light
  ctx.beginPath();
  ctx.moveTo(cx, cy - 94);
  ctx.lineTo(cx, cy - 106);
  ctx.stroke();
  circle(cx, cy - 106, 2, Math.floor(now / 600) % 2 ? '#ff4d6d' : '#ffb3c6');
}

const HOUSE_TIERS = [cottage, twoStorey, apartment, tower];

// ---------- everything else ----------
function shop({ p, cx, cy, tier, night, now, seed }) {
  const h = [16, 30, 44][tier];
  const box = prism(cx, cy, tier === 2 ? 0.78 : 0.6, h, '#fff7e6');
  if (tier > 0) windows(box, tier + 1, 14, 0, night, seed);
  // striped awning along the left wall
  const a0 = [box.L[0], box.L[1] - 12];
  const b0 = [box.B[0], box.B[1] - 12];
  const pt = (u, d) => [a0[0] + (b0[0] - a0[0]) * u - d * 0.9, a0[1] + (b0[1] - a0[1]) * u + d * 0.4];
  for (let k = 0; k < 6; k++) {
    const u0 = k / 6;
    const u1 = (k + 1) / 6;
    poly([pt(u0, 0), pt(u1, 0), pt(u1, 7), pt(u0, 7)], k % 2 ? '#fff' : p.roof);
  }
  faceQuad(box.L, box.B, 0.3, 0.7, 0, 6, night ? WINDOW_LIT : '#ffd36e'); // shop window
  shopSign(cx, cy - h, seed, night, now);
}

// prettier-ignore
const TREE_SPOTS = [[0, 0], [-12, -4], [11, -3], [0, -9]];
const TREE_COLORS = ['#7ccf7a', '#5fbf6e', '#9ad66a', '#ff9fb8'];
function trees({ cx, cy, tier, seed }) {
  const count = tier + 1 + (tier > 1 ? 1 : 0);
  TREE_SPOTS.slice(0, count)
    .sort((a, b) => a[1] - b[1]) // back to front
    .forEach(([dx, dy], k) => {
      const size = 0.8 + hash(seed, k) * 0.35;
      tree(cx + dx, cy + dy + 4, size, TREE_COLORS[Math.floor(hash(seed, k, 5) * 4)]);
    });
}

const GARDEN_FLOWERS = ['#ff8fab', '#ffd36e', '#b08cff', '#fff'];
function garden({ cx, cy, tier, now, seed }) {
  poly(pts(cx - 18, cy, cx, cy + 9, cx + 18, cy, cx, cy - 9), '#c5ec9f');
  for (let k = 0; k < 9; k++) {
    const u = hash(seed, k, 1) - 0.5;
    const v = hash(seed, k, 2) - 0.5;
    flower(cx + (u - v) * 30, cy + (u + v) * 15, GARDEN_FLOWERS[k % 4]);
  }
  if (tier >= 1) {
    ctx.fillStyle = '#a8754f'; // bench
    ctx.fillRect(cx + 4, cy - 6, 12, 3);
    ctx.fillRect(cx + 5, cy - 3, 2, 4);
    ctx.fillRect(cx + 13, cy - 3, 2, 4);
  }
  if (tier >= 2) {
    ctx.fillStyle = '#bfe6ff'; // fountain basin
    ctx.beginPath();
    ctx.ellipse(cx - 6, cy + 2, 9, 4.5, 0, 0, 7);
    ctx.fill();
    ctx.strokeStyle = '#e0d6c8';
    ctx.lineWidth = 2;
    ctx.stroke();
    const jet = Math.sin(now / 200) * 1.5;
    ctx.fillStyle = 'rgba(124,198,254,.8)';
    ctx.beginPath();
    ctx.ellipse(cx - 6, cy - 6 + jet, 2, 6, 0, 0, 7);
    ctx.fill();
  }
}

function pond({ cx, cy, night, now, seed }) {
  poly(pts(cx - 24, cy, cx, cy + 12, cx + 24, cy, cx, cy - 12), '#e8dcc4'); // shore
  poly(pts(cx - 19, cy, cx, cy + 9.5, cx + 19, cy, cx, cy - 9.5), night ? '#4f7fb5' : '#8fd3ff');
  ctx.fillStyle = 'rgba(255,255,255,.6)'; // glint
  ctx.fillRect(cx - 6 + Math.sin(now / 700) * 3, cy - 2, 6, 1.5);
  circle(cx + 7, cy + 2, 3, '#7ccf7a'); // lily pad
  const swim = now / 1500 + seed; // a duck paddling in circles
  circle(cx + Math.cos(swim) * 9, cy + Math.sin(swim) * 4 - 2, 2.5, '#fff');
  ctx.fillStyle = '#ffb347';
  ctx.fillRect(cx + Math.cos(swim) * 9 + 2, cy + Math.sin(swim) * 4 - 3, 2, 1.2);
}

/** An unlocked plot waiting for its owner to choose: bare earth, a striped barrier and a sign. */
function buildingSite({ cx, cy }) {
  poly(pts(cx - 22, cy, cx, cy + 11, cx + 22, cy, cx, cy - 11), '#e6cfa3');
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#a8754f'; // barrier posts
    ctx.fillRect(cx + side * 13 - 1, cy - 9, 2, 11);
  }
  for (let k = 0; k < 6; k++) {
    ctx.fillStyle = k % 2 ? '#fff' : '#ffb347'; // striped bar
    ctx.fillRect(cx - 13 + k * 4.4, cy - 9, 4.4, 4);
  }
  circle(cx, cy - 22, 7, '#ff8fab'); // "?" bubble
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px Mali, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('?', cx, cy - 18.5);
  ctx.textAlign = 'start';
}

const PAINTERS = {
  site: buildingSite,
  hall: (b) => HALL_TIERS[b.tier](b),
  house: (b) => HOUSE_TIERS[b.tier](b),
  shop,
  trees,
  garden,
  pond,
};

/** Puff of dust and sparkles while a new building pops up. k runs 0 -> 1. */
function buildSparkle(cx, cy, k) {
  ctx.fillStyle = 'rgba(255,255,255,' + 0.8 * (1 - k) + ')';
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * (10 + k * 18), cy + Math.sin(a) * (5 + k * 9), 4 * (1 - k) + 1, 0, 7);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,211,110,' + (1 - k) + ')';
  for (let i = 0; i < 5; i++) {
    ctx.font = '12px sans-serif';
    ctx.fillText('✦', cx - 20 + i * 10, cy - 30 - k * 30 - i * 4);
  }
}

/** Draw one unlocked plot as the given kind. `minutes` decides its upgrade tier. */
export function drawPlot(p, minutes, night, now, kind = p.kind) {
  const [cx, cy] = iso(p.x, p.y);
  const tier = tierOf(p, minutes, kind);

  // just built or upgraded: grow out of the ground with a little bounce
  const animStart = G.anims[p.i];
  let grow = 1;
  if (animStart) {
    const k = (now - animStart) / BUILD_ANIM_MS;
    if (k >= 1) delete G.anims[p.i];
    else grow = clamp(1 - Math.pow(1 - k, 3) * Math.cos(k * 4), 0.05, 1.2);
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, grow);
  ctx.translate(-cx, -cy);
  PAINTERS[kind]({ p, cx, cy, tier, night, now, seed: p.x * 31 + p.y });
  ctx.restore();

  if (animStart && now - animStart < BUILD_ANIM_MS) buildSparkle(cx, cy, (now - animStart) / BUILD_ANIM_MS);
}

/** Paint what `kind` would look like on plot p, centred at (cx, cy), with no animation. */
export function paintSample(p, kind, cx, cy) {
  poly(pts(cx - 32, cy, cx, cy + 16, cx + 32, cy, cx, cy - 16), '#9bdc8e'); // a tile of grass to stand on
  PAINTERS[kind]({ p, cx, cy, tier: 0, night: false, now: 0, seed: p.x * 31 + p.y });
}
