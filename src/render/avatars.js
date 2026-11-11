// Preset profile pictures: the town's own residents, drawn once into small images.
import { withContext } from './canvas.js';
import { drawResident, SPECIES } from './residents.js';

const SIZE = 128; // pixels; shown much smaller, so it stays sharp on high-density screens
const SCALE = 4.2;
const BODY_Y = 74; // where the body centre sits in the picture

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
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const c = canvas.getContext('2d');
  // drawResident puts the body centre 10px above the point it stands on
  c.setTransform(SCALE, 0, 0, SCALE, SIZE / 2, BODY_Y + 10 * SCALE);
  const resident = { sp: id, x: 0, y: 0, tx: 0, ty: 0, phase: 0, dir: 0, bubble: 0 };
  withContext(c, () => drawResident(resident, 0));
  cache[id] = canvas.toDataURL('image/png');
  return cache[id];
}
