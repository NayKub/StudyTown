// The account sheet: log in / sign up for guests, profile and sync status for members.
import * as cloud from '#cloud';
import { t, locale } from '../../i18n/index.js';
import { $, esc, toast, showModal, hideModal } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { session } from './session.js';
import { sync, syncStatus } from './sync.js';
import { avatar, copyCode, photoFromFile } from './shared.js';
import { G } from '../../core/state.js';
import { AVATAR_IDS } from '../../render/avatars.js';
import { saveNow } from '../persistence.js';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PASSWORD = 6;

/** Firebase error code -> translation key */
const AUTH_ERRORS = {
  'auth/email-already-in-use': 'acc.err.exists',
  'auth/invalid-email': 'acc.err.email',
  'auth/weak-password': 'acc.err.weak',
  'auth/invalid-credential': 'acc.err.wrong',
  'auth/wrong-password': 'acc.err.wrong',
  'auth/user-not-found': 'acc.err.wrong',
  'auth/too-many-requests': 'acc.err.many',
  'auth/network-request-failed': 'acc.err.net',
  'auth/missing-password': 'acc.err.weak',
};
const errText = (e) => t(AUTH_ERRORS[e && e.code] || 'acc.err.generic');

// ---------- view state ----------
let tab = 'login'; // which form a guest sees: login | signup
let busy = false; // a request is in flight
let msg = { text: '', kind: '' }; // message under the form (may contain our own HTML)
let showDelete = false; // the "delete account" confirmation is open
let showPicker = false; // the profile picture chooser is open
const typed = { name: '', email: '', password: '' }; // what the user typed, kept across re-renders

const clearMsg = () => {
  msg = { text: '', kind: '' };
};
const say = (text, kind) => {
  msg = { text, kind };
};
const sayError = (key) => {
  say(t(key), 'err');
  renderAccount();
};

export function initAccountSheet() {
  const modal = $('accountModal');
  $('accountBtn').addEventListener('click', openAccount);
  modal.addEventListener('submit', onSubmit);
  modal.addEventListener('click', onClick);
  modal.addEventListener('input', rememberTyping);
  modal.addEventListener('change', onPhotoPicked);
  renderAccountButton();
}

export function openAccount() {
  clearMsg();
  showDelete = false;
  showPicker = false;
  renderAccount();
  showModal('accountModal');
}

function rememberTyping(e) {
  const input = e.target;
  if (input.form && input.form.id === 'authForm' && input.name in typed) typed[input.name] = input.value;
}

// ---------- rendering ----------
export function renderAccount() {
  if (!cloud.isConfigured) return;
  const { user } = session;
  renderAccountButton();
  $('accTitle').textContent = user ? t('acc.title') : t(tab === 'login' ? 'acc.login' : 'acc.signup');
  const note = msg.text ? `<p class="formMsg ${msg.kind}">${msg.text}</p>` : '';
  $('accBody').innerHTML = user ? memberView(user, note) : guestView(note);
}

function guestView(note) {
  const isLogin = tab === 'login';
  return `
      <div class="tabs seg"><button class="chip${isLogin ? ' on' : ''}" data-tab="login">${t('acc.login')}</button><button class="chip${isLogin ? '' : ' on'}" data-tab="signup">${t('acc.signup')}</button></div>
      <form class="form" id="authForm" novalidate>
        ${isLogin ? '' : `<label>${t('acc.name')}<input name="name" autocomplete="nickname" maxlength="40" required value="${esc(typed.name)}"></label>`}
        <label>${t('acc.email')}<input name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" required value="${esc(typed.email)}"></label>
        <label>${t('acc.password')}<input name="password" type="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" minlength="6" required value="${esc(typed.password)}"></label>
        ${note}
        <button class="btn" type="submit" ${busy ? 'disabled' : ''}>${busy ? '…' : t(isLogin ? 'acc.login' : 'acc.create')}</button>
        ${isLogin ? `<button type="button" class="linkbtn" data-act="forgot">${t('acc.forgot')}</button>` : `<p class="fine">${t('acc.pwHint')}</p>`}
      </form>
      <p class="fine">${t('acc.guestNote')}</p>`;
}

