// Which town is on screen: your own, a "peek ahead" preview, a time-lapse of your own, or a friend's.
// Only your own town can be studied in; the others are look-only.
import { G, realMin } from '../core/state.js';
import { plots, cityAt, decodeChoices } from '../core/city.js';
import { t, fmtMin } from '../i18n/index.js';
import { $, esc, toast, hideModal } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { todayKey } from '../core/dates.js';
import { avatar } from './account/shared.js';
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
// While visiting, the side panel shows the friend instead of your timer and stats, and a small
// pill in the corner of the town says whose town it is and leads back.

/** Today's minutes only count if the friend's last upload was today. */
const friendToday = (p) => (p.dayKey === todayKey() ? p.todayMin || 0 : 0);
const num = (v) => Math.max(0, Number(v) || 0);

function renderFriendPanel() {
  const v = G.visit;
  const p = v.profile;
  const city = cityAt(v.totalMin);
  const stat = (key, value) => `<div class="stat"><small>${t(key)}</small><b>${value}</b></div>`;
  $('friendPanel').innerHTML = `
    <div class="fpHead">${avatar({ name: v.name, uid: v.uid, avatar: p.avatar, photo: p.photo }, 'lg')}
      <div class="fpName"><b>${esc(v.name)}</b><small>${t('rank')[city.rank]}</small></div></div>
    <div class="stats">
      ${stat('stats.total', fmtMin(num(p.totalMin)))}
      ${stat('stats.today', fmtMin(friendToday(p)))}
      ${stat('visit.week', fmtMin(num(p.weekMin)))}
      ${stat('stats.streak', t('unit.days', { count: num(p.streak) }))}
      ${stat('stats.buildings', t('unit.pieces', { n: city.n }))}
      ${stat('visit.badges', num(p.badges))}
    </div>
    <div class="attackBox" id="attackBox"></div>
    <button class="btn ghost" id="friendPanelBack">${icon('back')}<span>${t('visit.back')}</span></button>`;
  $('friendPanelBack').addEventListener('click', endVisit);
  onPanelRendered();
}

let onPanelRendered = () => {};
/** cb fills in the parts of the friend panel other features own (the attack box). */
export function onFriendPanel(cb) {
  onPanelRendered = cb;
}

export function renderVisitTitle() {
  if (!G.visit) return;
  const v = G.visit;
  $('visitText').textContent = t('visit.title', { name: v.name });
  $('visitPic').innerHTML = avatar(
    { name: v.name, uid: v.uid, avatar: v.profile.avatar, photo: v.profile.photo },
    'sm',
  );
  renderFriendPanel();
}

/** friend = { uid, name, profile }: profile holds their public stats and the buildings they chose. */
export function startVisit(friend) {
  stopReplay();
  leavePreview();
  const profile = friend.profile || {};
  G.visit = {
    uid: friend.uid,
    name: friend.name,
    profile,
    totalMin: num(profile.totalMin),
    choices: decodeChoices(profile.build),
    chooseFrom: typeof profile.from === 'number' ? profile.from : null,
    look: profile.look || null,
    damage: profile.damage || null,
    shieldUntil: num(profile.shieldUntil),
  };
  G.state.flags.visited = true;
  document.body.classList.add('visiting'); // lavender sky and frame, friend panel (see styles.css)
  $('visitBar').hidden = false;
  $('friendPanel').hidden = false;
  renderVisitTitle();
  hideModal('accountModal'); // the visit starts from the friends list in the profile sheet
  setSheet(false);
  resetView();
  townChanged();
  checkAchievements();
}

export function endVisit() {
  G.visit = null;
  document.body.classList.remove('visiting');
  $('visitBar').hidden = true;
  $('friendPanel').hidden = true;
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
    $('replayFill').style.width = (f * 100).toFixed(1) + '%';
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
