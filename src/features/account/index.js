// Accounts and friends. Optional: without a Firebase config the app stays in guest-only mode.
// main.js calls initAccount() once and then only needs sync() and refresh().
import * as cloud from '#cloud';
import { lang } from '../../i18n/index.js';
import { isShown } from '../../ui/dom.js';
import { session, emptySocial } from './session.js';
import { initAccountSheet, renderAccount } from './accountSheet.js';
import { initFriendsCard, renderFriends } from './friendsCard.js';
import { onSyncChange, resetSync, restoreAndSync, startWatch } from './sync.js';

export { sync, refresh } from './sync.js';

let stopSocial = null; // stops the live friends listener

/** hooks: { getState, replaceState(merged), stats(), visit(friend), onFriendsChange() } */
export function initAccount(hooks) {
  session.hooks = hooks;
  if (!cloud.isConfigured) {
    document.body.classList.add('noCloud'); // hides the account button
    renderFriends();
    return;
  }
  initAccountSheet();
  initFriendsCard();
  onSyncChange(() => {
    if (isShown('accountModal')) renderAccount();
  });
  cloud.init(onAuthChange, lang());
  renderFriends();
}

/** Your picture changed on another device: show it on the profile button and sheet. */
export function refreshProfile() {
  renderAccount();
}

export function onLanguageChange() {
  if (cloud.setLanguage) cloud.setLanguage(lang()); // language of the emails Firebase sends
  renderAccount();
  renderFriends();
}

/** Runs at start-up and on every log in / log out. */
async function onAuthChange(user) {
  const previousUid = session.user && session.user.uid;
  session.user = user;
  const samePerson = user && user.uid === previousUid; // only their details were refreshed
  if (!samePerson) {
    if (stopSocial) stopSocial();
    stopSocial = null;
    resetSync();
    session.social = emptySocial();
    if (user) {
      stopSocial = cloud.watchSocial((social) => {
        session.social = social;
        renderFriends();
        session.hooks.onFriendsChange();
      });
      await restoreAndSync();
      // keep listening: when another device on this account uploads, merge it in right away
      if (session.user && session.user.uid === user.uid) startWatch();
    }
  }
  renderAccount();
  renderFriends();
}
