// IQ, the currency: earned by studying, spent in the shop on looks, bombs and shields, and on repairs.
//
// Nothing here stores a running balance. The balance is worked out from records that only ever get
// added (bonuses, purchases, uses), keyed so the same record from two devices is the same key. That
// way merging two devices is a plain union and IQ is never counted twice or lost.

export const WELCOME_IQ = 100;
export const GOAL_BONUS = 15;
export const BADGE_BONUS = 25;
export const REPAIR_IQ = 10; // per damaged building
export const REPAIR_STUDY_SEC = 10 * 60; // studying this long repairs one building
export const SHIELD_MS = 3 * 24 * 3600e3;
export const MIN_BUILDINGS_TO_ATTACK = 3;

/** Everything the shop sells. `slot` = which look it changes; looks are kept forever, the rest are used up. */
export const ITEMS = [
  { id: 'meadow', slot: 'ground', price: 0 },
  { id: 'autumn', slot: 'ground', price: 120 },
  { id: 'snow', slot: 'ground', price: 150 },
  { id: 'sakura', slot: 'ground', price: 150 },
  { id: 'desert', slot: 'ground', price: 120 },

  { id: 'live', slot: 'sky', price: 0 },
  { id: 'sunset', slot: 'sky', price: 120 },
  { id: 'starry', slot: 'sky', price: 120 },
  { id: 'petals', slot: 'sky', price: 200 },
  { id: 'aurora', slot: 'sky', price: 200 },

  { id: 'plain', slot: 'card', price: 0 },
  { id: 'mint', slot: 'card', price: 60 },
  { id: 'lavender', slot: 'card', price: 60 },
  { id: 'notebook', slot: 'card', price: 80 },
  { id: 'kraft', slot: 'card', price: 100 },

  { id: 'mini', kind: 'bomb', price: 25, hits: 1 },
  { id: 'big', kind: 'bomb', price: 60, hits: 3 },
  { id: 'thunder', kind: 'bomb', price: 120, hits: 5, rain: true },
  { id: 'shield', kind: 'shield', price: 50 },
];
export const SLOTS = ['ground', 'sky', 'card'];
export const DEFAULT_LOOK = { ground: 'meadow', sky: 'live', card: 'plain' };
export const item = (id) => ITEMS.find((it) => it.id === id);
export const BOMBS = ITEMS.filter((it) => it.kind === 'bomb');

/** A fresh wallet. `base` = study minutes already done when IQ arrived (those don't count). */
export const newWallet = (minutesNow, now = Date.now()) => ({
  since: now,
  base: minutesNow,
  bonus: {},
  spent: {},
  used: {},
});

const sum = (obj) => Object.values(obj || {}).reduce((a, b) => a + (Number(b) || 0), 0);

/** How much IQ there is to spend. */
export function balance(state) {
  const w = state.wallet;
  if (!w) return 0;
  const studied = Math.max(0, Math.floor((state.totalSec || 0) / 60) - (w.base || 0));
  return Math.max(0, WELCOME_IQ + studied + sum(w.bonus) - sum(w.spent));
}

/** Purchases are keyed "buy:<item>:<time>". */
const buys = (state, id) => Object.keys(state.wallet?.spent || {}).filter((k) => k.startsWith(`buy:${id}:`)).length;
const uses = (state, id) => Object.values(state.wallet?.used || {}).filter((v) => v === id).length;

/** Looks: owned once bought (the free ones always). Bombs and shields: how many are left. */
export function owned(state, id) {
  const it = item(id);
  if (!it) return 0;
  if (it.slot) return it.price === 0 || buys(state, id) > 0 ? 1 : 0;
  return Math.max(0, buys(state, id) - uses(state, id));
}

/** Add a one-off bonus (once per key, e.g. "goal:2026-11-12"). Returns true if it was new. */
export function addBonus(state, key, amount) {
  const w = state.wallet;
  if (!w || w.bonus[key] != null) return false;
  w.bonus[key] = amount;
  return true;
}

