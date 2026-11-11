// The settings sheet: language and the on/off switches.
import { G } from '../core/state.js';
import { t, lang, setLang, LANGS } from '../i18n/index.js';
import { $, showModal } from '../ui/dom.js';
import { saveSettings } from '../platform/storage.js';
import * as native from '../platform/native.js';
import { applyAwake } from './timer.js';
import { saveNow } from './persistence.js';
import { THEMES, applyTheme } from './theme.js';

const GOAL_OPTIONS_MIN = [15, 30, 60, 90, 120];

const switches = () => document.querySelectorAll('[data-setting]');

export function renderSettings() {
  $('langTabs').innerHTML = Object.entries(LANGS)
    .map(([code, name]) => `<button class="chip${code === lang() ? ' on' : ''}" data-lang="${code}">${name}</button>`)
    .join('');
  const theme = G.settings.theme || 'system';
  $('themeTabs').innerHTML = THEMES.map(
    (name) =>
      `<button class="chip${name === theme ? ' on' : ''}" data-theme-choice="${name}">${t('theme.' + name)}</button>`,
  ).join('');
  $('goalTabs').innerHTML = GOAL_OPTIONS_MIN.map(
    (m) =>
      `<button class="chip${m === G.state.goalMin ? ' on' : ''}" data-goal="${m}">${t('unit.min', { m })}</button>`,
  ).join('');
  switches().forEach((el) => {
    el.checked = !!G.settings[el.dataset.setting];
  });
  $('version').textContent = t('settings.version', { v: __APP_VERSION__ });
}

function onSwitchChange(el) {
  const name = el.dataset.setting;
  G.settings[name] = el.checked;
  saveSettings(G.settings);
  if (name === 'keepAwake') applyAwake();
  if ((name === 'notify' || name === 'ongoing') && el.checked) native.ensureNotifyPermission();
}

/**
 * onLanguageChanged runs after the new language is loaded, to redraw every text on screen.
 * onGoalChanged runs after the daily goal was changed.
 */
export function initSettings({ onLanguageChanged, onGoalChanged }) {
  $('themeTabs').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    G.settings.theme = chip.dataset.themeChoice;
    saveSettings(G.settings);
    applyTheme();
    renderSettings();
  });
  $('goalTabs').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    G.state.goalMin = +chip.dataset.goal; // part of the saved state, so it follows the account
    saveNow();
    renderSettings();
    onGoalChanged();
  });
  $('settingsBtn').addEventListener('click', () => {
    renderSettings();
    showModal('settingsModal');
  });
  $('langTabs').addEventListener('click', async (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    G.settings.lang = chip.dataset.lang;
    saveSettings(G.settings);
    await setLang(G.settings.lang);
    onLanguageChanged();
  });
  switches().forEach((el) => el.addEventListener('change', () => onSwitchChange(el)));
}
