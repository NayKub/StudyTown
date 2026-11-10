// Drawing building blocks for the isometric town: tiles, boxes, roofs, windows, trees, flowers.
import { ctx } from './canvas.js';
import { TW, TH, hash } from '../core/city.js';

const FULL_CIRCLE = 7; // anything >= 2π draws a full circle; 7 is what the art was tuned with

/** Grid position -> screen position of the tile's centre (before the camera transform). */
export const iso = (gx, gy) => [((gx - gy) * TW) / 2, ((gx + gy) * TH) / 2];

/** Lighten (amt > 0) or darken (amt < 0) a "#rrggbb" colour. */
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt > 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
}

/** pts(x1, y1, x2, y2, ...) -> [[x1, y1], [x2, y2], ...], so a shape reads on one line. */
export function pts(...coords) {
  const points = [];
  for (let i = 0; i < coords.length; i += 2) points.push([coords[i], coords[i + 1]]);
  return points;
}

export function poly(points, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

export function circle(x, y, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, FULL_CIRCLE);
  ctx.fill();
}

export function ellipse(x, y, rx, ry, fill, rotation = 0) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, FULL_CIRCLE);
  ctx.fill();
}

/** Trace a rounded rectangle (call ctx.fill() / ctx.stroke() afterwards). */
export function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * An isometric box standing on the tile at (cx, cy).
 * f = footprint as a fraction of a tile, h = height in pixels.
 * Returns its ground corners { L, B, R, T } so details can be placed on the faces.
 */
export function prism(cx, cy, f, h, base, opt = {}) {
  const hw = (f * TW) / 2;
  const hh = (f * TH) / 2;
  const L = [cx - hw, cy];
  const B = [cx, cy + hh];
  const R = [cx + hw, cy];
  const T = [cx, cy - hh];
  const up = (p) => [p[0], p[1] - h];
  poly([L, B, up(B), up(L)], opt.left || shade(base, -0.12));
  poly([B, R, up(R), up(B)], opt.right || shade(base, -0.25));
  poly([up(T), up(R), up(B), up(L)], opt.top || shade(base, 0.15));
  return { L, B, R, T, h };
}

/** A rectangle on a wall. a -> b is the wall's ground edge; u runs along it (0..1), v is height in pixels. */
export function faceQuad(a, b, u0, u1, v0, v1, fill) {
  const p = (u, v) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - v];
  poly([p(u0, v0), p(u1, v0), p(u1, v1), p(u0, v1)], fill);
}

// prettier-ignore
const WINDOW_COLUMNS = [[0.18, 0.4], [0.6, 0.82]]; // left and right edge of each window along a wall

/** Two windows per floor on both visible walls; at night some are lit. */
export function windows(box, floors, floorH, base0, night, seed) {
  for (let f = 0; f < floors; f++) {
    const v0 = base0 + f * floorH + 5;
    const v1 = v0 + floorH - 9;
    for (const [u0, u1] of WINDOW_COLUMNS) {
      const litL = night && hash(seed, f * 7 + u0 * 10, 1) > 0.35;
      const litR = night && hash(seed, f * 7 + u0 * 10, 2) > 0.35;
      faceQuad(box.L, box.B, u0, u1, v0, v1, litL ? '#ffe48a' : '#cfeaff');
      faceQuad(box.B, box.R, u0, u1, v0, v1, litR ? '#f5cf6a' : '#a9d4f0');
    }
  }
}

/** A pointed roof on top of a box of height h. rh = roof height. */
export function pyramidRoof(cx, cy, f, h, rh, col) {
  const hw = (f * TW) / 2;
  const hh = (f * TH) / 2;
  const y = cy - h;
  const L = [cx - hw, y];
  const B = [cx, y + hh];
  const R = [cx + hw, y];
  const apex = [cx, y - rh];
  poly([L, B, apex], shade(col, 0));
  poly([B, R, apex], shade(col, -0.22));
}

export function tree(x, y, s, col) {
  ellipse(x, y, 8 * s, 4 * s, 'rgba(0,0,0,.12)'); // shadow
  ctx.fillStyle = '#a8754f';
  ctx.fillRect(x - 2 * s, y - 12 * s, 4 * s, 12 * s); // trunk
  circle(x, y - 18 * s, 10 * s, col);
  circle(x - 3.5 * s, y - 21 * s, 3.5 * s, 'rgba(255,255,255,.35)'); // highlight
}

export function flower(x, y, col) {
  ctx.fillStyle = col;
  for (let k = 0; k < 5; k++) {
    const a = k * 1.256;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * 1.8, y + Math.sin(a) * 1.8, 1.5, 0, FULL_CIRCLE);
    ctx.fill();
  }
  circle(x, y, 1.2, '#ffe066');
}
