import { Capacitor, registerPlugin, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { SplashScreen } from '@capacitor/splash-screen';

export const isNative = Capacitor.isNativePlatform();
const NOTIF_ID = 1;
const quiet = (p) => Promise.resolve(p).catch(() => {});

// Our own native plugin (android/.../StudyNotificationPlugin.java, ios/App/App/StudyNotificationPlugin.swift):
// the ongoing "studying" notification on Android, a Live Activity on iPhone.
const StudyNotification = registerPlugin('StudyNotification');

/**
 * Show (or update) the ongoing study notification while the app is closed.
 * session = { endsAt (ms), paused, remaining ('12:34'), title, text, appName }
 */
export function showOngoing(session) {
  if (isNative) quiet(StudyNotification.show(session));
}
export function hideOngoing() {
  if (isNative) quiet(StudyNotification.hide());
}

/** Light or dark text in the status bar, to match the theme. */
export function setBarsDark(dark) {
  if (isNative) quiet(SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }));
}
/** Hide the status and navigation bars (full clear) or bring them back. */
export function setBarsHidden(hidden) {
  if (isNative) quiet(hidden ? SystemBars.hide() : SystemBars.show());
}

/** Android back button. handler() returns true when it dealt with the press. */
export function onBackButton(handler) {
  if (!isNative) return;
  quiet(
    App.addListener('backButton', () => {
      if (!handler()) App.exitApp();
    }),
  );
}

export function hideSplash() {
  if (isNative) quiet(SplashScreen.hide());
}

/** Ask once, on a user tap, so the "time's up" notification can be shown later. */
export async function ensureNotifyPermission() {
  if (!isNative) return false;
  try {
    let p = await LocalNotifications.checkPermissions();
    if (p.display === 'prompt' || p.display === 'prompt-with-rationale')
      p = await LocalNotifications.requestPermissions();
    return p.display === 'granted';
  } catch {
    return false;
  }
}

export async function scheduleDone(at, title, body) {
  if (!isNative) return;
  await cancelDone();
  await quiet(
    LocalNotifications.schedule({
      notifications: [{ id: NOTIF_ID, title, body, schedule: { at, allowWhileIdle: true } }],
    }),
  );
}
export function cancelDone() {
  if (!isNative) return Promise.resolve();
  return quiet(LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] }));
}

export function buzz(kind = 'light') {
  if (!isNative) return;
  if (kind === 'success') quiet(Haptics.notification({ type: NotificationType.Success }));
  else quiet(Haptics.impact({ style: kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light }));
}

export function setAwake(on) {
  if (!isNative) return;
  quiet(on ? KeepAwake.keepAwake() : KeepAwake.allowSleep());
}

/** cb(true) when the app comes to the foreground, cb(false) when it leaves. */
export function onAppActive(cb) {
  if (isNative) quiet(App.addListener('appStateChange', ({ isActive }) => cb(isActive)));
  else document.addEventListener('visibilitychange', () => cb(!document.hidden));
}
