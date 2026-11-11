// Preset profile pictures: the town's own residents, drawn once into small images.
import { withContext } from './canvas.js';
import { drawResident, SPECIES } from './residents.js';

const SIZE = 128; // pixels; shown much smaller, so it stays sharp on high-density screens
const DRAW = 256; // scratch canvas the animal is drawn on before it is measured
const FILL = 0.74; // share of the picture the animal's tallest/widest side takes up

/** Background colour behind each animal. */
export const AVATAR_BG = {
  bunny: '#ffd6e2',
  cat: '#ffe7c4',
  bear: '#f1dcc6',
  chick: '#fff1b0',
  frog: '#d4f2cf',
  pig: '#ffd9e6',
};
export const AVATAR_IDS = SPECIES;

const cache = {};

/** A data URL of the animal's face, or '' for an unknown id. */
export function presetAvatarURL(id) {
  if (!AVATAR_BG[id]) return '';
  if (cache[id]) return cache[id];
  // draw the animal big on a scratch canvas, then measure where its pixels actually are, so every
  // species (long bunny ears, a short chick) ends up centred with the same margin
  const scratch = document.createElement('canvas');
  scratch.width = DRAW;
  scratch.height = DRAW;
  const sc = scratch.getContext('2d');
  sc.setTransform(5, 0, 0, 5, DRAW / 2, DRAW * 0.62);
  const resident = { sp: id, x: 0, y: 0, tx: 0, ty: 0, phase: 0, dir: 0, bubble: 0 };
  withContext(sc, () => drawResident(resident, 0));
  const box = inkBox(sc.getImageData(0, 0, DRAW, DRAW));

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const c = canvas.getContext('2d');
  const k = (SIZE * FILL) / Math.max(box.w, box.h);
  const w = box.w * k;
  const h = box.h * k;
  c.drawImage(scratch, box.x, box.y, box.w, box.h, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
  cache[id] = canvas.toDataURL('image/png');
  return cache[id];
}

/** The smallest rectangle holding every visible pixel (ignoring the faint ground shadow). */
function inkBox({ data, width, height }) {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < 120) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w: width, h: height };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
