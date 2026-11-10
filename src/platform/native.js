import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { SplashScreen } from '@capacitor/splash-screen';

export const isNative = Capacitor.isNativePlatform();
const NOTIF_ID = 1;
const quiet = (p) => Promise.resolve(p).catch(() => {});

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
