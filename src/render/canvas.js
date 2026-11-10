// The one canvas everything is drawn on. Other render modules import `ctx` (a live binding).

export let cv = null;
export let ctx = null;

export function setCanvas(canvas) {
  cv = canvas;
  ctx = canvas.getContext('2d');
}

/** Run `draw` against another canvas context (used for the small previews in the build chooser). */
export function withContext(other, draw) {
  const main = ctx;
  ctx = other;
  try {
    draw();
  } finally {
    ctx = main;
  }
}
