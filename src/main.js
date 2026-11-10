import '@fontsource/mali/400.css';
import '@fontsource/mali/600.css';
import '@fontsource/mali/700.css';
import './styles.css';

import { G, realMin, curMin, clamp, todayKey } from './game.js';
import { plots, tierOf, cityAt } from './city.js';
import { initI18n, setLang, applyI18n, t, lang, locale, detectLang, fmtMin, LANGS } from './i18n.js';
import { loadState, saveState, loadSettings, saveSettings } from './storage.js';
import * as native from './native.js';
import { startRender, syncChars } from './render.js';

const $ = (id) => document.getElementById(id);
const PRESETS = [15, 25, 45, 60];
const RING = 540.35;
const timer = G.timer;

// ---------- saving ----------
let lastSaved = 0, dirty = false;
function saveNow() {
  G.state.timer = timer.active ? { ...timer } : null; // lets a running session survive the app being closed
  saveState(G.state);
  lastSaved = Date.now(); dirty = false;
}
function maybeSave() { if (dirty && Date.now() - lastSaved > 30000) saveNow(); }

// ---------- growth tracking ----------
let lastMinutes = 0, tierSnap = {};
function snapshotTiers() {
  tierSnap = {}; const m = realMin();
  plots.forEach((p) => { if (p.t <= m) tierSnap[p.i] = tierOf(p, m); });
}
function checkGrowth() {
  const m = realMin(); if (m === lastMinutes) return;
  const now = performance.now(); let grew = false;
  plots.forEach((p) => {
    if (p.t <= m && p.t > lastMinutes) {
      G.anims[p.i] = now; toast(t('toast.built', { name: t('kind.' + p.kind) })); tierSnap[p.i] = tierOf(p, m); grew = true;
    } else if (p.t <= lastMinutes) {
      const tier = tierOf(p, m);
      if (tier > (tierSnap[p.i] || 0)) { G.anims[p.i] = now; toast(t('toast.upgrade', { name: t('up.' + p.kind)[tier] })); tierSnap[p.i] = tier; grew = true; }
    }
  });
  const before = cityAt(lastMinutes).rank, after = cityAt(m).rank;
  if (before !== after) toast(t('toast.rank', { name: t('rank')[after] }));
  if (grew && G.settings.haptics) native.buzz('medium');
  lastMinutes = m; saveNow();
}
function toast(text) {
  const box = $('toasts');
  while (box.children.length >= 3) box.firstChild.remove();
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = text;
  box.appendChild(d); setTimeout(() => d.remove(), 3600);
}

// ---------- timer ----------
const elapsed = () => timer.before + (timer.running ? (Date.now() - timer.startedAt) / 1000 : 0);

function renderPresets() {
  const mins = Math.round(timer.dur / 60), custom = !PRESETS.includes(mins);
  $('presets').innerHTML = PRESETS.map((m) => `<button class="chip${m === mins ? ' on' : ''}" data-m="${m}">${t('unit.min', { m })}</button>`).join('')
    + `<span class="custom">${t('custom.or')} <input id="customMin" type="number" inputmode="numeric" min="1" max="240" placeholder="${t('custom.placeholder')}" value="${custom ? mins : ''}"></span>`;
  setPresetsDisabled(timer.active);
}
function setPresetsDisabled(d) {
  document.querySelectorAll('#presets .chip').forEach((c) => { c.disabled = d; });
  const ci = $('customMin'); if (ci) ci.disabled = d;
}
function setDur(m) { if (timer.active) return; timer.dur = Math.round(m * 60); renderTimer(); }
$('presets').addEventListener('click', (e) => {
  const b = e.target.closest('.chip'); if (!b || timer.active) return;
  setDur(+b.dataset.m); renderPresets();
});
$('presets').addEventListener('input', (e) => {
  if (e.target.id !== 'customMin' || timer.active) return;
  const v = clamp(Math.floor(+e.target.value || 0), 0, 240);
  if (v >= 1) { document.querySelectorAll('#presets .chip').forEach((c) => c.classList.remove('on')); setDur(v); }
});

let audio = null;
function unlockAudio() {
  try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.resume) audio.resume(); } catch (e) { /* no audio */ }
}
function chime() {
  if (!G.settings.sound) return;
  try {
    unlockAudio();
    [523, 659, 784, 1047].forEach((f, i) => {
      const o = audio.createOscillator(), g = audio.createGain(), at = audio.currentTime + i * 0.15;
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.2, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
      o.connect(g).connect(audio.destination); o.start(at); o.stop(at + 0.6);
    });
  } catch (e) { /* no audio */ }
}

