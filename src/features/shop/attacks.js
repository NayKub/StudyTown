// Throwing bombs at friends' towns, and what happens when one lands on yours.
//
// The thrower writes a small "attack" record (one per friend per day, enforced by the server rules).
// The target's app picks it up, applies the damage with core/wallet.js and deletes the record. The
// damaged buildings are chosen from the attack's id, so the thrower's screen can show exactly the
// same buildings breaking without waiting for the target.
import * as cloud from '#cloud';
import { G, realMin } from '../../core/state.js';
import { plots, cityAt } from '../../core/city.js';
import {
  BOMBS,
  owned,
  useItem,
  receiveAttack,
  attackDay,
  damageCount,
  minutesToRepair,
  balance,
  REPAIR_IQ,
  MIN_BUILDINGS_TO_ATTACK,
} from '../../core/wallet.js';
import { BLAST_MS } from '../../render/effects.js';
import { t } from '../../i18n/index.js';
import { $, esc, toast, showModal, hideModal } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import * as native from '../../platform/native.js';
import { saveNow } from '../persistence.js';
import { session } from '../account/session.js';
import { avatar } from '../account/shared.js';
import { renderIQ, renderRepairCard, payRepair, changed } from './economy.js';
import { openShop } from './shopSheet.js';

let hooks = { visit() {}, startStudy() {}, sync() {} };

/** How many buildings stand, counting from the first plot (later plots may still wait for a choice). */
export function builtCount(unlocked, choices = {}, chooseFrom = Infinity) {
  let n = 0;
  while (n < unlocked && (n < chooseFrom || choices[n] != null)) n++;
  return n;
}

const myBuilt = () =>
  builtCount(cityAt(realMin()).n, G.state.choices, G.state.chooseFrom == null ? Infinity : G.state.chooseFrom);

/** A bomb starts falling on plot i (-1 = onto the shield) in the town on screen. */
function drop(i, delay = 0) {
  const p = plots[i] || { x: 0, y: 0 };
  G.blasts.push({ plot: i, px: p.x, py: p.y, at: performance.now() + delay });
}

// ---------- throwing ----------

const attackKey = (uid, day = attackDay()) => `atk:${uid}:${day}`;
const thrownToday = (uid) => G.state.wallet.used[attackKey(uid)] != null;

let picking = false; // the bomb picker is open in the friend panel
let throwing = false;

/** Why this friend can't be attacked right now ('' if they can). */
function blockedReason(v) {
  const p = v.profile || {};
  if (G.state.peaceful) return t('attack.youPeaceful');
  if (p.peaceful) return t('attack.theyPeaceful', { name: v.name });
  if (
    builtCount(cityAt(v.totalMin).n, v.choices, v.chooseFrom == null ? Infinity : v.chooseFrom) <
    MIN_BUILDINGS_TO_ATTACK
  )
    return t('attack.tooSmall', { name: v.name });
  if (thrownToday(v.uid)) return t('attack.today', { name: v.name });
  return '';
}

/** The attack part of the friend panel. */
export function renderAttackBox() {
  const box = $('attackBox');
  if (!box || !G.visit) return;
  const v = G.visit;
  const blocked = blockedReason(v);
  if (blocked) {
    picking = false;
    box.innerHTML = `<p class="fine attackNote">${esc(blocked)}</p>`;
    return;
  }
  if (!picking) {
    box.innerHTML = `<button class="btn attackBtn" id="attackOpen">${icon('bomb')}<span>${t('attack.open')}</span></button>`;
    return;
  }
  const mine = BOMBS.filter((b) => owned(G.state, b.id));
  if (!mine.length) {
    box.innerHTML = `<p class="fine">${t('attack.none')}</p><button class="btn ghost small" data-attack="shop">${icon('shop')}<span>${t('attack.toShop')}</span></button>`;
    return;
  }
  box.innerHTML =
    `<p class="fine">${t('attack.pick', { name: esc(v.name) })}</p><div class="bombPick">` +
    mine
      .map(
        (b) =>
          `<button class="bombChoice" data-attack="${b.id}"${throwing ? ' disabled' : ''}>${icon(b.id === 'thunder' ? 'storm' : 'bomb')}<b>${t(`item.${b.id}.name`)}</b><small>${t('attack.hits', { count: b.hits })} · ×${owned(G.state, b.id)}</small></button>`,
      )
      .join('') +
    `</div><button class="linkbtn" data-attack="cancel">${t('attack.cancel')}</button>`;
}

