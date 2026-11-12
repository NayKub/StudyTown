// The Shop and Bag sheet, opened from the IQ chip next to the profile button.
import { G } from '../../core/state.js';
import {
  ITEMS,
  SLOTS,
  item,
  balance,
  buy,
  owned,
  wear,
  lookOf,
  shieldOn,
  raiseShield,
  damageCount,
  minutesToRepair,
  REPAIR_IQ,
} from '../../core/wallet.js';
import { t, locale } from '../../i18n/index.js';
import { $, esc, toast, showModal, isShown } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import * as native from '../../platform/native.js';
import { saveNow } from '../persistence.js';
import { swatch } from './swatches.js';
import { renderIQ, changed, payRepair, applyCardSkin, onEconomyChange } from './economy.js';

const CONFIRM_MS = 3000; // a price button asks "sure?" for this long before going back
let tab = 'shop';
let confirming = ''; // item id whose button is waiting for the second tap
let confirmTimer = 0;

const fmt = (n) => n.toLocaleString();
const priceLabel = (it) => t('shop.price', { iq: fmt(it.price) });

/** The button on an item tile, depending on whether it's owned, worn, affordable. */
function itemButton(it) {
  const look = lookOf(G.state);
  if (it.slot) {
    if (look[it.slot] === it.id)
      return `<button class="itemBtn on" disabled>${icon('check')}${t('shop.inUse')}</button>`;
    if (owned(G.state, it.id))
      return `<button class="itemBtn" data-act="wear" data-id="${it.id}">${t('shop.use')}</button>`;
  }
  if (it.kind === 'bomb' && G.state.peaceful) return `<button class="itemBtn" disabled>${t('shop.peaceful')}</button>`;
  const poor = balance(G.state) < it.price;
  if (confirming === it.id)
    return `<button class="itemBtn sure" data-act="buy" data-id="${it.id}">${t('shop.sure', { iq: fmt(it.price) })}</button>`;
  return `<button class="itemBtn price" data-act="ask" data-id="${it.id}"${poor ? ' disabled' : ''}>${priceLabel(it)}</button>`;
}

function tile(it, extra = '') {
  const count = it.kind ? owned(G.state, it.id) : 0;
  const desc = it.kind ? `<small>${t(`item.${it.id}.desc`)}</small>` : '';
  const have = count ? `<span class="have">${t('shop.have', { count })}</span>` : '';
  return `<div class="itemTile${it.kind ? ' wide' : ''}">
    <div class="sw">${swatch(it)}${have}</div>
    <div class="itemInfo"><b>${t(`item.${it.id}.name`)}</b>${desc}</div>
    ${extra || itemButton(it)}
  </div>`;
}

/** The note about damaged buildings at the top of both tabs. */
function repairBox() {
  const n = damageCount(G.state);
  if (!n) return '';
  const cost = n * REPAIR_IQ;
  return `<div class="repairBox">${icon('hammer')}<div><b>${t('repair.title', { count: n })}</b><small>${t('repair.study', { m: minutesToRepair(G.state) })}</small></div>
    <button class="btn small" data-act="repair"${balance(G.state) < cost ? ' disabled' : ''}>${t('repair.pay', { iq: cost })}</button></div>`;
}

function shopTab() {
  const groups = SLOTS.map(
    (slot) =>
      `<h3 class="shopH">${t(`shop.${slot}`)}</h3><div class="itemGrid">${ITEMS.filter((it) => it.slot === slot)
        .map((it) => tile(it))
        .join('')}</div>`,
  ).join('');
  const peaceNote = G.state.peaceful ? `<p class="fine">${t('shop.peacefulNote')}</p>` : '';
  const fight =
    `<h3 class="shopH">${t('shop.fight')}</h3>${peaceNote}<p class="fine">${t('shop.fightHint')}</p>` +
    `<div class="itemList">${ITEMS.filter((it) => it.kind)
      .map((it) => tile(it))
      .join('')}</div>`;
  return repairBox() + groups + fight;
}

