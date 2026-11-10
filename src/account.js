// Account sheet (sign up, log in, profile) and the Friends card. Talks to the backend through '#cloud'.
import * as cloud from '#cloud';
import { t, lang } from './i18n.js';
import { cityAt } from './city.js';
import { todayKey } from './game.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLORS = ['#ffb3c6', '#a0d8ff', '#ffe08a', '#b8e6b0', '#d7c0ff', '#ffc9a0'];
const avatar = (name, uid) => `<span class="avatar" style="background:${COLORS[[...String(uid)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length]}">${esc((name || '?').trim().charAt(0).toUpperCase())}</span>`;

let H = null;              // hooks from main.js
let user = null;           // { uid, email, name, verified, code } or null
let social = { incoming: [], outgoing: [], friends: [] };
let stopSocial = null, stopBackup = null;
let pushedSig = '';        // what we last uploaded, to skip uploads when nothing changed
let tab = 'login';         // which form the guest view shows
let busy = false;
let msg = { text: '', kind: '' };       // message under the account form
let fmsg = { k: '', opts: null, kind: '' }; // message under the add-friend box (translated when shown)
let confirmRemove = null;  // uid of the friend whose removal is being confirmed
let showDelete = false;
let lastSync = 0, syncing = null;

export const enabled = () => cloud.isConfigured;
export const currentUser = () => user;

/** hooks: { getState, replaceState(merged), stats(), visit({name,totalMin}), toast(text) } */
export function initAccount(hooks) {
  H = hooks;
  if (!cloud.isConfigured) { document.body.classList.add('noCloud'); renderFriends(); return; }
  $('accountBtn').addEventListener('click', openAccount);
  $('accountModal').addEventListener('submit', onSubmit);
  $('accountModal').addEventListener('click', onAccountClick);
  $('accountModal').addEventListener('input', (e) => { if (e.target.form && e.target.form.id === 'authForm' && e.target.name in vals) vals[e.target.name] = e.target.value; });
  $('friendsCard').addEventListener('click', onFriendsClick);
  $('friendsCard').addEventListener('submit', onAddFriend);
  cloud.init(onAuth, lang());
  renderFriends();
}
export function onLanguageChange() { cloud.setLanguage && cloud.setLanguage(lang()); renderAccount(); renderFriends(); }
export function openAccount() { msg = { text: '', kind: '' }; showDelete = false; renderAccount(); $('accountModal').classList.add('show'); }

async function onAuth(u) {
  const was = user && user.uid;
  user = u;
  if (u && u.uid === was) { renderAccount(); renderFriends(); return; } // same person, details refreshed
  if (stopSocial) { stopSocial(); stopSocial = null; }
  if (stopBackup) { stopBackup(); stopBackup = null; }
  social = { incoming: [], outgoing: [], friends: [] }; pushedSig = ''; syncState = { status: 'busy', code: '', at: 0 };
  if (u) {
    stopSocial = cloud.watchSocial((s) => { social = s; renderFriends(); });
    await restoreAndSync();
    // keep listening: when another device on this account uploads, merge it in right away
    if (user && user.uid === u.uid) stopBackup = cloud.watchBackup(onRemoteBackup, (e) => setSync('err', e));
  }
  renderAccount(); renderFriends();
}

// ---------- backup ----------
/** Combine this device's data with the cloud copy without losing or double-counting days. */
export function mergeStates(local, remote) {
  if (!remote) return local;
  const days = { ...(remote.days || {}) };
  Object.entries(local.days || {}).forEach(([k, v]) => { days[k] = Math.max(days[k] || 0, v); });
  const seen = new Set(); const sessions = [];
  [...(remote.sessions || []), ...(local.sessions || [])].forEach((s) => { if (!seen.has(s.at)) { seen.add(s.at); sessions.push(s); } });
  sessions.sort((a, b) => a.at - b.at);
  const sum = Object.values(days).reduce((a, b) => a + b, 0);
  return { ...local, days, sessions: sessions.slice(-2000), totalSec: Math.max(local.totalSec || 0, remote.totalSec || 0, sum) };
}
// Sync status shown in the account sheet, so a failure is visible instead of silent.
let syncState = { status: 'busy', code: '', at: 0 }; // status: busy | ok | err
function setSync(status, e) {
  syncState = { status, code: status === 'err' ? ((e && e.code) || 'error') : '', at: Date.now() };
  if (status === 'err') console.error('sync failed', e);
  if ($('accountModal').classList.contains('show')) renderAccount();
}
const sig = (st) => `${st.totalSec}|${Object.keys(st.days || {}).length}|${(st.sessions || []).length}`;
const pushKey = (st) => sig(st) + '|' + todayKey();

