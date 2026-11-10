// Notices when study time unlocks something: a new building, an upgrade, or a new town rank.
import { G, realMin, ownTown } from '../core/state.js';
import { plots, tierOf, cityAt, kindOf } from '../core/city.js';
import { t } from '../i18n/index.js';
import { toast } from '../ui/dom.js';
import * as native from '../platform/native.js';
import { saveNow } from './persistence.js';
import { checkAchievements } from './achievements.js';

let lastMinutes = 0; // total minutes when we last looked
let knownTiers = {}; // plot index -> upgrade tier we have already announced

const kindNow = (p) => kindOf(p, ownTown());

/** Take the current town as the starting point (at launch and after merging a backup). */
export function resetGrowth() {
  lastMinutes = realMin();
  knownTiers = {};
  plots.forEach((p) => {
    if (p.t <= lastMinutes) knownTiers[p.i] = tierOf(p, lastMinutes, kindNow(p));
  });
}

/** The player just chose what to build on plot p: start its upgrades from here. */
export function noteBuilt(p) {
  knownTiers[p.i] = tierOf(p, realMin(), kindNow(p));
}

/** Call after study time was added. Announces and animates whatever is new. */
export function checkGrowth() {
  const minutes = realMin();
  if (minutes === lastMinutes) return;
  const now = performance.now();
  let grew = false;
  let plotsToChoose = 0;

  plots.forEach((p) => {
    const kind = kindNow(p);
    if (p.t <= minutes && p.t > lastMinutes) {
      if (kind === 'site') {
        plotsToChoose++; // unlocked, but the player decides what goes here
      } else {
        G.anims[p.i] = now;
        toast(t('toast.built', { name: t('kind.' + kind) }));
        knownTiers[p.i] = tierOf(p, minutes, kind);
      }
      grew = true;
    } else if (p.t <= lastMinutes && kind !== 'site') {
      const tier = tierOf(p, minutes, kind);
      if (tier > (knownTiers[p.i] || 0)) {
        // upgraded
        G.anims[p.i] = now;
        toast(t('toast.upgrade', { name: t('up.' + kind)[tier] }));
        knownTiers[p.i] = tier;
        grew = true;
      }
    }
  });
  if (plotsToChoose) toast(t('toast.plotReady', { count: plotsToChoose }));

  const rankBefore = cityAt(lastMinutes).rank;
  const rankNow = cityAt(minutes).rank;
  if (rankBefore !== rankNow) toast(t('toast.rank', { name: t('rank')[rankNow] }));
  if (grew && G.settings.haptics) native.buzz('medium');

  lastMinutes = minutes;
  saveNow();
  checkAchievements();
}
