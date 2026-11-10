// The always-visible numbers: town badge, stats tiles and the "next building" progress bar.
import { G, realMin, curMin } from '../core/state.js';
import { clamp } from '../core/util.js';
import { plots, cityAt } from '../core/city.js';
import { todayKey, streak } from '../core/dates.js';
import { t, fmtMin } from '../i18n/index.js';
import { $ } from '../ui/dom.js';

function renderStats(minutes, buildings) {
  const { days } = G.state;
  // the same totals appear on the side panel (s…) and in the study log (a…)
  $('sTotal').textContent = $('aTotal').textContent = fmtMin(minutes);
  $('sToday').textContent = fmtMin(Math.floor((days[todayKey()] || 0) / 60));
  $('sStreak').textContent = $('aStreak').textContent = t('unit.days', { count: streak(days) });
  $('sBuild').textContent = $('aBuild').textContent = t('unit.pieces', { n: buildings });
}

/** Describes the town on screen, which may be a friend's or a preview. */
function renderBadge() {
  const shown = cityAt(curMin());
  const badge = $('badge');
  badge.textContent = (G.visit ? G.visit.name + ' · ' : '') + t('rank')[shown.rank];
  const small = document.createElement('small');
  small.textContent = t('badge.sub', { pop: shown.pop, n: shown.n });
  badge.appendChild(small);
}

/** builtCount = how many plots you have built; the next one is plots[builtCount]. */
function renderNextBuilding(builtCount) {
  const next = plots[builtCount];
  if (!next) {
    $('nextName').textContent = t('next.doneName');
    $('nextBar').style.width = '100%';
    $('nextLeft').textContent = t('next.doneText');
    return;
  }
  const previousAt = builtCount ? plots[builtCount - 1].t : 0;
  const secondsLeft = next.t * 60 - G.state.totalSec;
  const progress = ((G.state.totalSec / 60 - previousAt) / (next.t - previousAt)) * 100;
  $('nextName').textContent = t('kind.' + next.kind);
  $('nextBar').style.width = clamp(progress, 0, 100) + '%';
  $('nextLeft').textContent = t('next.left', { m: Math.max(1, Math.ceil(secondsLeft / 60)) });
}

export function renderHud() {
  const minutes = realMin();
  const mine = cityAt(minutes);
  renderStats(minutes, mine.n);
  renderBadge();
  renderNextBuilding(mine.n);
}
