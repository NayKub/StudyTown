// The Friends section of the profile sheet: add by code or email, answer requests,
// see friends' stats, visit their towns.
import * as cloud from '#cloud';
import { t } from '../../i18n/index.js';
import { $, esc, toast } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { cityAt } from '../../core/city.js';
import { todayKey } from '../../core/dates.js';
import { session } from './session.js';
import { G } from '../../core/state.js';
import { avatar } from './shared.js';

// ---------- view state ----------
let notice = { key: '', opts: null, kind: '' }; // message under the add box (translated when shown)
let confirmRemove = null; // uid of the friend whose removal is being confirmed

const totalMinOf = (friend) => (friend.profile && friend.profile.totalMin) || 0;
const nameOf = (friend) => (friend.profile && friend.profile.name) || friend.name;
const addInput = () => $('friendsBody').querySelector('input[name=q]');

function say(key, opts, kind = 'err') {
  notice = { key, opts, kind };
  renderFriends();
}

/** Turn a backend error into a message the user can act on. */
function errorKey(err, { offline = false } = {}) {
  if (err && err.code === 'permission-denied') return 'friends.errPerm';
  if (offline && err && err.code === 'unavailable') return 'acc.err.net';
  return 'acc.err.generic';
}

export function initFriendsCard() {
  $('friendsCard').addEventListener('click', onClick);
  $('friendsCard').addEventListener('submit', onAddFriend);
}

// ---------- rendering ----------
/** One line of stats under a friend's name: rank, minutes today, streak. */
function statsLine(profile) {
  if (!profile) return t('friends.noStats');
  const today = profile.dayKey === todayKey() ? profile.todayMin || 0 : 0; // their "today" may be yesterday's
  const rank = t('rank')[cityAt(profile.totalMin || 0).rank];
  const streak = profile.streak ? ` · ${icon('flame')}${Number(profile.streak) || 0}` : '';
  const badges = profile.badges ? ` · ${icon('medal')}${Number(profile.badges) || 0}` : '';
  return `${rank} · ${t('friends.today', { m: today })}${streak}${badges}`;
}

const incomingRow = (r) => `
      <div class="fRow">${avatar({ name: r.fromName, uid: r.from, avatar: r.fromAvatar })}<div class="fMain"><b>${esc(r.fromName)}</b><small>${t('friends.wants')}</small></div>
      <button class="chip on" data-act="accept" data-id="${esc(r.from)}">${t('friends.accept')}</button><button class="chip" data-act="decline" data-id="${esc(r.from)}" aria-label="${t('acc.cancel')}">${icon('close')}</button></div>`;

const outgoingRow = (r) => `
      <div class="fRow">${avatar({ name: r.toName, uid: r.to })}<div class="fMain"><b>${esc(r.toName)}</b><small>${t('friends.waiting')}</small></div>
      <button class="chip" data-act="cancel" data-id="${esc(r.to)}">${t('acc.cancel')}</button></div>`;

const confirmRemoveRow = (f) => `
      <div class="fRow confirm"><div class="fMain"><b>${t('friends.removeQ', { name: esc(f.name) })}</b></div>
      <button class="chip" data-act="noRemove">${t('acc.cancel')}</button><button class="chip red" data-act="yesRemove" data-id="${esc(f.uid)}">${t('friends.remove')}</button></div>`;

const friendRow = (f) => `
      <div class="fRow">${avatar({ name: nameOf(f), uid: f.uid, ...(f.profile || {}) })}<div class="fMain"><b>${esc(nameOf(f))}</b><small>${statsLine(f.profile)}</small></div>
      <button class="chip on" data-act="visit" data-id="${esc(f.uid)}">${icon('home')}${t('friends.visit')}</button><button class="chip ghostX" data-act="askRemove" data-id="${esc(f.uid)}" aria-label="${t('friends.remove')}">${icon('more')}</button></div>`;

