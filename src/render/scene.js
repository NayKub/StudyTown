// The frame loop: sky, ground, then buildings and residents sorted back to front.
import { setCanvas, cv, ctx } from './canvas.js';
import { curMin } from '../core/state.js';
import { plots, cityAt } from '../core/city.js';
import { t } from '../i18n/index.js';
import { iso } from './primitives.js';
import { applyCamera, bindCameraInput, resize } from './camera.js';
import { drawSky, timeOfDay } from './sky.js';
import { drawGround } from './ground.js';
import { drawPlot } from './buildings.js';
import { residents, setTown, syncResidents, updateResidents, drawResident } from './residents.js';

export { resetView } from './camera.js';
export { syncResidents } from './residents.js';

const MAX_FRAME_SEC = 0.05; // after a pause (tab hidden), don't let residents teleport

/** The "Start here!" sign on a town with no buildings yet. */
function drawStartSign() {
  const [cx, cy] = iso(0, 0);
  const label = t('sign');
  ctx.font = 'bold 8px Mali, sans-serif';
  const w = Math.max(32, ctx.measureText(label).width + 10);
  ctx.fillStyle = '#a8754f'; // post
  ctx.fillRect(cx - 1.5, cy - 22, 3, 22);
  ctx.fillStyle = '#e9c79a'; // board
  ctx.fillRect(cx - w / 2, cy - 34, w, 14);
  ctx.strokeStyle = '#a8754f';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - w / 2, cy - 34, w, 14);
  ctx.fillStyle = '#6b4a32';
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy - 24);
  ctx.textAlign = 'start';
}

let lastFrame = performance.now();

function frame(now) {
  const dt = Math.min(MAX_FRAME_SEC, (now - lastFrame) / 1000);
  lastFrame = now;

  const minutes = curMin();
  const city = cityAt(minutes);
  setTown(city);
  syncResidents(false);
  updateResidents(dt);

  const sky = timeOfDay();
  drawSky(now, sky);
  applyCamera(city.R);
  drawGround(city.R, minutes);

  // Things standing on the ground overlap, so draw them from the back (small x + y) to the front.
  const things = [];
  if (city.n === 0) things.push({ depth: 0, draw: drawStartSign });
  for (let i = 0; i < city.n; i++) {
    const p = plots[i];
    things.push({ depth: p.x + p.y, draw: () => drawPlot(p, minutes, sky.night, now) });
  }
  for (const c of residents) things.push({ depth: c.x + c.y + 0.3, draw: () => drawResident(c, now) });
  things.sort((a, b) => a.depth - b.depth).forEach((thing) => thing.draw());

  requestAnimationFrame(frame);
}

export function startRender(canvas) {
  setCanvas(canvas);
  new ResizeObserver(resize).observe(cv);
  resize();
  setTown(cityAt(curMin()));
  syncResidents(true);
  bindCameraInput();
  requestAnimationFrame(frame);
}
