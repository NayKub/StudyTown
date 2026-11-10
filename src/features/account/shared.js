// Bits used by both the account sheet and the friends card.
import { t } from '../../i18n/index.js';
import { esc, toast } from '../../ui/dom.js';

const AVATAR_COLORS = ['#ffb3c6', '#a0d8ff', '#ffe08a', '#b8e6b0', '#d7c0ff', '#ffc9a0'];

/** A round initial on a colour picked from the user id, so the same person always looks the same. */
export function avatar(name, uid) {
  const sum = [...String(uid)].reduce((a, c) => a + c.charCodeAt(0), 0);
  const color = AVATAR_COLORS[sum % AVATAR_COLORS.length];
  const initial = esc((name || '?').trim().charAt(0).toUpperCase());
  return `<span class="avatar" style="background:${color}">${initial}</span>`;
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
