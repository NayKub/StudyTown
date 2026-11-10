// Which town is on screen: your own, a "peek ahead" preview, or a friend's.
// Only your own town can be studied in; the other two are look-only.
import { G } from '../core/state.js';
import { t } from '../i18n/index.js';
import { $, toast } from '../ui/dom.js';
import { syncResidents, resetView } from '../render/scene.js';
import { renderHud } from './hud.js';
import { setSheet } from './bottomSheet.js';

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

/** friend = { name, totalMin } */
export function startVisit(friend) {
  leavePreview();
  G.visit = friend;
  document.body.classList.add('visiting'); // lavender frame, locked timer (see styles.css)
  $('visitBar').hidden = false;
  renderVisitTitle();
  setSheet(false);
  resetView();
  townChanged();
}

export function endVisit() {
  G.visit = null;
  document.body.classList.remove('visiting');
  $('visitBar').hidden = true;
  resetView();
  townChanged();
}

export function initTownView() {
  $('pvOn').addEventListener('change', (e) => {
    if (G.timer.running) {
      e.target.checked = false;
      toast(t('preview.off'));
      return;
    }
    if (G.visit) endVisit();
    setPreview(e.target.checked);
  });
  $('pvRange').addEventListener('input', (e) => {
    G.previewMin = Math.round(+e.target.value * 60);
    renderPreviewValue();
  });
  $('visitBack').addEventListener('click', endVisit);
}
