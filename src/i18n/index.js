import i18next from 'i18next';
import th from './locales/th.json';
import en from './locales/en.json';

export const LANGS = { th: 'ไทย', en: 'English' };

export async function initI18n(lang) {
  await i18next.init({
    lng: lang,
    fallbackLng: 'en',
    resources: { th: { translation: th }, en: { translation: en } },
    interpolation: { escapeValue: false },
    returnObjects: true,
  });
  applyI18n();
}

export const t = (key, opts) => i18next.t(key, opts);
export const lang = () => i18next.language;
export const locale = () => (i18next.language === 'th' ? 'th-TH' : 'en-US');
export const detectLang = () => ((navigator.language || 'en').toLowerCase().startsWith('th') ? 'th' : 'en');

export async function setLang(l) {
  await i18next.changeLanguage(l);
  applyI18n();
}

/** Fill every element marked with data-i18n / data-i18n-ph / data-i18n-label. */
export function applyI18n() {
  document.documentElement.lang = i18next.language;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPh);
  });
  document.querySelectorAll('[data-i18n-label]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nLabel));
  });
}

export function fmtMin(m) {
  if (m < 60) return t('unit.min', { m });
  const h = Math.floor(m / 60),
    r = m % 60;
  return r ? t('unit.hm', { h, m: r }) : t('unit.h', { h });
}