/** Work out on this side which buildings the bomb will break, exactly as the friend's app will. */
function predict(v, attack) {
  const d = (v.profile && v.profile.damage) || {};
  const sim = {
    damage: { plots: Object.fromEntries((d.plots || []).map((i) => [i, { at: 0 }])), rain: !!d.rain, fixSec: 0, at: 0 },
    shieldUntil: (v.profile && v.profile.shieldUntil) || 0,
    attacksSeen: {},
  };
  const built = builtCount(cityAt(v.totalMin).n, v.choices, v.chooseFrom == null ? Infinity : v.chooseFrom);
  const res = receiveAttack(sim, attack, built);
  return { res, damage: { plots: Object.keys(sim.damage.plots).map(Number), rain: sim.damage.rain } };
}

async function throwBomb(id) {
  const v = G.visit;
  if (!v || throwing || !owned(G.state, id) || blockedReason(v)) return;
  throwing = true;
  renderAttackBox();
  const u = session.user;
  const day = attackDay();
  try {
    const attackId = await cloud.sendAttack(v.uid, id, u.name || '', G.state.profile.avatar || '', day);
    useItem(G.state, id, attackKey(v.uid, day));
    saveNow();
    changed();
    renderIQ();
    if (G.settings.haptics) native.buzz('heavy');
    const { res, damage } = predict(v, { id: attackId, item: id, fromName: u.name });
    if (G.visit === v) {
      if (res.result === 'hit') {
        res.plots.forEach((i, k) => drop(i, k * 160));
        v.damage = damage;
        v.profile = { ...v.profile, damage };
      } else if (res.result === 'shield') {
        drop(-1);
        v.shieldUntil = 0;
        v.profile = { ...v.profile, shieldUntil: 0 };
      }
    }
    setTimeout(() => {
      const name = v.name;
      if (res.result === 'hit') toast(t('attack.hit', { name, count: res.plots.length }));
      else if (res.result === 'shield') toast(t('attack.blocked', { name }));
      else toast(t('attack.bounced', { name }));
    }, BLAST_MS * 0.6);
  } catch (e) {
    console.error('attack failed', e);
    const code = (e && e.code) || '';
    toast(code.includes('permission') ? t('attack.refused') : t('attack.offline'));
  } finally {
    throwing = false;
    picking = false;
    renderAttackBox();
  }
}

function onAttackClick(e) {
  if (e.target.closest('#attackOpen')) {
    picking = true;
    renderAttackBox();
    return;
  }
  const b = e.target.closest('[data-attack]');
  if (!b) return;
  const what = b.dataset.attack;
  if (what === 'cancel') {
    picking = false;
    renderAttackBox();
  } else if (what === 'shop') {
    picking = false;
    openShop('shop');
  } else {
    throwBomb(what);
  }
}

// ---------- receiving ----------

let stopWatch = null;
const handled = new Set();
let pending = []; // results waiting to be shown in the "attacked" window

export function watchForAttacks() {
  stopWatchingAttacks();
  stopWatch = cloud.watchAttacks(receive);
}

export function stopWatchingAttacks() {
  if (stopWatch) stopWatch();
  stopWatch = null;
}