/** Spend IQ on an item. Returns an error code, or '' when it worked. */
export function buy(state, id, now = Date.now()) {
  const it = item(id);
  if (!it || !state.wallet) return 'unknown';
  if (it.slot && owned(state, id)) return 'owned';
  if (balance(state) < it.price) return 'poor';
  state.wallet.spent[`buy:${id}:${now}`] = it.price;
  return '';
}

/** Use up one bomb or shield. `key` makes the use unique (an attack id, say). */
export function useItem(state, id, key) {
  if (owned(state, id) < 1) return false;
  state.wallet.used[key] = id;
  return true;
}

// ---------- looks ----------

export const lookOf = (state) => ({ ...DEFAULT_LOOK, ...(state.look || {}) });

export function wear(state, id, now = Date.now()) {
  const it = item(id);
  if (!it || !it.slot || !owned(state, id)) return false;
  state.look = { ...lookOf(state), [it.slot]: id, at: now };
  return true;
}

// ---------- damage ----------
// state.damage = { plots: { plotIndex: { by, item, at } }, rain, fixSec, at }
//   fixSec = study seconds counted towards the next free repair; at = last change (newest wins on merge)

export const emptyDamage = () => ({ plots: {}, rain: false, fixSec: 0, at: 0 });
export const damagedPlots = (state) => Object.keys(state.damage?.plots || {}).map(Number);
export const damageCount = (state) => damagedPlots(state).length;

/** Small deterministic random number from a string, so every device picks the same buildings. */
function seeded(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * Apply an attack that arrived. `built` = how many buildings the town has.
 * Returns { result: 'hit' | 'shield' | 'small' | 'full' | 'seen', plots: [...] }.
 *   shield: a shield was on and took the hit; small: town too small to attack;
 *   full: half the town is already damaged, so the bomb bounced; seen: already applied.
 */
export function receiveAttack(state, attack, built, now = Date.now()) {
  state.attacksSeen = state.attacksSeen || {};
  if (state.attacksSeen[attack.id]) return { result: 'seen', plots: [] };
  state.attacksSeen[attack.id] = now;
  const it = item(attack.item);
  if (!it || it.kind !== 'bomb') return { result: 'seen', plots: [] };
  if ((state.shieldUntil || 0) > now) {
    state.shieldUntil = 0;
    state.shieldAt = now;
    return { result: 'shield', plots: [] };
  }
  if (built < MIN_BUILDINGS_TO_ATTACK) return { result: 'small', plots: [] };
  const dmg = state.damage && state.damage.plots ? state.damage : emptyDamage();
  const cap = Math.floor(built / 2);
  const free = [];
  for (let i = 0; i < built; i++) if (!dmg.plots[i]) free.push(i);
  const room = Math.max(0, cap - (built - free.length));
  const n = Math.min(it.hits, room, free.length);
  if (n <= 0) return { result: 'full', plots: [] };
  const rand = seeded(attack.id);
  const hit = [];
  for (let k = 0; k < n; k++) hit.push(free.splice(Math.floor(rand() * free.length), 1)[0]);
  hit.forEach((i) => {
    dmg.plots[i] = { by: attack.fromName || '', item: it.id, at: now };
  });
  if (it.rain) dmg.rain = true;
  dmg.at = now;
  state.damage = dmg;
  return { result: 'hit', plots: hit };
}

/** Fix the n oldest damaged buildings. Rain stops when everything is fixed. */
export function repair(state, n, now = Date.now()) {
  const dmg = state.damage;
  if (!dmg) return [];
  const order = Object.entries(dmg.plots)
    .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])
    .slice(0, n)
    .map(([i]) => Number(i));
  order.forEach((i) => delete dmg.plots[i]);
  if (!Object.keys(dmg.plots).length) {
    dmg.rain = false;
    dmg.fixSec = 0;
  }
  dmg.at = now;
  return order;
}

