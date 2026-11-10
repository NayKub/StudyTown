// The settings sheet: language and the on/off switches.
import { G } from '../core/state.js';
import { t, lang, setLang, LANGS } from '../i18n/index.js';
import { $, showModal } from '../ui/dom.js';
import { saveSettings } from '../platform/storage.js';
import * as native from '../platform/native.js';
import { applyAwake } from './timer.js';

const switches = () => document.querySelectorAll('[data-setting]');

export function renderSettings() {
  $('langTabs').innerHTML = Object.entries(LANGS)
    .map(([code, name]) => `<button class="chip${code === lang() ? ' on' : ''}" data-lang="${code}">${name}</button>`)
    .join('');
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
  if (name === 'notify' && el.checked) native.ensureNotifyPermission();
}

/** onLanguageChanged runs after the new language is loaded, to redraw every text on screen. */
export function initSettings({ onLanguageChanged }) {
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
