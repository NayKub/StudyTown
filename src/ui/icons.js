// The app's own icon set: ink-line drawings on a 24 x 24 grid, used instead of emoji so they look
// the same on every phone. They take the colour and size of the text around them.
//
// In HTML:  <span data-icon="calendar"></span>   (filled in once by applyIcons)
// In code:  `${icon('calendar')} Study log`

const DOT = 'stroke-width="2.6"';
const SOLID = 'fill="currentColor"';

const DRAWINGS = {
  home: '<path d="M3.4 11.3 12 4.1l8.7 7.1"/><path d="M5.6 9.9v9.4c0 .5.3.9.9.9h3.2v-5.3c0-.5.3-.8.8-.8h3c.5 0 .8.3.8.8v5.3h3.3c.5 0 .9-.4.9-.9V9.8"/>',
  user: '<circle cx="12" cy="8.1" r="3.9"/><path d="M4.6 20.2c.6-3.7 3.4-5.5 7.3-5.5 4 0 6.9 1.9 7.5 5.5"/>',
  friends:
    '<circle cx="9" cy="8" r="3.4"/><path d="M2.8 19.5c.5-3.2 2.8-4.9 6.2-4.9 3.3 0 5.7 1.6 6.2 4.9"/><path d="M15.7 4.9a3.3 3.3 0 0 1 .3 6.5"/><path d="M17.7 14.8c2 .6 3.2 2 3.6 4.5"/>',
  calendar:
    '<rect x="4.3" y="5.4" width="15.4" height="14.8" rx="1.8"/><path d="M4.4 10h15.2M8.3 3.6v3.3M15.8 3.5v3.4"/><path ' +
    DOT +
    ' d="M8.2 13.7h.01M12 13.7h.01M15.9 13.7h.01M8.2 16.9h.01M12 16.9h.01"/>',
  settings:
    '<path d="M4 7h9.3M17.8 7H20M4 12h2.8M11.2 12H20M4 17h10.3M18.8 17H20"/><circle cx="15.5" cy="7" r="2.1"/><circle cx="9" cy="12" r="2.1"/><circle cx="16.5" cy="17" r="2.1"/>',
  hammer:
    '<g transform="rotate(42 12 12)"><rect x="6.4" y="3.2" width="11.2" height="5.6" rx="1.4"/><path d="M12 8.9v11.6"/></g>',
  trophy:
    '<path d="M8 4.4h8v5.1a4 4 0 0 1-8 0V4.4Z"/><path d="M8 6H5.2c-.2 2.4.8 3.9 2.9 4.3M16 6h2.8c.2 2.4-.8 3.9-2.9 4.3M12 13.5v3.4M8.6 19.8h6.8M9.8 16.9h4.4"/>',
  film: '<path d="M4.2 10.3h15.6v8.5c0 .6-.4 1-1 1H5.2c-.6 0-1-.4-1-1v-8.5Z"/><path d="m4.3 10.2 14.5-4.5.8 2.4L5 12.5"/><path d="m8.2 9 1.5 1.9M12 7.8l1.5 1.9M15.8 6.7l1.4 1.9"/>',
  play: `<path ${SOLID} d="M7.5 5.3v13.4c0 .6.6.9 1.1.6l10.2-6.7c.4-.3.4-.9 0-1.1L8.6 4.8c-.5-.4-1.1 0-1.1.5Z"/>`,
  pause: `<rect ${SOLID} x="6.4" y="5" width="3.8" height="14" rx="1.1"/><rect ${SOLID} x="13.8" y="5" width="3.8" height="14" rx="1.1"/>`,
  stop: `<rect ${SOLID} x="6.1" y="6.1" width="11.8" height="11.8" rx="2.2"/>`,
  close: '<path d="M6.2 6.3 17.8 17.7M17.7 6.2 6.3 17.8"/>',
  check: '<path d="m5 12.8 4.3 4.3L19.2 7"/>',
  eye: '<path d="M2.8 12.1C4.9 8.3 8.1 6.2 12 6.2s7.2 2.1 9.2 5.9c-2 3.7-5.3 5.8-9.2 5.8s-7.1-2.1-9.2-5.8Z"/><circle cx="12" cy="12" r="2.8"/>',
  cloud: '<path d="M7.4 18.6a4.3 4.3 0 0 1-.6-8.5 5.4 5.4 0 0 1 10.5-1.2 4.9 4.9 0 0 1-.1 9.7H7.4Z"/>',
  warn: '<path d="M12 4.4 3.5 19h17L12 4.4Z"/><path d="M12 10v4.3"/><path ' + DOT + ' d="M12 16.7h.01"/>',
  lock: '<rect x="5.4" y="10.6" width="13.2" height="9.4" rx="2"/><path d="M8.4 10.5V8a3.6 3.6 0 0 1 7.2 0v2.5"/>',
  clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.4v4.9l3.1 1.9"/>',
  flame:
    '<path d="M12.3 3.6c.5 3-3.9 4.6-3.9 9.2 0 2.7 1.5 6.5 3.7 6.5 2.9 0 4.7-2.1 4.7-5 0-2-.9-3.1-1.7-4.3-.3 1.1-.8 1.7-1.5 2 .3-3.3-.2-6.3-1.3-8.4Z"/>',
  medal: '<circle cx="12" cy="14.6" r="5"/><path d="M9.1 10 6.8 3.9h3.4l1.8 4M14.9 10l2.3-6.1h-3.4l-1.8 4"/>',
  device: '<rect x="7" y="3.5" width="10" height="17" rx="2.2"/><path d="M11 17.5h2"/>',
  dice:
    '<rect x="4.5" y="4.5" width="15" height="15" rx="3"/><path ' +
    DOT +
    ' d="M9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01"/>',
  expand: '<path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15"/>',
  shrink: '<path d="M9 4.5V9H4.5M19.5 9H15V4.5M15 19.5V15h4.5M4.5 15H9v4.5"/>',
  image:
    '<rect x="3.8" y="5" width="16.4" height="14" rx="2"/><circle cx="9" cy="10" r="1.7"/><path d="m4.2 17.2 5-4.6 3.4 3 2.6-2.3 4.6 4"/>',
  sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  moon: '<path d="M19.6 14.6A7.8 7.8 0 0 1 9.4 4.4a7.8 7.8 0 1 0 10.2 10.2Z"/>',
  back: '<path d="M10 6.5 4.5 12l5.5 5.5M5 12h14.5"/>',
  more: '<path ' + DOT + ' d="M6 12h.01M12 12h.01M18 12h.01"/>',
};

/** Inline SVG for an icon. Unknown names give an empty string rather than breaking the page. */
export function icon(name) {
  const drawing = DRAWINGS[name];
  return drawing ? `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${drawing}</svg>` : '';
}

/** Fill every <span data-icon="name"> in the page. */
export function applyIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    el.innerHTML = icon(el.dataset.icon);
  });
}

export const ICON_NAMES = Object.keys(DRAWINGS);