function receive(list) {
  const fresh = list.filter((a) => !handled.has(a.id));
  if (!fresh.length) return;
  const built = myBuilt();
  const results = [];
  fresh.forEach((a) => {
    handled.add(a.id);
    const r = receiveAttack(G.state, a, built);
    cloud.clearAttack(a.id);
    if (r.result !== 'seen') results.push({ a, r });
  });
  if (!results.length) return;
  saveNow();
  renderRepairCard();
  changed();
  hooks.sync();
  if (!G.visit && !G.preview && G.replayMin == null) {
    let k = 0;
    results.forEach(({ r }) => {
      if (r.result === 'shield') drop(-1, 400 + 160 * k++);
      r.plots.forEach((i) => drop(i, 400 + 160 * k++));
    });
  }
  if (G.settings.haptics) native.buzz('heavy');
  pending = pending.concat(results);
  renderAttacked();
  showModal('attackModal');
}

function line({ a, r }) {
  const who = { name: a.fromName || '?', uid: a.from, avatar: a.fromAvatar || '' };
  const bomb = t(`item.${a.item}.name`);
  const name = esc(who.name);
  let text;
  if (r.result === 'hit') text = t('attacked.hit', { name, bomb, count: r.plots.length });
  else if (r.result === 'shield') text = t('attacked.shield', { name, bomb });
  else if (r.result === 'small') text = t('attacked.small', { name, bomb });
  else text = t('attacked.full', { name, bomb });
  const isFriend = session.social.friends.some((f) => f.uid === a.from);
  const back = isFriend ? `<button class="linkbtn" data-strike="${esc(a.from)}">${t('attacked.strike')}</button>` : '';
  return `<div class="hitLine">${avatar(who, 'sm')}<div><span>${text}</span>${back}</div></div>`;
}

function renderAttacked() {
  const n = damageCount(G.state);
  const cost = n * REPAIR_IQ;
  const anyHit = pending.some(({ r }) => r.result === 'hit');
  $('attackTitle').textContent = anyHit ? t('attacked.title') : t('attacked.titleSafe');
  let html = pending.map(line).join('');
  if (n) {
    html += `<p class="attackSum">${t('attacked.sum', { count: n, iq: cost, m: minutesToRepair(G.state) })}</p>`;
    html += `<div class="attackBtns">
      <button class="btn" data-fix="pay"${balance(G.state) < cost ? ' disabled' : ''}>${icon('hammer')}<span>${t('repair.pay', { iq: cost })}</span></button>
      <button class="btn ghost" data-fix="study">${icon('play')}<span>${t('attacked.study', { m: minutesToRepair(G.state) })}</span></button>
    </div>`;
  }
  html += `<button class="linkbtn" data-fix="later">${t(n ? 'attacked.later' : 'attacked.ok')}</button>`;
  $('attackBody').innerHTML = html;
}

function closeAttacked() {
  pending = [];
  hideModal('attackModal');
}

function onAttackedClick(e) {
  const strike = e.target.closest('[data-strike]');
  if (strike) {
    const f = session.social.friends.find((x) => x.uid === strike.dataset.strike);
    closeAttacked();
    if (f) hooks.visit({ uid: f.uid, name: f.name, profile: f.profile });
    return;
  }
  const b = e.target.closest('[data-fix]');
  if (!b) return;
  if (b.dataset.fix === 'pay') {
    if (payRepair()) closeAttacked();
  } else if (b.dataset.fix === 'study') {
    const minutes = minutesToRepair(G.state);
    closeAttacked();
    hooks.startStudy(minutes);
  } else {
    closeAttacked();
  }
}

/** h = { visit(friend), startStudy(minutes), sync() } */
export function initAttacks(h) {
  hooks = { ...hooks, ...h };
  $('friendPanel').addEventListener('click', onAttackClick);
  $('attackBody').addEventListener('click', onAttackedClick);
  $('attackModal').addEventListener('click', (e) => {
    if (e.target.id === 'attackModal') closeAttacked();
  });
}
