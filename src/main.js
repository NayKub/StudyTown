// Entry point. Loads saved data, starts every feature, and runs the app-wide loops.
// Nothing here knows how a feature works; it only decides the order things happen in.
import '@fontsource/mali/400.css';
import '@fontsource/mali/600.css';
import '@fontsource/mali/700.css';
import './styles.css';

import { G, realMin } from './core/state.js';
import { cityAt, encodeChoices } from './core/city.js';
import { publicStats } from './core/dates.js';
import { newWallet } from './core/wallet.js';
import { initI18n, applyI18n, t, detectLang, locale } from './i18n/index.js';
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
import * as build from './features/build.js';
import * as achievements from './features/achievements.js';
import { renderGoal } from './features/goal.js';
import { initTheme } from './features/theme.js';
import * as fullClear from './features/fullClear.js';
import { setSheet, isSheetOpen } from './features/bottomSheet.js';
import { hideModal } from './ui/dom.js';
import * as account from './features/account/index.js';
import * as economy from './features/shop/economy.js';
import * as shop from './features/shop/shopSheet.js';
import * as attacks from './features/shop/attacks.js';
import { lookOf, damagedPlots } from './core/wallet.js';

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
  renderGoal();
  achievements.renderShelf();
  build.renderBuildChip();
  build.renderBuildTexts();
  studyLog.renderLogIfOpen();
  shop.renderShopTexts();
  economy.renderRepairCard();
}

function tick() {
  timer.tickTimer();
  timer.renderTimer();
  renderHud();
  renderGoal();
  build.renderBuildChip();
  fullClear.renderFullTime();
  economy.renderIQ();
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
  achievements.renderShelf();
  achievements.checkAchievements(); // another device may have brought study time that earns one
  account.refreshProfile(); // and maybe a new profile picture
  economy.applyCardSkin(); // a look bought on another device
  economy.renderRepairCard();
  economy.renderIQ();
  economy.changed();
}

/** What friends can see: numbers, the buildings you chose, and how many badges you have. */
const sharedProfile = () => ({
  ...publicStats(G.state),
  build: encodeChoices(G.state.choices),
  from: G.state.chooseFrom,
  badges: Object.keys(G.state.badges).length,
  avatar: G.state.profile.avatar || '',
  photo: G.state.profile.photo || '',
  // so friends see your town as you do, and the damage their bombs did
  look: { ground: lookOf(G.state).ground, sky: lookOf(G.state).sky },
  damage: { plots: damagedPlots(G.state), rain: !!(G.state.damage && G.state.damage.rain) },
  shieldUntil: G.state.shieldUntil || 0,
  peaceful: !!G.state.peaceful,
});

/** The app came to the front (true) or went to the background (false). */
function onAppActive(active) {
  if (active) {
    native.cancelDone(); // we are on screen, so the in-app chime takes over from the notification
    native.hideOngoing();
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
  if (G.timer.active && G.settings.ongoing) showOngoing(endsAt);
}

/** The notification (Android) or Live Activity (iPhone) that keeps counting while the app is closed. */
function showOngoing(endsAt) {
  const paused = !endsAt;
  const remaining = timer.remainingText();
  const endClock = endsAt ? endsAt.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) : '';
  native.showOngoing({
    endsAt: endsAt ? endsAt.getTime() : 0,
    paused,
    remaining,
    title: t(paused ? 'ongoing.paused' : 'ongoing.studying'),
    text: paused ? t('ongoing.left', { time: remaining }) : t('ongoing.endsAt', { time: endClock }),
    appName: t('app.title'),
    channelName: t('ongoing.channel'),
  });
}

/** Android back button: close whatever is on top, otherwise leave the app. */
function onBack() {
  if (fullClear.isFullClear()) {
    fullClear.exitFullClear();
    return true;
  }
  const open = [...document.querySelectorAll('.modal.show')].pop();
  if (open) {
    hideModal(open.id);
    return true;
  }
  if (isSheetOpen()) {
    setSheet(false);
    return true;
  }
  if (G.visit) {
    townView.endVisit();
    return true;
  }
  return false;
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

  // Towns from before "choose what to build" keep their buildings; only later plots wait for a choice.
  if (G.state.chooseFrom == null) G.state.chooseFrom = Math.max(1, cityAt(realMin()).n);
  if (!G.state.profile || typeof G.state.profile !== 'object') G.state.profile = { avatar: '', photo: '', at: 0 };
  if (!G.state.wallet || typeof G.state.wallet !== 'object') G.state.wallet = newWallet(realMin());
  for (const key of ['bonus', 'spent', 'used']) {
    if (!G.state.wallet[key] || typeof G.state.wallet[key] !== 'object') G.state.wallet[key] = {};
  }
  for (const key of ['choices', 'badges', 'flags', 'attacksSeen']) {
    if (!G.state[key] || typeof G.state[key] !== 'object') G.state[key] = {};
  }
  G.state.v = 4;
}

async function boot() {
  await loadSavedData();
  initTheme(); // before anything is drawn, so a dark theme never flashes light
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
    onGoalChanged() {
      renderGoal();
      achievements.checkAchievements();
      account.sync(true);
    },
    onPeacefulChanged() {
      economy.changed();
    },
  });
  build.initBuild({ onChoice: () => account.sync(true) });
  achievements.initAchievements({ onNewBadge: () => account.sync(true) });
  bindSheetClosing();
  fullClear.initFullClear();
  economy.initEconomy();
  shop.initShopSheet();
  economy.onEconomyChange(() => account.sync(true));
  attacks.initAttacks({
    visit: townView.startVisit,
    startStudy: timer.studyFor,
    sync: () => account.sync(true),
  });
  townView.onFriendPanel(attacks.renderAttackBox);

  startRender($('cv'));
  renderAll();
  sheet.initSheet();
  account.initAccount({
    getState: () => G.state,
    replaceState,
    stats: sharedProfile,
    visit: townView.startVisit,
    onFriendsChange: achievements.checkAchievements,
    onSignedIn: attacks.watchForAttacks,
    onSignedOut: attacks.stopWatchingAttacks,
  });

  timer.applyAwake();
  achievements.checkAchievements();
  tick();
  setInterval(tick, TICK_MS);
  setInterval(() => {
    studyLog.renderWeek();
    studyLog.renderLogIfOpen();
  }, HISTORY_REFRESH_MS);
  native.onAppActive(onAppActive);
  native.onBackButton(onBack);
  window.addEventListener('pagehide', () => {
    timer.credit();
    saveNow();
  });
  native.cancelDone();
  native.hideOngoing(); // left over from a session that ended while the app was closed
  native.hideSplash();
}

boot();
