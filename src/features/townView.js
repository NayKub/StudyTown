// Which town is on screen: your own, a "peek ahead" preview, a time-lapse of your own, or a friend's.
// Only your own town can be studied in; the others are look-only.
import { G, realMin } from '../core/state.js';
import { plots, cityAt, decodeChoices } from '../core/city.js';
import { t, fmtMin } from '../i18n/index.js';
import { $, toast } from '../ui/dom.js';
import { syncResidents, resetView } from '../render/scene.js';
import { renderHud } from './hud.js';
import { setSheet } from './bottomSheet.js';
import { saveNow } from './persistence.js';
import { checkAchievements } from './achievements.js';

/** New residents for the town now on screen, and fresh numbers on the badge. */
function townChanged() {
  syncResidents(true);
  renderHud();
}

// ---------- peek ahead ----------
export function setPreview(on) {
  G.preview = on;
  $('pvRange').disabled = !on;
  $('previewTag').style.display = on ? 'block' : 'none';
  townChanged();
}

/** Untick the box and go back to the real town (used when a session starts or a visit begins). */
export function leavePreview() {
  if (!G.preview) return;
  $('pvOn').checked = false;
  setPreview(false);
}

export function renderPreviewValue() {
  $('pvVal').textContent = t('unit.h', { h: $('pvRange').value });
}

// ---------- visiting a friend ----------
export function renderVisitTitle() {
  if (G.visit) $('visitText').textContent = t('visit.title', { name: G.visit.name });
}

/** friend = { name, totalMin, build, from }: build and from describe the buildings they chose. */
export function startVisit(friend) {
  stopReplay();
  leavePreview();
  G.visit = {
    name: friend.name,
    totalMin: friend.totalMin,
    choices: decodeChoices(friend.build),
    chooseFrom: typeof friend.from === 'number' ? friend.from : null,
  };
  G.state.flags.visited = true;
  document.body.classList.add('visiting'); // lavender frame, locked timer (see styles.css)
  $('visitBar').hidden = false;
  renderVisitTitle();
  setSheet(false);
  resetView();
  townChanged();
  checkAchievements();
}

export function endVisit() {
  G.visit = null;
  document.body.classList.remove('visiting');
  $('visitBar').hidden = true;
  resetView();
  townChanged();
}

// ---------- time-lapse: watch your town grow from empty land to today ----------
const REPLAY_MS = 14000;
const REPLAY_HOLD_MS = 2500; // linger on the finished town before going back
let replayFrame = 0;

/**
 * Minutes to show at progress f (0..1). Buildings appear at an even pace, rather than time passing
 * at an even pace, because early buildings are minutes apart and late ones are hours apart.
 */
function replayMinutes(f, total, built) {
  const minutesWhenBuilt = (k) => (k <= 0 ? 0 : k > built ? total : plots[k - 1].t);
  const x = f * (built + 1);
  const k = Math.floor(x);
  const from = minutesWhenBuilt(k);
  return Math.min(total, from + (minutesWhenBuilt(k + 1) - from) * (x - k));
}

export function startReplay() {
  const total = realMin();
  const built = cityAt(total).n;
  if (!built) {
    toast(t('replay.empty'));
    return;
  }
  if (G.visit) endVisit();
  leavePreview();
  stopReplay();
  G.replayMin = 0;
  document.body.classList.add('replaying');
  $('replayBar').hidden = false;
  setSheet(false);
  resetView();
  townChanged();

  const startedAt = performance.now();
  let shown = 0; // buildings on screen so far
  const step = (now) => {
    const f = Math.min(1, (now - startedAt) / REPLAY_MS);
    G.replayMin = replayMinutes(f, total, built);
    const count = cityAt(G.replayMin).n;
    for (; shown < count; shown++) G.anims[shown] = now; // each new building pops up
    $('replayText').textContent = t('replay.title', { time: fmtMin(Math.floor(G.replayMin)) });
    if (now - startedAt < REPLAY_MS + REPLAY_HOLD_MS) {
      replayFrame = requestAnimationFrame(step);
      return;
    }
    stopReplay();
    toast(t('replay.done', { time: fmtMin(total) }));
    G.state.flags.replayed = true;
    saveNow();
    checkAchievements();
  };
  replayFrame = requestAnimationFrame(step);
}

export function stopReplay() {
  if (G.replayMin == null) return;
  cancelAnimationFrame(replayFrame);
  G.replayMin = null;
  G.anims = {};
  document.body.classList.remove('replaying');
  $('replayBar').hidden = true;
  resetView();
  townChanged();
}

/** Back to your own, real town (used when a study session starts). */
export function leaveLookOnlyViews() {
  stopReplay();
  leavePreview();
}

export function initTownView() {
  $('pvOn').addEventListener('change', (e) => {
    if (G.timer.running) {
      e.target.checked = false;
      toast(t('preview.off'));
      return;
    }
    if (G.visit) endVisit();
    stopReplay();
    setPreview(e.target.checked);
  });
  $('pvRange').addEventListener('input', (e) => {
    G.previewMin = Math.round(+e.target.value * 60);
    renderPreviewValue();
  });
  $('visitBack').addEventListener('click', endVisit);
  $('replayBtn').addEventListener('click', startReplay);
  $('replayStop').addEventListener('click', stopReplay);
}
