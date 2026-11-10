// Study history: the 7-day mini chart on the side panel and the full log sheet.
import { G } from '../core/state.js';
import { todayKey, lastDays, dayMin } from '../core/dates.js';
import { t, locale, fmtMin } from '../i18n/index.js';
import { $, isShown, showModal } from '../ui/dom.js';

const RANGES = [7, 14, 30];
const MIN_CHART_SCALE = 30; // minutes; keeps a few minutes of study from filling the whole chart
const MIN_DAY_SEC = 30; // days with less than this are left out of the list
let range = 7;

const minutesOn = (k) => dayMin(G.state.days, k);
const shortWeekday = (d) => d.toLocaleDateString(locale(), { weekday: 'short' }).replace('.', '');
const clockTime = (ts) => new Date(ts).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });

/** The 7-day chart on the side panel. */
export function renderWeek() {
  const days = lastDays(7);
  const max = Math.max(MIN_CHART_SCALE, ...days.map((x) => minutesOn(x.k)));
  const today = todayKey();
  $('mini').innerHTML = days
    .map((x) => {
      const m = minutesOn(x.k);
      const label = x.k === today ? t('week.today') : shortWeekday(x.d);
      return `<div class="col${x.k === today ? ' today' : ''}"><span class="v">${m || ''}</span><div class="b${m ? ' has' : ''}" style="height:${(m / max) * 70 + 2}%"></div><small>${label}</small></div>`;
    })
    .join('');
}

function renderRangeTabs() {
  $('rangeTabs').innerHTML = RANGES.map(
    (n) => `<button class="chip${n === range ? ' on' : ''}" data-r="${n}">${t('log.range', { n })}</button>`,
  ).join('');
}

function renderSummary(days, mins) {
  const total = mins.reduce((a, b) => a + b, 0);
  $('lTotal').textContent = fmtMin(total);
  $('lAvg').textContent = fmtMin(Math.round(total / range));
  if (!total) {
    $('lBest').textContent = '-';
    return;
  }
  const best = mins.indexOf(Math.max(...mins));
  const date = days[best].d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
  $('lBest').textContent = date + ' (' + t('unit.minShort', { m: mins[best] }) + ')';
}

function renderChart(days, mins) {
  const max = Math.max(MIN_CHART_SCALE, ...mins);
  const today = todayKey();
  $('chart').innerHTML = days
    .map(
      (x, i) =>
        `<div class="col${x.k === today ? ' today' : ''}"><span class="tip">${t('log.minutes', { m: mins[i] })}</span><div class="b${mins[i] ? ' has' : ''}" style="height:${(mins[i] / max) * 92 + 2}%"></div></div>`,
    )
    .join('');
  // label every day for a week, every 2nd for two weeks, every 5th for a month
  const step = range <= 7 ? 1 : range <= 14 ? 2 : 5;
  $('xlab').innerHTML = days
    .map((x, i) => {
      const show = (range - 1 - i) % step === 0;
      return `<span>${show ? (range <= 7 ? shortWeekday(x.d) : x.d.getDate()) : ''}</span>`;
    })
    .join('');
}

/** Every day with study time, newest first, with that day's sessions. */
function renderDayList() {
  const { days, sessions } = G.state;
  const today = todayKey();
  const keys = Object.keys(days)
    .filter((k) => days[k] >= MIN_DAY_SEC)
    .sort()
    .reverse();
  if (!keys.length) {
    $('dayList').innerHTML = `<div class="empty">${t('log.empty')}</div>`;
    return;
  }
  const sessionsByDay = {};
  (sessions || []).forEach((s) => {
    const k = todayKey(new Date(s.at));
    (sessionsByDay[k] = sessionsByDay[k] || []).push(s);
  });
  $('dayList').innerHTML = keys
    .map((k) => {
      const [y, mo, da] = k.split('-').map(Number);
      const date = new Date(y, mo - 1, da, 12).toLocaleDateString(locale(), {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const list = (sessionsByDay[k] || []).sort((a, b) => a.at - b.at);
      const chips = list
        .map(
          (s) =>
            `<span>🕐 ${clockTime(s.at)}–${clockTime(s.end)} · ${t('log.minutes', { m: Math.round(s.sec / 60) })}</span>`,
        )
        .join('');
      return (
        `<div class="dayRow"><div class="top"><span>${k === today ? t('log.today') + ' · ' : ''}${date}</span><span>${fmtMin(minutesOn(k))}</span></div>` +
        (list.length ? '<div class="sess">' + chips + '</div>' : '') +
        '</div>'
      );
    })
    .join('');
}

export function renderLog() {
  renderRangeTabs();
  const days = lastDays(range);
  const mins = days.map((x) => minutesOn(x.k));
  renderSummary(days, mins);
  renderChart(days, mins);
  renderDayList();
}

/** Re-render the log only if the user is looking at it. */
export function renderLogIfOpen() {
  if (isShown('logModal')) renderLog();
}

function openLog() {
  renderLog();
  showModal('logModal');
}

export function initStudyLog() {
  $('openLog').addEventListener('click', openLog);
  $('logBtn').addEventListener('click', openLog);
  $('rangeTabs').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    range = +chip.dataset.r;
    renderLog();
  });
}
