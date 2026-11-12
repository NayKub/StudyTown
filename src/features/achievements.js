// Earning achievements and showing the trophy shelf.
import { G } from '../core/state.js';
import { ACHIEVEMENTS, newlyEarned } from '../core/achievements.js';
import { t, locale } from '../i18n/index.js';
import { $, toast, showModal, isShown } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import * as native from '../platform/native.js';
import { saveNow } from './persistence.js';
import { session } from './account/session.js';
import { badgeBonus } from './shop/economy.js';

const SHELF_SIZE = 6; // how many of the latest badges the side panel shows
let onEarned = () => {};

const earnedCount = () => Object.keys(G.state.badges).length;

/** Award anything newly deserved. Safe to call often; it only reacts when something is new. */
export function checkAchievements() {
  const friends = session.social.friends.length;
  if (friends) G.state.flags.friend = true; // remembered, so the badge survives being offline
  const ids = newlyEarned(G.state, { friends });
  if (!ids.length) return;
  const now = Date.now();
  ids.forEach((id) => {
    G.state.badges[id] = now;
  });
  badgeBonus(ids);
  // several at once (e.g. the first launch after an update): one message instead of a flood
  if (ids.length > 2) toast(t('ach.many', { count: ids.length }));
  else ids.forEach((id) => toast(t('ach.unlocked', { name: t(`ach.${id}.name`) })));
  if (G.settings.haptics) native.buzz('success');
  saveNow();
  renderShelf();
  if (isShown('badgesModal')) renderBadges();
  onEarned();
}

/** The latest few badges on the side panel. */
export function renderShelf() {
  const latest = ACHIEVEMENTS.filter((a) => G.state.badges[a.id])
    .sort((a, b) => G.state.badges[b.id] - G.state.badges[a.id])
    .slice(0, SHELF_SIZE);
  $('badgeCount').textContent = t('ach.count', { n: earnedCount(), total: ACHIEVEMENTS.length });
  $('badgeRow').innerHTML = latest.length
    ? latest.map((a) => `<span class="badgeDot" title="${t(`ach.${a.id}.name`)}">${a.icon}</span>`).join('')
    : `<span class="fine">${t('ach.none')}</span>`;
}

/** The full list: earned ones in colour with their date, the rest greyed out with how to get them. */
export function renderBadges() {
  $('badgesTitle').textContent = `${t('ach.title')} ${earnedCount()}/${ACHIEVEMENTS.length}`;
  $('badgesBody').innerHTML = ACHIEVEMENTS.map((a) => {
    const at = G.state.badges[a.id];
    const date = at
      ? new Date(at).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' })
      : '';
    return `<div class="badge2${at ? ' got' : ''}"><span class="pic">${at ? a.icon : icon('lock')}</span><div><b>${t(`ach.${a.id}.name`)}</b><small>${t(`ach.${a.id}.desc`)}</small>${at ? `<small class="when">${date}</small>` : ''}</div></div>`;
  }).join('');
}

/** onNewBadge runs after badges were earned (main.js uploads them). */
export function initAchievements({ onNewBadge } = {}) {
  if (onNewBadge) onEarned = onNewBadge;
  $('openBadges').addEventListener('click', () => {
    renderBadges();
    showModal('badgesModal');
  });
}