/** Download the cloud copy, merge it with this device, upload the result. */
async function restoreAndSync() {
  setSync('busy');
  try {
    const remote = await cloud.pullBackup();
    if (remote) {
      const local = H.getState(); const merged = mergeStates(local, remote);
      if (sig(merged) !== sig(local)) H.replaceState(merged);
    }
    const st = H.getState();
    await Promise.all([cloud.pushBackup(st), cloud.pushStats(H.stats())]);
    pushedSig = pushKey(st); lastSync = Date.now();
    setSync('ok');
  } catch (e) { setSync('err', e); }
}
function onRemoteBackup(remote) {
  const local = H.getState(); const merged = mergeStates(local, remote);
  if (sig(merged) !== sig(local)) H.replaceState(merged); // the other device had something new
  if (sig(merged) !== sig(remote)) sync(true);            // this device had something new
  else { pushedSig = pushKey(merged); setSync('ok'); }
}
/** Upload backup + public stats. Skipped when nothing changed; throttled to once a minute unless forced. */
export function sync(force) {
  if (!user) return Promise.resolve();
  const st = H.getState(); const now = pushKey(st);
  if (now === pushedSig) return Promise.resolve();
  if (!force && Date.now() - lastSync < 60000) return Promise.resolve();
  if (syncing) return syncing;
  lastSync = Date.now();
  syncing = Promise.all([cloud.pushBackup(st), cloud.pushStats(H.stats())])
    .then(() => { pushedSig = now; setSync('ok'); })
    .catch((e) => { lastSync = 0; setSync('err', e); })
    .finally(() => { syncing = null; });
  return syncing;
}

// ---------- account sheet ----------
const ERR = {
  'auth/email-already-in-use': 'acc.err.exists', 'auth/invalid-email': 'acc.err.email', 'auth/weak-password': 'acc.err.weak',
  'auth/invalid-credential': 'acc.err.wrong', 'auth/wrong-password': 'acc.err.wrong', 'auth/user-not-found': 'acc.err.wrong',
  'auth/too-many-requests': 'acc.err.many', 'auth/network-request-failed': 'acc.err.net', 'auth/missing-password': 'acc.err.weak',
};
const errText = (e) => t(ERR[e && e.code] || 'acc.err.generic');

