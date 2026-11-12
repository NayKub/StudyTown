// Small pictures of shop items: an island tile for town themes, a strip of sky, a mini card.
import { GROUNDS } from '../../render/looks.js';
import { icon } from '../../ui/icons.js';

const svg = (body) => `<svg viewBox="0 0 64 44" aria-hidden="true">${body}</svg>`;

function groundSwatch(id) {
  const c = GROUNDS[id] || GROUNDS.meadow;
  return svg(
    `<polygon points="32,6 60,20 32,34 4,20" fill="${c.grass[0]}"/>` +
      `<polygon points="32,13 46,20 32,27 18,20" fill="${c.grass[1]}"/>` +
      `<polygon points="4,20 32,34 32,40 4,26" fill="${c.cliff[0]}"/>` +
      `<polygon points="32,34 60,20 60,26 32,40" fill="${c.cliff[1]}"/>` +
      `<polygon points="4,20 32,34 32,36 4,22" fill="${c.turf[0]}"/>` +
      `<polygon points="32,34 60,20 60,22 32,36" fill="${c.turf[1]}"/>` +
      `<circle cx="24" cy="18" r="1.8" fill="${c.flower}"/><circle cx="40" cy="22" r="1.8" fill="${c.flower}"/>`,
  );
}

const SKIES = {
  live: [
    '#bfe6ff',
    '#eaf7ff',
    '<ellipse cx="22" cy="16" rx="9" ry="3.5" fill="#fff"/><circle cx="50" cy="12" r="5" fill="#ffe28a"/>',
  ],
  sunset: ['#ff9a8b', '#ffe3b8', '<circle cx="46" cy="22" r="8" fill="#fff0bf" opacity=".9"/>'],
  starry: [
    '#2b2d5c',
    '#5b5590',
    '<g fill="#fff"><rect x="10" y="8" width="1.6" height="1.6"/><rect x="26" y="14" width="1.6" height="1.6"/><rect x="44" y="7" width="1.6" height="1.6"/><rect x="54" y="18" width="1.6" height="1.6"/><rect x="18" y="24" width="1.6" height="1.6"/></g><path d="M36 20 48 14" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>',
  ],
  petals: [
    '#ffd6e4',
    '#fff3f6',
    '<g fill="#ffb3cc"><ellipse cx="14" cy="12" rx="3" ry="1.8" transform="rotate(30 14 12)"/><ellipse cx="34" cy="22" rx="3" ry="1.8" transform="rotate(-20 34 22)"/><ellipse cx="50" cy="10" rx="3" ry="1.8"/><ellipse cx="24" cy="32" rx="3" ry="1.8" transform="rotate(50 24 32)"/></g>',
  ],
  aurora: [
    '#16203f',
    '#2f4a6b',
    '<path d="M0 18 C16 8 30 24 64 12 L64 22 C34 32 18 18 0 28Z" fill="#78ffbe" opacity=".45"/><path d="M0 26 C20 18 36 32 64 22 L64 28 C36 38 20 26 0 32Z" fill="#aa8cff" opacity=".4"/>',
  ],
};

function skySwatch(id) {
  const [top, bottom, extra] = SKIES[id] || SKIES.live;
  return svg(
    `<defs><linearGradient id="sk-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>` +
      `<rect x="2" y="2" width="60" height="40" rx="8" fill="url(#sk-${id})"/>${extra}`,
  );
}

const CARDS = {
  plain: ['#fffdf9', '#f0e2d2', ''],
  mint: ['#effaf2', '#cdebd6', ''],
  lavender: ['#f6f1ff', '#e0d4fa', ''],
  notebook: [
    '#fffef7',
    '#d9e3f0',
    '<g stroke="#bcd0ea" stroke-width="1"><path d="M8 17h48M8 24h48M8 31h48"/></g><path d="M15 7v30" stroke="#f3a3b4" stroke-width="1"/>',
  ],
  kraft: [
    '#f1dfc0',
    '#d9bf94',
    '<rect x="8" y="8" width="48" height="28" rx="5" fill="none" stroke="#b9925e" stroke-dasharray="3 3"/>',
  ],
};

function cardSwatch(id) {
  const [fill, line, extra] = CARDS[id] || CARDS.plain;
  return svg(
    `<rect x="4" y="5" width="56" height="34" rx="8" fill="${fill}" stroke="${line}" stroke-width="2"/>` +
      `${extra}<rect x="20" y="15" width="24" height="5" rx="2.5" fill="#ff8fab" opacity=".8"/><rect x="24" y="24" width="16" height="4" rx="2" fill="#c9b7c9"/>`,
  );
}

/** The picture for any shop item. */
export function swatch(it) {
  if (it.slot === 'ground') return groundSwatch(it.id);
  if (it.slot === 'sky') return skySwatch(it.id);
  if (it.slot === 'card') return cardSwatch(it.id);
  return `<span class="itemIcon it-${it.id}">${icon(it.id === 'thunder' ? 'storm' : it.id === 'shield' ? 'shield' : 'bomb')}</span>`;
}
