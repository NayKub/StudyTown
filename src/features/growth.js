// Notices when study time unlocks something: a new building, an upgrade, or a new town rank.
import { G, realMin } from '../core/state.js';
import { plots, tierOf, cityAt } from '../core/city.js';
import { t } from '../i18n/index.js';
import { toast } from '../ui/dom.js';
import * as native from '../platform/native.js';
import { saveNow } from './persistence.js';

let lastMinutes = 0; // total minutes when we last looked
let knownTiers = {}; // plot index -> upgrade tier we have already announced

/** Take the current town as the starting point (at launch and after merging a backup). */
export function resetGrowth() {
  lastMinutes = realMin();
  knownTiers = {};
  plots.forEach((p) => {
    if (p.t <= lastMinutes) knownTiers[p.i] = tierOf(p, lastMinutes);
  });
}

/** Call after study time was added. Announces and animates whatever is new. */
export function checkGrowth() {
  const minutes = realMin();
  if (minutes === lastMinutes) return;
  const now = performance.now();
  let grew = false;

  plots.forEach((p) => {
    if (p.t <= minutes && p.t > lastMinutes) {
      // newly built
      G.anims[p.i] = now;
      toast(t('toast.built', { name: t('kind.' + p.kind) }));
      knownTiers[p.i] = tierOf(p, minutes);
      grew = true;
    } else if (p.t <= lastMinutes) {
      const tier = tierOf(p, minutes);
      if (tier > (knownTiers[p.i] || 0)) {
        // upgraded
        G.anims[p.i] = now;
        toast(t('toast.upgrade', { name: t('up.' + p.kind)[tier] }));
        knownTiers[p.i] = tier;
        grew = true;
      }
    }
  });

  const rankBefore = cityAt(lastMinutes).rank;
  const rankNow = cityAt(minutes).rank;
  if (rankBefore !== rankNow) toast(t('toast.rank', { name: t('rank')[rankNow] }));
  if (grew && G.settings.haptics) native.buzz('medium');

  lastMinutes = minutes;
  saveNow();
}
