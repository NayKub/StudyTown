// The island itself: grass and road tiles, the earth cliff at the front edges, small decorations.
import { ctx } from './canvas.js';
import { TW, TH, hash, isRoad, plotAt } from '../core/city.js';
import { iso, poly, pts, prism, flower } from './primitives.js';

const HW = TW / 2;
const HH = TH / 2;
const CLIFF = 18; // height of the earth below the grass
const TURF = 3; // strip of grass at the top of the cliff

const onCrossRoad = (v) => ((v % 4) + 4) % 4 === 2;

function cliffEdge(cx, cy, x, y, R) {
  if (y === R) poly(pts(cx - HW, cy, cx, cy + HH, cx, cy + HH + CLIFF, cx - HW, cy + CLIFF), '#c99a6e');
  if (x === R) poly(pts(cx, cy + HH, cx + HW, cy, cx + HW, cy + CLIFF, cx, cy + HH + CLIFF), '#a97c55');
  if (y === R) poly(pts(cx - HW, cy, cx, cy + HH, cx, cy + HH + TURF, cx - HW, cy + TURF), '#86cf78');
  if (x === R) poly(pts(cx, cy + HH, cx + HW, cy, cx + HW, cy + TURF, cx, cy + HH + TURF), '#74b866');
}

function laneMarking(x, y) {
  const alongY = onCrossRoad(x); // this tile belongs to a road running in the y direction
  const alongX = onCrossRoad(y);
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  if (alongY && !alongX) {
    const a = iso(x, y - 0.5);
    const b = iso(x, y + 0.5);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  if (alongX && !alongY) {
    const a = iso(x - 0.5, y);
    const b = iso(x + 0.5, y);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke(); // (crossings get no marking: the path is empty there)
  ctx.setLineDash([]);
}

/** Tufts of grass and the odd white flower on land that has no building yet. */
function wildGrass(cx, cy, x, y) {
  const h1 = hash(x, y, 21);
  if (h1 < 0.5) {
    ctx.fillStyle = '#7cc46f';
    ctx.fillRect(cx - 8 + h1 * 20, cy - 2, 1.5, 3);
    ctx.fillRect(cx - 6 + h1 * 20, cy - 3, 1.5, 4);
  }
  if (hash(x, y, 22) < 0.15) flower(cx + hash(x, y, 23) * 16 - 8, cy + hash(x, y, 24) * 6 - 3, '#fff');
}

/** Draw every tile of a town of radius R, back to front. */
export function drawGround(R, minutes) {
  const cells = [];
  for (let x = -R; x <= R; x++) for (let y = -R; y <= R; y++) cells.push([x, y]);
  cells.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));

  for (const [x, y] of cells) {
    const [cx, cy] = iso(x, y);
    const road = isRoad(x, y);
    const color = road ? '#e9e1d6' : (x + y) & 1 ? '#a6e39a' : '#9bdc8e';
    prism(cx, cy + 0, 1, 0, color, { top: color });
    if (x === R || y === R) cliffEdge(cx, cy, x, y, R);

    if (road) {
      laneMarking(x, y);
    } else {
      const plot = plotAt[x + ',' + y];
      if (!plot || plot.t > minutes) wildGrass(cx, cy, x, y);
    }
  }
}