/** Pay IQ to fix everything at once. Returns the cost, or -1 if there isn't enough IQ. */
export function repairWithIQ(state, now = Date.now()) {
  const n = damageCount(state);
  const cost = n * REPAIR_IQ;
  if (!n || balance(state) < cost) return -1;
  state.wallet.spent[`fix:${now}`] = cost;
  repair(state, n, now);
  return cost;
}

/** Studying repairs: add seconds studied; returns the plots that just got fixed. */
export function studyRepair(state, seconds, now = Date.now()) {
  if (!damageCount(state) || seconds <= 0) return [];
  const dmg = state.damage;
  dmg.fixSec = (dmg.fixSec || 0) + seconds;
  const n = Math.floor(dmg.fixSec / REPAIR_STUDY_SEC);
  if (!n) return [];
  dmg.fixSec -= n * REPAIR_STUDY_SEC;
  return repair(state, n, now);
}

/** Minutes of study still needed to repair everything. */
export function minutesToRepair(state) {
  const n = damageCount(state);
  if (!n) return 0;
  return Math.ceil((n * REPAIR_STUDY_SEC - (state.damage.fixSec || 0)) / 60);
}

// ---------- shield ----------

export const shieldOn = (state, now = Date.now()) => (state.shieldUntil || 0) > now;

export function raiseShield(state, now = Date.now()) {
  if (shieldOn(state, now) || !useItem(state, 'shield', `shield:${now}`)) return false;
  state.shieldUntil = now + SHIELD_MS;
  state.shieldAt = now;
  return true;
}

// ---------- merging two devices ----------

const baseOf = (st) => (st.wallet ? st.wallet.base || 0 : Math.floor((st.totalSec || 0) / 60));
const union = (a = {}, b = {}) => ({ ...a, ...b });
const newer = (a, b, key = 'at') => ((b?.[key] || 0) > (a?.[key] || 0) ? b : a);

/** The wallet, looks, damage and shield of two copies of the same account, combined. */
export function mergeShop(local, remote) {
  const out = {};
  const lw = local.wallet;
  const rw = remote.wallet;
  if (lw || rw) {
    out.wallet = {
      since: Math.min(lw?.since ?? Infinity, rw?.since ?? Infinity),
      // the larger starting point is the safe one: it never hands out IQ twice. A copy saved before
      // IQ existed has no wallet; all of its minutes were studied before IQ, so they don't count.
      base: Math.max(baseOf(local), baseOf(remote)),
      bonus: union(rw?.bonus, lw?.bonus),
      spent: union(rw?.spent, lw?.spent),
      used: union(rw?.used, lw?.used),
    };
  }
  if (local.look || remote.look) out.look = newer(local.look, remote.look);
  if (local.damage || remote.damage) out.damage = newer(local.damage, remote.damage);
  const seen = union(remote.attacksSeen, local.attacksSeen);
  out.attacksSeen = Object.fromEntries(
    Object.entries(seen)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 200),
  );
  const shield = newer(
    { shieldUntil: local.shieldUntil || 0, shieldAt: local.shieldAt || 0 },
    { shieldUntil: remote.shieldUntil || 0, shieldAt: remote.shieldAt || 0 },
    'shieldAt',
  );
  out.shieldUntil = shield.shieldUntil;
  out.shieldAt = shield.shieldAt;
  out.peaceful = newer(
    { v: !!local.peaceful, at: local.peacefulAt || 0 },
    { v: !!remote.peaceful, at: remote.peacefulAt || 0 },
  ).v;
  out.peacefulAt = Math.max(local.peacefulAt || 0, remote.peacefulAt || 0);
  return out;
}

/** UTC day number: attacks are limited to one per friend per day of this. */
export const attackDay = (now = Date.now()) => Math.floor(now / 86400000);