function renderAccount() {
  if (!cloud.isConfigured) return;
  $('accountBtn').classList.toggle('in', !!user);
  $('accTitle').textContent = user ? t('acc.title') : t(tab === 'login' ? 'acc.login' : 'acc.signup');
  const note = msg.text ? `<p class="formMsg ${msg.kind}">${msg.text}</p>` : '';
  if (!user) {
    $('accBody').innerHTML = `
      <div class="tabs seg"><button class="chip${tab === 'login' ? ' on' : ''}" data-tab="login">${t('acc.login')}</button><button class="chip${tab === 'signup' ? ' on' : ''}" data-tab="signup">${t('acc.signup')}</button></div>
      <form class="form" id="authForm" novalidate>
        ${tab === 'signup' ? `<label>${t('acc.name')}<input name="name" autocomplete="nickname" maxlength="40" required value="${esc(vals.name)}"></label>` : ''}
        <label>${t('acc.email')}<input name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" required value="${esc(vals.email)}"></label>
        <label>${t('acc.password')}<input name="password" type="password" autocomplete="${tab === 'signup' ? 'new-password' : 'current-password'}" minlength="6" required value="${esc(vals.password)}"></label>
        ${note}
        <button class="btn" type="submit" ${busy ? 'disabled' : ''}>${busy ? '…' : t(tab === 'login' ? 'acc.login' : 'acc.create')}</button>
        ${tab === 'login' ? `<button type="button" class="linkbtn" data-act="forgot">${t('acc.forgot')}</button>` : `<p class="fine">${t('acc.pwHint')}</p>`}
      </form>
      <p class="fine">${t('acc.guestNote')}</p>`;
    return;
  }
  const verify = user.verified ? `<span class="pill ok">✓ ${t('acc.verified')}</span>`
    : `<div class="warnBox">${t('acc.notVerified')}<div class="row gap"><button class="linkbtn" data-act="resend">${t('acc.resend')}</button><button class="linkbtn" data-act="checkVerified">${t('acc.iVerified')}</button></div></div>`;
  $('accBody').innerHTML = `
    <div class="me">${avatar(user.name, user.uid)}<div><b>${esc(user.name)}</b><small>${esc(user.email)}</small></div></div>
    ${verify}
    <div class="codeBox"><small>${t('friends.myCode')}</small><b>${cloud.fmtCode(user.code)}</b><button class="chip" data-act="copyCode">${t('friends.copy')}</button></div>
    ${syncState.status === 'err'
      ? `<div class="warnBox">⚠️ ${t(syncState.code === 'permission-denied' ? 'acc.syncErrPerm' : syncState.code === 'unavailable' ? 'acc.err.net' : 'acc.syncErrOther', { code: esc(syncState.code) })}</div>`
      : `<p class="fine">☁️ ${syncState.status === 'ok' ? t('acc.syncOk', { time: new Date(syncState.at).toLocaleTimeString(lang() === 'th' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit' }) }) : t('acc.syncing')}</p>`}
    <button class="btn ghost" data-act="syncNow" ${busy ? 'disabled' : ''}>🔄 ${t('acc.syncNow')}</button>
    ${note}
    <button class="btn ghost" data-act="logout">${t('acc.logout')}</button>
    <div class="danger">
      ${showDelete ? `<form class="form" id="deleteForm"><p class="fine">${t('acc.deleteWarn')}</p>
        <label>${t('acc.password')}<input name="password" type="password" autocomplete="current-password" required></label>
        <div class="btns"><button class="btn ghost" type="button" data-act="cancelDelete">${t('acc.cancel')}</button><button class="btn red" type="submit" ${busy ? 'disabled' : ''}>${t('acc.deleteConfirm')}</button></div></form>`
      : `<button class="linkbtn red" data-act="delete">${t('acc.delete')}</button>`}
    </div>`;
}
const vals = { name: '', email: '', password: '' }; // what the user typed, kept across re-renders

async function run(fn) {
  if (busy) return; busy = true; renderAccount();
  try { await fn(); } catch (e) { msg = { text: errText(e), kind: 'err' }; if (e && e.code === 'auth/email-already-in-use') msg.text += ` <button type="button" class="linkbtn" data-tab="login">${t('acc.goLogin')}</button>`; }
  busy = false; renderAccount();
}

function onSubmit(e) {
  e.preventDefault();
  const f = e.target; const v = (n) => (f.elements[n] ? f.elements[n].value : '');
  if (f.id === 'authForm') {
    const lastEmail = v('email').trim();
    if (tab === 'signup' && !v('name').trim()) { msg = { text: t('acc.err.name'), kind: 'err' }; renderAccount(); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lastEmail)) { msg = { text: t('acc.err.email'), kind: 'err' }; renderAccount(); return; }
    if (v('password').length < 6) { msg = { text: t('acc.err.weak'), kind: 'err' }; renderAccount(); return; }
    msg = { text: '', kind: '' };
    run(async () => {
      if (tab === 'signup') { await cloud.signUp(v('name'), lastEmail, v('password')); msg = { text: t('acc.welcome'), kind: 'ok' }; }
      else { await cloud.logIn(lastEmail, v('password')); $('accountModal').classList.remove('show'); H.toast(t('acc.hello')); }
      vals.password = ''; vals.name = '';
    });
  } else if (f.id === 'deleteForm') {
    run(async () => {
      await cloud.deleteAccount(v('password'), user.code);
      showDelete = false; $('accountModal').classList.remove('show'); H.toast(t('acc.deleted'));
    });
  }
}

function onAccountClick(e) {
  const b = e.target.closest('[data-tab],[data-act]'); if (!b) return;
  if (b.dataset.tab) { tab = b.dataset.tab; msg = { text: '', kind: '' }; renderAccount(); return; }
  const act = b.dataset.act;
  if (act === 'forgot') {
    const email = ($('accBody').querySelector('input[name=email]') || {}).value || '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { msg = { text: t('acc.err.emailFirst'), kind: 'err' }; renderAccount(); return; }
    vals.email = email.trim();
    run(async () => { await cloud.resetPassword(vals.email); msg = { text: t('acc.resetSent'), kind: 'ok' }; });
  } else if (act === 'resend') run(async () => { await cloud.resendVerification(); msg = { text: t('acc.verifySent'), kind: 'ok' }; });
  else if (act === 'checkVerified') run(async () => { const u = await cloud.refreshUser(); user = { ...user, verified: u.verified }; msg = u.verified ? { text: '', kind: '' } : { text: t('acc.stillNot'), kind: 'err' }; });
  else if (act === 'copyCode') copy(cloud.fmtCode(user.code));
  else if (act === 'syncNow') run(async () => { await restoreAndSync(); if (syncState.status === 'ok') H.toast(t('acc.syncDone')); })
  else if (act === 'logout') run(async () => { await sync(true); await cloud.logOut(); $('accountModal').classList.remove('show'); H.toast(t('acc.bye')); });
  else if (act === 'delete') { showDelete = true; msg = { text: '', kind: '' }; renderAccount(); }
  else if (act === 'cancelDelete') { showDelete = false; renderAccount(); }
}

function copy(text) {
  const done = () => H.toast(t('friends.copied', { code: text }));
  try { navigator.clipboard.writeText(text).then(done, done); } catch (e) { done(); }
}

// ---------- friends card ----------
function friendLine(p) {
  if (!p) return t('friends.noStats');
  const today = p.dayKey === todayKey() ? p.todayMin || 0 : 0;
  return `${t('rank')[cityAt(p.totalMin || 0).rank]} · ${t('friends.today', { m: today })}${p.streak ? ` · 🔥${p.streak}` : ''}`;
}
export function renderFriends() {
  const card = $('friendsCard'); if (!card) return;
  if (!cloud.isConfigured) { card.hidden = true; return; }
  card.hidden = false;
  if (!user) {
    $('friendCount').textContent = '';
    $('friendsBody').innerHTML = `<p class="fine">${t('friends.guest')}</p><button class="btn" data-act="openAccount">${t('friends.loginBtn')}</button>`;
    return;
  }
  const { incoming, outgoing, friends } = social;
  $('friendCount').textContent = friends.length ? String(friends.length) : '';
  const fm = fmsg.k ? `<p class="formMsg ${fmsg.kind}">${esc(t(fmsg.k, fmsg.opts || {}))}</p>` : '';
  const sorted = [...friends].sort((a, b) => ((b.profile && b.profile.totalMin) || 0) - ((a.profile && a.profile.totalMin) || 0));
  const prev = $('friendsBody').querySelector('input[name=q]'); const keep = prev ? prev.value : ''; const hadFocus = prev && document.activeElement === prev;
  $('friendsBody').innerHTML = `
    <form class="addRow" id="addFriendForm"><input name="q" placeholder="${t('friends.placeholder')}" autocapitalize="characters" autocomplete="off"><button class="btn" type="submit">${t('friends.add')}</button></form>
    ${fm}
    <div class="codeLine">${t('friends.myCode')}: <b>${cloud.fmtCode(user.code)}</b> <button class="linkbtn" data-act="copyCode">${t('friends.copy')}</button></div>
    ${incoming.length ? `<h4>${t('friends.requests')}</h4>` + incoming.map((r) => `
      <div class="fRow">${avatar(r.fromName, r.from)}<div class="fMain"><b>${esc(r.fromName)}</b><small>${t('friends.wants')}</small></div>
      <button class="chip on" data-act="accept" data-id="${esc(r.from)}">${t('friends.accept')}</button><button class="chip" data-act="decline" data-id="${esc(r.from)}">✕</button></div>`).join('') : ''}
    ${outgoing.length ? `<h4>${t('friends.pending')}</h4>` + outgoing.map((r) => `
      <div class="fRow">${avatar(r.toName, r.to)}<div class="fMain"><b>${esc(r.toName)}</b><small>${t('friends.waiting')}</small></div>
      <button class="chip" data-act="cancel" data-id="${esc(r.to)}">${t('acc.cancel')}</button></div>`).join('') : ''}
    <h4>${t('friends.list')}</h4>
    ${sorted.length ? sorted.map((f) => confirmRemove === f.uid ? `
      <div class="fRow confirm"><div class="fMain"><b>${t('friends.removeQ', { name: esc(f.name) })}</b></div>
      <button class="chip" data-act="noRemove">${t('acc.cancel')}</button><button class="chip red" data-act="yesRemove" data-id="${esc(f.uid)}">${t('friends.remove')}</button></div>` : `
      <div class="fRow">${avatar(f.name, f.uid)}<div class="fMain"><b>${esc((f.profile && f.profile.name) || f.name)}</b><small>${friendLine(f.profile)}</small></div>
      <button class="chip on" data-act="visit" data-id="${esc(f.uid)}">🏡 ${t('friends.visit')}</button><button class="chip ghostX" data-act="askRemove" data-id="${esc(f.uid)}" aria-label="${t('friends.remove')}">⋯</button></div>`).join('')
    : `<p class="fine">${t('friends.none')}</p>`}`;
  const inp = $('friendsBody').querySelector('input[name=q]'); if (inp) { inp.value = keep; if (hadFocus) inp.focus(); }
}

async function onAddFriend(e) {
  e.preventDefault();
  const input = e.target.elements.q; const q = input.value.trim(); if (!q) return;
  const say = (k, opts, kind = 'err') => { fmsg = { k, opts, kind }; renderFriends(); };
  try {
    const target = await cloud.findUser(q);
    if (!target) return say('friends.notFound');
    if (target.uid === user.uid) return say('friends.self');
    if (social.friends.some((f) => f.uid === target.uid)) return say('friends.already', { name: target.name });
    if (social.outgoing.some((r) => r.to === target.uid)) return say('friends.alreadySent', { name: target.name });
    const theirs = social.incoming.find((r) => r.from === target.uid); // they already asked: just accept
    if (theirs) { await cloud.acceptRequest(theirs); const f = $('friendsBody').querySelector('input[name=q]'); if (f) f.value = ''; return say('friends.nowFriends', { name: target.name }, 'ok'); }
    const res = await cloud.sendRequest(target, user.name, user.code);
    const fresh = $('friendsBody').querySelector('input[name=q]'); if (fresh) fresh.value = ''; // the list may have re-rendered meanwhile
    say(res === 'accepted' ? 'friends.nowFriends' : 'friends.sent', { name: target.name }, 'ok');
  } catch (err) { console.error('add friend failed', err); say(err && err.code === 'permission-denied' ? 'friends.errPerm' : err && err.code === 'unavailable' ? 'acc.err.net' : 'acc.err.generic'); }
}

async function onFriendsClick(e) {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = b.dataset.id; const act = b.dataset.act;
  try {
    if (act === 'openAccount') openAccount();
    else if (act === 'copyCode') copy(cloud.fmtCode(user.code));
    else if (act === 'accept') { const r = social.incoming.find((x) => x.from === id); if (r) { b.disabled = true; await cloud.acceptRequest(r); H.toast(t('friends.nowFriends', { name: r.fromName })); } }
    else if (act === 'decline') { const r = social.incoming.find((x) => x.from === id); if (r) await cloud.declineRequest(r); }
    else if (act === 'cancel') { const r = social.outgoing.find((x) => x.to === id); if (r) await cloud.declineRequest(r); }
    else if (act === 'askRemove') { confirmRemove = id; renderFriends(); }
    else if (act === 'noRemove') { confirmRemove = null; renderFriends(); }
    else if (act === 'yesRemove') { confirmRemove = null; await cloud.removeFriend(id); }
    else if (act === 'visit') {
      const f = social.friends.find((x) => x.uid === id);
      if (f) H.visit({ name: (f.profile && f.profile.name) || f.name, totalMin: (f.profile && f.profile.totalMin) || 0 });
    }
  } catch (err) { console.error('friend action failed', err); fmsg = { k: err && err.code === 'permission-denied' ? 'friends.errPerm' : 'acc.err.generic', opts: null, kind: 'err' }; renderFriends(); }
}