function applyAwake() { native.setAwake(timer.running && G.settings.keepAwake); }

$('startBtn').addEventListener('click', async () => {
  unlockAudio();
  if (timer.running) { // pause
    timer.before = elapsed(); timer.running = false; credit();
  } else {             // start or resume
    if (!timer.active) { timer.before = 0; timer.credited = 0; timer.active = true; timer.sessionStart = Date.now(); }
    timer.startedAt = Date.now(); timer.running = true;
    if (G.preview) { $('pvOn').checked = false; setPreview(false); }
    if (G.settings.notify) native.ensureNotifyPermission();
  }
  if (G.settings.haptics) native.buzz('light');
  applyAwake(); setPresetsDisabled(timer.active); renderTimer(); saveNow();
});
$('stopBtn').addEventListener('click', () => {
  if (!timer.active) return;
  timer.before = elapsed(); timer.running = false; credit();
  endSession(false, Math.floor(timer.credited / 60));
});

function recordSession() {
  if (timer.credited < 30) return; // ignore accidental taps
  if (!Array.isArray(G.state.sessions)) G.state.sessions = [];
  const end = Math.min(Date.now(), (timer.sessionStart || Date.now()) + Math.max(timer.dur, timer.credited) * 1000 + 3600e3);
  G.state.sessions.push({ at: timer.sessionStart || Date.now(), end, sec: timer.credited });
  if (G.state.sessions.length > 2000) G.state.sessions.splice(0, G.state.sessions.length - 2000);
}
function endSession(done, m) {
  recordSession();
  timer.active = false; timer.running = false; timer.before = 0; timer.credited = 0;
  native.cancelDone(); applyAwake();
  setPresetsDisabled(false); saveNow(); renderTimer(); renderMini();
  if (done) {
    chime(); if (G.settings.haptics) native.buzz('success');
    $('doneText').textContent = t('done.text', { m });
    $('doneModal').classList.add('show');
  } else if (m > 0) toast(t('toast.saved', { m }));
}
$('doneOk').addEventListener('click', () => $('doneModal').classList.remove('show'));

/** Move newly elapsed seconds into the saved totals. Safe to call any time. */
function credit() {
  const add = Math.floor(Math.min(elapsed(), timer.dur)) - timer.credited;
  if (add <= 0) return;
  timer.credited += add; G.state.totalSec += add;
  const k = todayKey(); G.state.days[k] = (G.state.days[k] || 0) + add;
  dirty = true; checkGrowth();
}
function tick() {
  if (timer.running) {
    credit();
    if (elapsed() >= timer.dur) {
      const m = Math.round(timer.dur / 60);
      timer.before = timer.dur; timer.running = false; credit(); endSession(true, m);
    }
  }
  renderTimer(); refreshUI(); maybeSave();
}

function renderTimer() {
  const e = timer.active ? Math.min(elapsed(), timer.dur) : 0, left = Math.max(0, timer.dur - e);
  const text = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(Math.floor(left % 60)).padStart(2, '0');
  $('clock').textContent = text;
  $('ring').setAttribute('stroke-dashoffset', RING * (1 - e / timer.dur));
  $('status').textContent = t(!timer.active ? 'status.ready' : timer.running ? 'status.studying' : 'status.paused');
  $('startBtn').textContent = t(timer.running ? 'btn.pause' : timer.active ? 'btn.resume' : 'btn.start');
  document.title = timer.running ? text + ' • ' + t('app.title') : t('app.title');
}