function verifyView(user) {
  if (user.verified) return `<span class="pill ok">${icon('check')}${t('acc.verified')}</span>`;
  return `<div class="warnBox">${t('acc.notVerified')}<div class="row gap"><button class="linkbtn" data-act="resend">${t('acc.resend')}</button><button class="linkbtn" data-act="checkVerified">${t('acc.iVerified')}</button></div></div>`;
}

function syncView() {
  const s = syncStatus();
  if (s.status === 'err') {
    const key =
      s.code === 'permission-denied'
        ? 'acc.syncErrPerm'
        : s.code === 'unavailable'
          ? 'acc.err.net'
          : 'acc.syncErrOther';
    return `<div class="warnBox">${icon('warn')}${t(key, { code: esc(s.code) })}</div>`;
  }
  if (s.status !== 'ok') return `<p class="fine">${icon('cloud')}${t('acc.syncing')}</p>`;
  const time = new Date(s.at).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  return `<p class="fine">${icon('cloud')}${t('acc.syncOk', { time })}</p>`;
}

function deleteView() {
  if (!showDelete) return `<button class="linkbtn red" data-act="delete">${t('acc.delete')}</button>`;
  return `<form class="form" id="deleteForm"><p class="fine">${t('acc.deleteWarn')}</p>
        <label>${t('acc.password')}<input name="password" type="password" autocomplete="current-password" required></label>
        <div class="btns"><button class="btn ghost" type="button" data-act="cancelDelete">${t('acc.cancel')}</button><button class="btn red" type="submit" ${busy ? 'disabled' : ''}>${t('acc.deleteConfirm')}</button></div></form>`;
}

const myPicture = () => ({ name: session.user.name, uid: session.user.uid, ...G.state.profile });

let shownButton = '';
/** The round profile button on the town: your picture once logged in, an outline figure before. */
export function renderAccountButton() {
  const html = session.user ? avatar(myPicture(), 'fill') : icon('user');
  $('accountBtn').classList.toggle('in', !!session.user);
  if (html === shownButton) return; // a photo is large; don't re-insert it on every render
  shownButton = html;
  $('accountBtn').innerHTML = html;
}

function pickerView() {
  if (!showPicker) return '';
  const current = G.state.profile;
  const choices = AVATAR_IDS.map(
    (id) =>
      `<button class="picChoice${!current.photo && current.avatar === id ? ' on' : ''}" data-act="setAvatar" data-id="${id}" aria-label="${id}">${avatar({ avatar: id }, 'lg')}</button>`,
  ).join('');
  return `<div class="picker">
      <div class="picGrid">${choices}</div>
      <div class="picActions">
        <label class="btn ghost picUpload">${icon('image')}<span>${t('pic.upload')}</span><input type="file" accept="image/*" id="photoInput" hidden></label>
        ${current.photo ? `<button class="linkbtn" data-act="removePhoto">${t('pic.remove')}</button>` : ''}
      </div>
    </div>`;
}

function memberView(user, note) {
  return `
    <div class="me"><button class="picBtn" data-act="togglePicker" aria-label="${t('pic.change')}">${avatar(myPicture(), 'lg')}<span class="picEdit">${icon('image')}</span></button><div><b>${esc(user.name)}</b><small>${esc(user.email)}</small><button class="linkbtn" data-act="togglePicker">${t(showPicker ? 'pic.done' : 'pic.change')}</button></div></div>
    ${pickerView()}
    ${verifyView(user)}
    <div class="codeBox"><small>${t('friends.myCode')}</small><b>${cloud.fmtCode(user.code)}</b><button class="chip" data-act="copyCode">${t('friends.copy')}</button></div>
    ${syncView()}

    ${note}
    <button class="btn ghost" data-act="logout">${t('acc.logout')}</button>
    <div class="danger">
      ${deleteView()}
    </div>`;
}