function memberView(user, { incoming, outgoing, friends }) {
  const message = notice.key ? `<p class="formMsg ${notice.kind}">${esc(t(notice.key, notice.opts || {}))}</p>` : '';
  const byStudyTime = [...friends].sort((a, b) => totalMinOf(b) - totalMinOf(a));
  const section = (titleKey, rows) => (rows.length ? `<h4>${t(titleKey)}</h4>` + rows.join('') : '');
  return `
    <form class="addRow" id="addFriendForm"><input name="q" placeholder="${t('friends.placeholder')}" autocapitalize="characters" autocomplete="off"><button class="btn" type="submit">${t('friends.add')}</button></form>
    ${message}
    ${section('friends.requests', incoming.map(incomingRow))}
    ${section('friends.pending', outgoing.map(outgoingRow))}
    <h4>${t('friends.list')}</h4>
    ${
      byStudyTime.length
        ? byStudyTime.map((f) => (confirmRemove === f.uid ? confirmRemoveRow(f) : friendRow(f))).join('')
        : `<p class="fine">${t('friends.none')}</p>`
    }`;
}

export function renderFriends() {
  const card = $('friendsCard');
  if (!card) return;
  if (!cloud.isConfigured) {
    card.hidden = true;
    return;
  }
  const { user, social } = session;
  // a red dot on the profile button when someone is waiting for an answer
  $('accountBtn').classList.toggle('hasNews', !!user && social.incoming.length > 0);
  card.hidden = !user; // guests see the log-in form in the same sheet instead
  if (!user) return;
  $('friendCount').textContent = social.friends.length ? String(social.friends.length) : '';
  // re-rendering replaces the input, so carry over what was typed and the focus
  const before = addInput();
  const typed = before ? before.value : '';
  const hadFocus = before && document.activeElement === before;
  $('friendsBody').innerHTML = memberView(user, social);
  const after = addInput();
  if (after) {
    after.value = typed;
    if (hadFocus) after.focus();
  }
}

// ---------- actions ----------
function clearAddInput() {
  const input = addInput(); // the list may have re-rendered since the form was submitted
  if (input) input.value = '';
}

async function onAddFriend(e) {
  e.preventDefault();
  const query = e.target.elements.q.value.trim();
  if (!query) return;
  const { user, social } = session;
  try {
    const target = await cloud.findUser(query);
    if (!target) return say('friends.notFound');
    if (target.uid === user.uid) return say('friends.self');
    const name = { name: target.name };
    if (social.friends.some((f) => f.uid === target.uid)) return say('friends.already', name);
    if (social.outgoing.some((r) => r.to === target.uid)) return say('friends.alreadySent', name);

    const theirRequest = social.incoming.find((r) => r.from === target.uid);
    if (theirRequest) {
      // they already asked: adding them is the same as accepting
      await cloud.acceptRequest(theirRequest);
      clearAddInput();
      return say('friends.nowFriends', name, 'ok');
    }
    const result = await cloud.sendRequest(target, user.name, user.code, G.state.profile.avatar || '');
    clearAddInput();
    say(result === 'accepted' ? 'friends.nowFriends' : 'friends.sent', name, 'ok');
  } catch (err) {
    console.error('add friend failed', err);
    say(errorKey(err, { offline: true }));
  }
}

const findIncoming = (uid) => session.social.incoming.find((r) => r.from === uid);
const findOutgoing = (uid) => session.social.outgoing.find((r) => r.to === uid);

/** data-act -> handler(id, button) */
const ACTIONS = {
  async accept(id, button) {
    const request = findIncoming(id);
    if (!request) return;
    button.disabled = true;
    await cloud.acceptRequest(request);
    toast(t('friends.nowFriends', { name: request.fromName }));
  },
  async decline(id) {
    const request = findIncoming(id);
    if (request) await cloud.declineRequest(request);
  },
  async cancel(id) {
    const request = findOutgoing(id);
    if (request) await cloud.declineRequest(request);
  },
  askRemove(id) {
    confirmRemove = id;
    renderFriends();
  },
  noRemove() {
    confirmRemove = null;
    renderFriends();
  },
  async yesRemove(id) {
    confirmRemove = null;
    await cloud.removeFriend(id);
  },
  visit(id) {
    const friend = session.social.friends.find((f) => f.uid === id);
    if (friend) session.hooks.visit({ uid: friend.uid, name: nameOf(friend), profile: friend.profile || {} });
  },
};

async function onClick(e) {
  const button = e.target.closest('[data-act]');
  if (!button) return;
  const action = ACTIONS[button.dataset.act];
  if (!action) return;
  try {
    await action(button.dataset.id, button);
  } catch (err) {
    console.error('friend action failed', err);
    notice = { key: errorKey(err), opts: null, kind: 'err' };
    renderFriends();
  }
}
