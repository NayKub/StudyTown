// Entry point. Loads saved data, starts every feature, and runs the app-wide loops.
// Nothing here knows how a feature works; it only decides the order things happen in.
import '@fontsource/mali/400.css';
import '@fontsource/mali/600.css';
import '@fontsource/mali/700.css';
import './styles.css';

import { G } from './core/state.js';
import { publicStats } from './core/dates.js';
import { initI18n, applyI18n, t, detectLang } from './i18n/index.js';
import { loadState, loadSettings } from './platform/storage.js';
import * as native from './platform/native.js';
import { startRender, syncResidents } from './render/scene.js';
import { $ } from './ui/dom.js';
import { saveNow, saveIfDue } from './features/persistence.js';
import { resetGrowth } from './features/growth.js';
import { renderHud } from './features/hud.js';
import * as timer from './features/timer.js';
import * as townView from './features/townView.js';
import * as studyLog from './features/studyLog.js';
import * as settings from './features/settings.js';
import * as sheet from './features/bottomSheet.js';
import * as account from './features/account/index.js';

const TICK_MS = 250;
const HISTORY_REFRESH_MS = 5000;

/** Redraw every piece of text (at start-up and after the language changes). */
function renderAll() {
  applyI18n();
  timer.renderPresets();
  timer.renderTimer();
  renderHud();
  studyLog.renderWeek();
  townView.renderPreviewValue();
  settings.renderSettings();
  sheet.renderSheetLabel();
  townView.renderVisitTitle();
  studyLog.renderLogIfOpen();
}

function tick() {
  timer.tickTimer();
  timer.renderTimer();
  renderHud();
  saveIfDue();
  account.sync(false);
  account.refresh(false);
}

/** Swap in data merged with the cloud backup. A session in progress is kept. */
function replaceState(merged) {
  G.state = { ...merged, timer: G.state.timer };
  resetGrowth();
  syncResidents(true);
  saveNow();
  renderHud();
  studyLog.renderWeek();
  studyLog.renderLogIfOpen();
}

/** The app came to the front (true) or went to the background (false). */
function onAppActive(active) {
  if (active) {
    native.cancelDone(); // we are on screen, so the in-app chime takes over from the notification
    tick();
    account.refresh(true); // pull anything another device added while we were away
    account.sync(false);
    return;
  }
  timer.credit();
  saveNow();
  account.sync(true);
  const endsAt = timer.sessionEndTime();
  if (endsAt && G.settings.notify && endsAt.getTime() > Date.now() + 1000) {
    native.scheduleDone(endsAt, t('notif.title'), t('notif.body', { m: timer.sessionMinutes() }));
  }
}

/** Sheets close with their ✕ button or by tapping the dimmed backdrop. */
function bindSheetClosing() {
  document.querySelectorAll('.modal.sheet').forEach((modal) =>
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.closest('[data-close]')) modal.classList.remove('show');
    }),
  );
}

async function loadSavedData() {
  const [state, savedSettings] = await Promise.all([loadState(), loadSettings()]);
  if (savedSettings) Object.assign(G.settings, savedSettings);
  if (state && typeof state.totalSec === 'number') {
    Object.assign(G.state, state);
    // saved data is validated before use
    if (!Array.isArray(G.state.sessions)) G.state.sessions = [];
    if (!G.state.days || typeof G.state.days !== 'object') G.state.days = {};
  }
  // pick up a session that was still open when the app was closed
  const session = G.state.timer;
  if (session && session.active && session.dur > 0) Object.assign(G.timer, session);
}

async function boot() {
  await loadSavedData();
  await initI18n(G.settings.lang || detectLang());
  resetGrowth();

  timer.initTimer();
  townView.initTownView();
  studyLog.initStudyLog();
  settings.initSettings({
    onLanguageChanged() {
      renderAll();
      account.onLanguageChange();
    },
  });
  bindSheetClosing();

  startRender($('cv'));
  renderAll();
  sheet.initSheet();
  account.initAccount({
    getState: () => G.state,
    replaceState,
    stats: () => publicStats(G.state),
    visit: townView.startVisit,
  });

  timer.applyAwake();
  tick();
  setInterval(tick, TICK_MS);
  setInterval(() => {
    studyLog.renderWeek();
    studyLog.renderLogIfOpen();
  }, HISTORY_REFRESH_MS);
  native.onAppActive(onAppActive);
  window.addEventListener('pagehide', () => {
    timer.credit();
    saveNow();
  });
  native.cancelDone();
  native.hideSplash();
}

boot();
