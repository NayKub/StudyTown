// Small DOM helpers shared by the feature modules.

export const $ = (id) => document.getElementById(id);

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escape text before putting it into innerHTML. */
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESCAPES[c]);

export const isShown = (id) => $(id).classList.contains('show');
export const showModal = (id) => $(id).classList.add('show');
export const hideModal = (id) => $(id).classList.remove('show');

/** Pop a short message at the top of the town. At most three are visible at once. */
export function toast(text) {
  const box = $('toasts');
  while (box.children.length >= 3) box.firstChild.remove();
  const d = document.createElement('div');
  d.className = 'toast';
  d.textContent = text;
  box.appendChild(d);
  setTimeout(() => d.remove(), 3600);
}