function streak() {
  let n = 0; const d = new Date();
  if (!(G.state.days[todayKey(d)] >= 60)) d.setDate(d.getDate() - 1);
  while (G.state.days[todayKey(d)] >= 60) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function refreshUI() {
  const m = realMin(), real = cityAt(m);
  $('sTotal').textContent = $('aTotal').textContent = fmtMin(m);
  $('sToday').textContent = fmtMin(Math.floor((G.state.days[todayKey()] || 0) / 60));
  $('sStreak').textContent = $('aStreak').textContent = t('unit.days', { count: streak() });
  $('sBuild').textContent = $('aBuild').textContent = t('unit.pieces', { n: real.n });
  const shown = cityAt(curMin());
  const badge = $('badge');
  badge.textContent = t('rank')[shown.rank];
  const small = document.createElement('small'); small.textContent = t('badge.sub', { pop: shown.pop, n: shown.n });
  badge.appendChild(small);
  const nx = plots[real.n];
  if (nx) {
    const prev = real.n ? plots[real.n - 1].t : 0, secNeed = nx.t * 60 - G.state.totalSec;
    $('nextName').textContent = t('kind.' + nx.kind);
    $('nextBar').style.width = clamp((G.state.totalSec / 60 - prev) / (nx.t - prev) * 100, 0, 100) + '%';
    $('nextLeft').textContent = t('next.left', { m: Math.max(1, Math.ceil(secNeed / 60)) });
  } else {
    $('nextName').textContent = t('next.doneName'); $('nextBar').style.width = '100%'; $('nextLeft').textContent = t('next.doneText');
  }
}

// ---------- peek ahead ----------
function setPreview(on) {
  G.preview = on; $('pvRange').disabled = !on; $('previewTag').style.display = on ? 'block' : 'none';
  G.city = cityAt(curMin()); syncChars(true); refreshUI();
}
function renderPvVal() { $('pvVal').textContent = t('unit.h', { h: $('pvRange').value }); }
$('pvOn').addEventListener('change', (e) => {
  if (timer.running) { e.target.checked = false; toast(t('preview.off')); return; }
  setPreview(e.target.checked);
});
$('pvRange').addEventListener('input', (e) => { G.previewMin = Math.round(+e.target.value * 60); renderPvVal(); });

// ---------- study log ----------
const dayMin = (k) => Math.round((G.state.days[k] || 0) / 60);
function lastDays(n) {
  const out = [], d = new Date(); d.setHours(12); d.setDate(d.getDate() - (n - 1));
  for (let i = 0; i < n; i++) { out.push({ k: todayKey(d), d: new Date(d) }); d.setDate(d.getDate() + 1); }
  return out;
}
const wdShort = (d) => d.toLocaleDateString(locale(), { weekday: 'short' }).replace('.', '');
function renderMini() {
  const days = lastDays(7), max = Math.max(30, ...days.map((x) => dayMin(x.k))), tk = todayKey();
  $('mini').innerHTML = days.map((x) => {
    const m = dayMin(x.k);
    return `<div class="col${x.k === tk ? ' today' : ''}"><span class="v">${m || ''}</span><div class="b${m ? ' has' : ''}" style="height:${m / max * 70 + 2}%"></div><small>${x.k === tk ? t('week.today') : wdShort(x.d)}</small></div>`;
  }).join('');
}
let logRange = 7;
function renderLog() {
  $('rangeTabs').innerHTML = [7, 14, 30].map((n) => `<button class="chip${n === logRange ? ' on' : ''}" data-r="${n}">${t('log.range', { n })}</button>`).join('');
  const days = lastDays(logRange), tk = todayKey(), mins = days.map((x) => dayMin(x.k)), max = Math.max(30, ...mins);
  const total = mins.reduce((a, b) => a + b, 0);
  $('lTotal').textContent = fmtMin(total); $('lAvg').textContent = fmtMin(Math.round(total / logRange));
  const bi = mins.indexOf(Math.max(...mins));
  $('lBest').textContent = total ? days[bi].d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' }) + ' (' + t('unit.minShort', { m: mins[bi] }) + ')' : '-';
  $('chart').innerHTML = days.map((x, i) => `<div class="col${x.k === tk ? ' today' : ''}"><span class="tip">${t('log.minutes', { m: mins[i] })}</span><div class="b${mins[i] ? ' has' : ''}" style="height:${mins[i] / max * 92 + 2}%"></div></div>`).join('');
  const step = logRange <= 7 ? 1 : logRange <= 14 ? 2 : 5;
  $('xlab').innerHTML = days.map((x, i) => `<span>${(logRange - 1 - i) % step === 0 ? (logRange <= 7 ? wdShort(x.d) : x.d.getDate()) : ''}</span>`).join('');

  const keys = Object.keys(G.state.days).filter((k) => G.state.days[k] >= 30).sort().reverse();
  const byDay = {};
  (G.state.sessions || []).forEach((s) => { const k = todayKey(new Date(s.at)); (byDay[k] = byDay[k] || []).push(s); });
  const hm = (ts) => new Date(ts).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  $('dayList').innerHTML = keys.length ? keys.map((k) => {
    const [y, mo, da] = k.split('-').map(Number), d = new Date(y, mo - 1, da, 12);
    const ss = (byDay[k] || []).sort((a, b) => a.at - b.at);
    const date = d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
    return `<div class="dayRow"><div class="top"><span>${k === tk ? t('log.today') + ' · ' : ''}${date}</span><span>${fmtMin(dayMin(k))}</span></div>`
      + (ss.length ? '<div class="sess">' + ss.map((s) => `<span>🕐 ${hm(s.at)}–${hm(s.end)} · ${t('log.minutes', { m: Math.round(s.sec / 60) })}</span>`).join('') + '</div>' : '') + '</div>';
  }).join('') : `<div class="empty">${t('log.empty')}</div>`;
}
const openLog = () => { renderLog(); $('logModal').classList.add('show'); };
$('openLog').addEventListener('click', openLog);
$('logBtn').addEventListener('click', openLog);
$('rangeTabs').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (!b) return; logRange = +b.dataset.r; renderLog(); });

