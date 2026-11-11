// Bits used by the account sheet, the friends list and the visiting panel.
import { t } from '../../i18n/index.js';
import { esc, toast } from '../../ui/dom.js';
import { presetAvatarURL, AVATAR_BG } from '../../render/avatars.js';

const INITIAL_COLORS = ['#ffb3c6', '#a0d8ff', '#ffe08a', '#b8e6b0', '#d7c0ff', '#ffc9a0'];
// Photos come from other people, so only small JPEG data URLs are ever put on the page.
const PHOTO_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
export const MAX_PHOTO_CHARS = 40000;

export const isPhoto = (s) => typeof s === 'string' && s.length < MAX_PHOTO_CHARS && PHOTO_RE.test(s);

/**
 * Someone's picture: their photo, else their chosen animal, else their initial on a colour
 * picked from their id (so the same person always looks the same).
 * who = { name, uid, avatar, photo }; size = '' | 'sm' | 'lg'
 */
export function avatar({ name, uid, avatar: animal, photo }, size = '') {
  const cls = `avatar${size ? ' ' + size : ''}`;
  if (isPhoto(photo)) return `<img class="${cls}" src="${photo}" alt="">`;
  if (AVATAR_BG[animal]) {
    return `<img class="${cls}" src="${presetAvatarURL(animal)}" style="background:${AVATAR_BG[animal]}" alt="">`;
  }
  const sum = [...String(uid)].reduce((a, c) => a + c.charCodeAt(0), 0);
  const color = INITIAL_COLORS[sum % INITIAL_COLORS.length];
  const initial = esc((name || '?').trim().charAt(0).toUpperCase());
  return `<span class="${cls}" style="background:${color}">${initial}</span>`;
}

/** Copy a friend code and confirm with a toast (the toast shows even if the clipboard is blocked). */
export function copyCode(text) {
  const done = () => toast(t('friends.copied', { code: text }));
  try {
    navigator.clipboard.writeText(text).then(done, done);
  } catch {
    done();
  }
}

const PHOTO_PX = 160;

/** Turn a picked image file into a small square JPEG data URL (centre-cropped), or throw. */
export async function photoFromFile(file) {
  if (!file || !/^image\//.test(file.type || 'image/')) throw new Error('not-image');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = PHOTO_PX;
    canvas.height = PHOTO_PX;
    const c = canvas.getContext('2d');
    c.fillStyle = '#fff'; // transparent PNGs become white, not black
    c.fillRect(0, 0, PHOTO_PX, PHOTO_PX);
    c.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      PHOTO_PX,
      PHOTO_PX,
    );
    for (const quality of [0.82, 0.7, 0.55, 0.4]) {
      const data = canvas.toDataURL('image/jpeg', quality);
      if (isPhoto(data)) return data;
    }
    throw new Error('too-big');
  } finally {
    URL.revokeObjectURL(url);
  }
}