function shieldButton() {
  if (shieldOn(G.state)) {
    const until = new Date(G.state.shieldUntil).toLocaleString(locale(), {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    return `<button class="itemBtn on" disabled>${t('shield.onUntil', { time: until })}</button>`;
  }
  return `<button class="itemBtn" data-act="shield">${t('shield.turnOn')}</button>`;
}

function bagTab() {
  const looks = SLOTS.map((slot) => {
    const mine = ITEMS.filter((it) => it.slot === slot && owned(G.state, it.id));
    return `<h3 class="shopH">${t(`shop.${slot}`)}</h3><div class="itemGrid">${mine.map((it) => tile(it)).join('')}</div>`;
  }).join('');
  const bombs = ITEMS.filter((it) => it.kind === 'bomb' && owned(G.state, it.id));
  const shields = owned(G.state, 'shield');
  let fight;
  if (bombs.length || shields || shieldOn(G.state)) {
    fight = `<h3 class="shopH">${t('shop.fight')}</h3>`;
    if (bombs.length) fight += `<p class="fine">${t('bag.bombHint')}</p>`;
    fight += `<div class="itemList">${bombs.map((it) => tile(it, '<span></span>')).join('')}`;
    if (shields || shieldOn(G.state)) fight += tile(item('shield'), shieldButton());
    fight += '</div>';
  } else {
    fight = `<h3 class="shopH">${t('shop.fight')}</h3><p class="fine">${t('bag.noBombs')}</p>`;
  }
  return repairBox() + looks + fight;
}

export function renderShop() {
  $('shopIQ').textContent = t('shop.price', { iq: fmt(balance(G.state)) });
  document.querySelectorAll('#shopTabs .chip').forEach((c) => c.classList.toggle('on', c.dataset.tab === tab));
  $('shopBody').innerHTML = tab === 'shop' ? shopTab() : bagTab();
}

function rerender() {
  renderIQ();
  if (isShown('shopModal')) renderShop();
}

const ACTIONS = {
  ask(id) {
    confirming = id;
    clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => {
      confirming = '';
      rerender();
    }, CONFIRM_MS);
  },
  buy(id) {
    confirming = '';
    const it = item(id);
    const error = buy(G.state, id);
    if (error) {
      toast(t(error === 'poor' ? 'shop.poor' : 'shop.owned'));
      return;
    }
    if (G.settings.haptics) native.buzz('success');
    if (it.slot) {
      wear(G.state, id);
      applyCardSkin();
      toast(t('shop.boughtLook', { name: t(`item.${id}.name`) }));
    } else {
      toast(t('shop.bought', { name: t(`item.${id}.name`) }));
    }
    saveNow();
    changed();
  },
  wear(id) {
    if (!wear(G.state, id)) return;
    applyCardSkin();
    saveNow();
    changed();
  },
  shield() {
    if (!raiseShield(G.state)) return;
    toast(t('shield.raised'));
    saveNow();
    changed();
  },
  repair() {
    payRepair();
  },
};

export function openShop(which = 'shop') {
  tab = which;
  confirming = '';
  renderShop();
  showModal('shopModal');
}

export function initShopSheet() {
  $('iqBtn').addEventListener('click', () => openShop('shop'));
  $('shopTabs').innerHTML = ['shop', 'bag']
    .map(
      (k) =>
        `<button class="chip" data-tab="${k}">${icon(k === 'shop' ? 'shop' : 'bag')}${esc(t(`shop.tab.${k}`))}</button>`,
    )
    .join('');
  $('shopTabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    tab = b.dataset.tab;
    confirming = '';
    renderShop();
  });
  $('shopBody').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    ACTIONS[b.dataset.act](b.dataset.id);
    rerender();
  });
  onEconomyChange(rerender);
}

/** Re-label the tabs after the language changes. */
export function renderShopTexts() {
  document.querySelectorAll('#shopTabs .chip').forEach((c) => {
    c.innerHTML = icon(c.dataset.tab === 'shop' ? 'shop' : 'bag') + esc(t(`shop.tab.${c.dataset.tab}`));
  });
  rerender();
}
