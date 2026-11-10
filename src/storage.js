import { Preferences } from '@capacitor/preferences';

// Preferences is native key-value storage on iOS/Android (UserDefaults / SharedPreferences)
// and falls back to localStorage on the web, so the same code runs everywhere.
async function read(key) {
  try {
    const { value } = await Preferences.get({ key });
    return value ? JSON.parse(value) : null;
  } catch (e) { return null; }
}
function write(key, obj) {
  return Preferences.set({ key, value: JSON.stringify(obj) }).catch(() => {});
}

export const loadState = () => read('state');
export const saveState = (s) => write('state', s);
export const loadSettings = () => read('settings');
export const saveSettings = (s) => write('settings', s);
