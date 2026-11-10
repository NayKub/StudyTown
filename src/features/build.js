// Choosing what to build. Each newly unlocked plot waits as a building site until the player
// picks one of three kinds; a chip on the town shows how many are waiting.
import { G, ownTown } from '../core/state.js';
import { plots, pendingPlots, optionsFor } from '../core/city.js';
import { t } from '../i18n/index.js';
import { $, toast, showModal, hideModal, isShown } from '../ui/dom.js';
import * as native from '../platform/native.js';
import { paintSample, withContext } from '../render/scene.js';
import { saveNow } from './persistence.js';
import { noteBuilt } from './growth.js';
import { checkAchievements } from './achievements.js';

const SAMPLE_W = 104; // size of each preview picture in CSS pixels
const SAMPLE_H = 92;
const SAMPLE_ZOOM = 1.4;
const KIND_ICON = { house: '🏠', shop: '🏪', trees: '🌳', garden: '🌷', pond: '🦆' };

let onBuilt = () => {};
const waiting = () => pendingPlots(ownTown());
/** Building is only offered while looking at your own, real town. */
const inOwnTown = () => !G.visit && !G.preview && G.replayMin == null;

/** The chip on the town: "🔨 Build (2)". Called on every tick. */
export function renderBuildChip() {
  const count = waiting().length;
  const chip = $('buildBtn');
  chip.hidden = !(count && inOwnTown());
  if (!chip.hidden) chip.textContent = t('build.chip', { count });
}

function drawSample(canvas, p, kind) {
  const dpr = 2;
  canvas.width = SAMPLE_W * dpr;
  canvas.height = SAMPLE_H * dpr;
  const c = canvas.getContext('2d');
  c.setTransform(dpr * SAMPLE_ZOOM, 0, 0, dpr * SAMPLE_ZOOM, (SAMPLE_W / 2) * dpr, SAMPLE_H * 0.68 * dpr);
  withContext(c, () => paintSample(p, kind, 0, 0));
}

function renderChooser() {
  const queue = waiting();
  if (!queue.length) {
    hideModal('buildModal');
    return;
  }
  const p = plots[queue[0]];
  $('buildLeft').textContent = queue.length > 1 ? t('build.more', { count: queue.length - 1 }) : '';
  $('buildAuto').hidden = queue.length < 2;
  $('buildCards').innerHTML = optionsFor(p)
    .map(
      (kind) =>
        `<button class="buildCard" data-kind="${kind}"><canvas style="width:${SAMPLE_W}px;height:${SAMPLE_H}px"></canvas><b>${KIND_ICON[kind]} ${t('kind2.' + kind)}</b></button>`,
    )
    .join('');
  $('buildCards')
    .querySelectorAll('.buildCard')
    .forEach((card) => drawSample(card.querySelector('canvas'), p, card.dataset.kind));
}

function build(kind) {
  const queue = waiting();
  if (!queue.length) return;
  const p = plots[queue[0]];
  G.state.choices[p.i] = kind;
  G.anims[p.i] = performance.now(); // pops up with the same bounce as an automatic building
  noteBuilt(p);
  toast(t('toast.built', { name: t('kind2.' + kind) }));
  if (G.settings.haptics) native.buzz('medium');
  saveNow();
  checkAchievements();
  onBuilt();
  renderBuildChip();
  renderChooser(); // the next waiting plot, or close
}

/** "Surprise me": fill every waiting plot with what the town plan had in mind. */
function buildAllAutomatically() {
  const queue = waiting();
  if (!queue.length) return;
  const now = performance.now();
  queue.forEach((i) => {
    const p = plots[i];
    G.state.choices[i] = p.kind;
    G.anims[i] = now;
    noteBuilt(p);
  });
  toast(t('build.autoDone', { count: queue.length }));
  if (G.settings.haptics) native.buzz('medium');
  saveNow();
  checkAchievements();
  onBuilt();
  renderBuildChip();
  hideModal('buildModal');
}

export function renderBuildTexts() {
  if (isShown('buildModal')) renderChooser();
}

/** onChoice runs after each choice (main.js uploads it so friends see the new building). */
export function initBuild({ onChoice } = {}) {
  if (onChoice) onBuilt = onChoice;
  $('buildBtn').addEventListener('click', () => {
    renderChooser();
    showModal('buildModal');
  });
  $('buildAuto').addEventListener('click', buildAllAutomatically);
  $('buildCards').addEventListener('click', (e) => {
    const card = e.target.closest('.buildCard');
    if (card) build(card.dataset.kind);
  });
}
