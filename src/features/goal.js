// The daily goal ring and the streak next to it.
import { G } from '../core/state.js';
import { todayKey, goalProgress, streak } from '../core/dates.js';
import { t } from '../i18n/index.js';
import { $, toast } from '../ui/dom.js';
import * as native from '../platform/native.js';
import { saveNow } from './persistence.js';

const RING_LENGTH = 163.36; // circumference of the goal ring in index.html (r = 26)

/** Celebrate once per day, the moment the goal is reached. */
function celebrateIfReached(progress) {
  const today = todayKey();
  if (!progress.reached || G.state.goalHitDay === today) return;
  G.state.goalHitDay = today;
  toast(t('goal.reached', { m: progress.goal }));
  if (G.settings.haptics) native.buzz('success');
  saveNow();
}

/** Called on every tick. */
export function renderGoal() {
  const progress = goalProgress(G.state);
  const days = streak(G.state.days);
  $('goalRing').setAttribute('stroke-dashoffset', RING_LENGTH * (1 - progress.ratio));
  $('goalPct').textContent = progress.reached ? '✓' : Math.round(progress.ratio * 100) + '%';
  $('goalText').textContent = t('goal.progress', { m: progress.minutes, goal: progress.goal });
  // encouragement only: an ended streak is simply not mentioned
  $('goalStreak').textContent = days >= 2 ? t('goal.streak', { count: days }) : t('goal.hint');
  document.querySelector('.goalCard').classList.toggle('reached', progress.reached);
  celebrateIfReached(progress);
}