// ---------- settings ----------
function renderSettings() {
  $('langTabs').innerHTML = Object.entries(LANGS).map(([k, name]) => `<button class="chip${k === lang() ? ' on' : ''}" data-lang="${k}">${name}</button>`).join('');
  document.querySelectorAll('[data-setting]').forEach((el) => { el.checked = !!G.settings[el.dataset.setting]; });
  $('version').textContent = t('settings.version', { v: __APP_VERSION__ });
}
$('settingsBtn').addEventListener('click', () => { renderSettings(); $('settingsModal').classList.add('show'); });
$('langTabs').addEventListener('click', async (e) => {
  const b = e.target.closest('.chip'); if (!b) return;
  G.settings.lang = b.dataset.lang; saveSettings(G.settings);
  await setLang(G.settings.lang); renderAll();
});
document.querySelectorAll('[data-setting]').forEach((el) => el.addEventListener('change', () => {
  G.settings[el.dataset.setting] = el.checked; saveSettings(G.settings);
  if (el.dataset.setting === 'keepAwake') applyAwake();
  if (el.dataset.setting === 'notify' && el.checked) native.ensureNotifyPermission();
}));

// close sheets with the ✕ button or by tapping the backdrop
document.querySelectorAll('.modal.sheet').forEach((mod) => mod.addEventListener('click', (e) => {
  if (e.target === mod || e.target.closest('[data-close]')) mod.classList.remove('show');
}));

function renderAll() {
  applyI18n(); renderPresets(); renderTimer(); refreshUI(); renderMini(); renderPvVal(); renderSettings();
  if ($('logModal').classList.contains('show')) renderLog();
}

// ---------- app lifecycle ----------
function onActive(active) {
  if (active) {
    native.cancelDone(); // we are on screen, the in-app chime handles it
    tick();
  } else {
    if (timer.running) credit();
    saveNow();
    if (timer.running && G.settings.notify) {
      const at = new Date(timer.startedAt + (timer.dur - timer.before) * 1000);
      if (at.getTime() > Date.now() + 1000) native.scheduleDone(at, t('notif.title'), t('notif.body', { m: Math.round(timer.dur / 60) }));
    }
  }
}

async function boot() {
  const [savedState, savedSettings] = await Promise.all([loadState(), loadSettings()]);
  if (savedSettings) Object.assign(G.settings, savedSettings);
  if (savedState && typeof savedState.totalSec === 'number') {
    Object.assign(G.state, savedState);
    if (!Array.isArray(G.state.sessions)) G.state.sessions = [];
    if (!G.state.days || typeof G.state.days !== 'object') G.state.days = {};
  }
  // pick up a session that was still open when the app was closed
  const st = G.state.timer;
  if (st && st.active && st.dur > 0) Object.assign(timer, st);

  await initI18n(G.settings.lang || detectLang());
  lastMinutes = realMin(); snapshotTiers();
  startRender($('cv'));
  renderAll();
  applyAwake();
  tick();
  setInterval(tick, 250);
  setInterval(() => { renderMini(); if ($('logModal').classList.contains('show')) renderLog(); }, 5000);
  native.onAppActive(onActive);
  window.addEventListener('pagehide', () => { if (timer.running) credit(); saveNow(); });
  native.cancelDone();
  native.hideSplash();
}
boot();