// ---------- actions ----------
/** Run a request with the buttons disabled, and show any error under the form. */
async function run(fn) {
  if (busy) return;
  busy = true;
  renderAccount();
  try {
    await fn();
  } catch (e) {
    let text = errText(e);
    if (e && e.code === 'auth/email-already-in-use') {
      text += ` <button type="button" class="linkbtn" data-tab="login">${t('acc.goLogin')}</button>`;
    }
    say(text, 'err');
  }
  busy = false;
  renderAccount();
}

function onSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const value = (name) => (form.elements[name] ? form.elements[name].value : '');
  if (form.id === 'authForm') submitAuth(value);
  else if (form.id === 'deleteForm') submitDelete(value);
}

function submitAuth(value) {
  const email = value('email').trim();
  if (tab === 'signup' && !value('name').trim()) return sayError('acc.err.name');
  if (!EMAIL_RE.test(email)) return sayError('acc.err.email');
  if (value('password').length < MIN_PASSWORD) return sayError('acc.err.weak');
  clearMsg();
  run(async () => {
    if (tab === 'signup') {
      await cloud.signUp(value('name'), email, value('password'));
      say(t('acc.welcome'), 'ok');
    } else {
      await cloud.logIn(email, value('password'));
      hideModal('accountModal');
      toast(t('acc.hello'));
    }
    typed.password = '';
    typed.name = '';
  });
}

function submitDelete(value) {
  run(async () => {
    await cloud.deleteAccount(value('password'), session.user.code);
    showDelete = false;
    hideModal('accountModal');
    toast(t('acc.deleted'));
  });
}

/** Store a new picture: it syncs to your other devices and is shown to your friends. */
function setPicture(avatarId, photo) {
  G.state.profile = { avatar: avatarId || '', photo: photo || '', at: Date.now() };
  saveNow();
  sync(true);
  renderAccount();
}

async function onPhotoPicked(e) {
  if (e.target.id !== 'photoInput') return;
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const photo = await photoFromFile(file);
    clearMsg();
    setPicture(G.state.profile.avatar, photo);
    toast(t('pic.saved'));
  } catch {
    say(t('pic.error'), 'err');
    renderAccount();
  }
}

const ACTIONS = {
  togglePicker() {
    showPicker = !showPicker;
    renderAccount();
  },
  setAvatar(el) {
    setPicture(el.dataset.id, '');
    toast(t('pic.saved'));
  },
  removePhoto() {
    setPicture(G.state.profile.avatar, '');
  },
  forgot() {
    const input = $('accBody').querySelector('input[name=email]');
    const email = ((input && input.value) || '').trim();
    if (!EMAIL_RE.test(email)) return sayError('acc.err.emailFirst');
    typed.email = email;
    run(async () => {
      await cloud.resetPassword(email);
      say(t('acc.resetSent'), 'ok');
    });
  },
  resend() {
    run(async () => {
      await cloud.resendVerification();
      say(t('acc.verifySent'), 'ok');
    });
  },
  checkVerified() {
    run(async () => {
      const fresh = await cloud.refreshUser();
      session.user = { ...session.user, verified: fresh.verified };
      if (fresh.verified) clearMsg();
      else say(t('acc.stillNot'), 'err');
    });
  },
  copyCode() {
    copyCode(cloud.fmtCode(session.user.code));
  },
  logout() {
    run(async () => {
      await sync(true); // make sure the latest study time is uploaded first
      await cloud.logOut();
      hideModal('accountModal');
      toast(t('acc.bye'));
    });
  },
  delete() {
    showDelete = true;
    clearMsg();
    renderAccount();
  },
  cancelDelete() {
    showDelete = false;
    renderAccount();
  },
};

function onClick(e) {
  const el = e.target.closest('[data-tab],[data-act]');
  if (!el) return;
  if (el.dataset.tab) {
    tab = el.dataset.tab;
    clearMsg();
    renderAccount();
    return;
  }
  const action = ACTIONS[el.dataset.act];
  if (action) action(el);
}
