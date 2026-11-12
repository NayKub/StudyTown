// Earning IQ, showing the balance, and repairs that happen while you study.
import { G } from '../../core/state.js';
import {
  balance,
  addBonus,
  studyRepair,
  damageCount,
  minutesToRepair,
  repairWithIQ,
  REPAIR_IQ,
  lookOf,
  GOAL_BONUS,
  BADGE_BONUS,
} from '../../core/wallet.js';
import { t } from '../../i18n/index.js';
import { $, toast } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { markDirty, saveNow } from '../persistence.js';

const listeners = [];
/** cb runs after IQ, looks or damage change (the open shop re-renders, the profile is uploaded). */
export function onEconomyChange(cb) {
  listeners.push(cb);
}
export const changed = () => listeners.forEach((cb) => cb());

let shownIQ = null;
/** The balance on the chip next to the profile button. Called on every tick. */
export function renderIQ() {
  const iq = balance(G.state);
  if (iq === shownIQ) return;
  shownIQ = iq;
  $('iqVal').textContent = iq.toLocaleString();
}

/** Daily goal reached: a bonus once per day. */
export function goalBonus(dayKey) {
  if (addBonus(G.state, `goal:${dayKey}`, GOAL_BONUS)) {
    toast(t('iq.goal', { iq: GOAL_BONUS }));
    changed();
  }
}

/** Badges just earned: a bonus for each. */
export function badgeBonus(ids) {
  const fresh = ids.filter((id) => addBonus(G.state, `badge:${id}`, BADGE_BONUS));
  if (fresh.length) changed();
}

/** Called by the timer with the seconds just studied. */
export function studied(seconds) {
  const fixed = studyRepair(G.state, seconds);
  if (!fixed.length) return;
  fixed.forEach((i) => {
    G.anims[i] = performance.now(); // the rebuilt building grows back up
  });
  toast(damageCount(G.state) ? t('repair.oneLeft', { count: damageCount(G.state) }) : t('repair.allDone'));
  markDirty();
  renderRepairCard();
  changed();
}

/** Pay IQ to fix every damaged building now. */
export function payRepair() {
  const cost = repairWithIQ(G.state);
  if (cost < 0) {
    toast(t('shop.poor'));
    return false;
  }
  toast(t('repair.paid', { iq: cost }));
  saveNow();
  renderRepairCard();
  renderIQ();
  changed();
  return true;
}

/** The note above the timer while buildings are damaged. */
export function renderRepairCard() {
  const n = damageCount(G.state);
  const card = $('repairCard');
  card.hidden = !n;
  if (!n) return;
  const cost = n * REPAIR_IQ;
  $('repairText').innerHTML =
    `<b>${icon('hammer')}${t('repair.title', { count: n })}</b>` +
    `<small>${t('repair.study', { m: minutesToRepair(G.state) })}</small>`;
  const btn = $('repairPay');
  btn.textContent = t('repair.pay', { iq: cost });
  btn.disabled = balance(G.state) < cost;
}

/** Card skins are a CSS attribute on the page. */
export function applyCardSkin() {
  const skin = lookOf(G.state).card;
  if (skin === 'plain') delete document.documentElement.dataset.skin;
  else document.documentElement.dataset.skin = skin;
}

export function initEconomy() {
  $('repairPay').addEventListener('click', payRepair);
  applyCardSkin();
  renderRepairCard();
}
