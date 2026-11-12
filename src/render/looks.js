// What the shop's town themes and skies look like, and which ones the town on screen uses.
import { G } from '../core/state.js';
import { lookOf, DEFAULT_LOOK, damagedPlots } from '../core/wallet.js';
import { timeOfDay } from './sky.js';

/** Colours of the island for each town theme. */
export const GROUNDS = {
  meadow: {
    grass: ['#a6e39a', '#9bdc8e'],
    turf: ['#86cf78', '#74b866'],
    cliff: ['#c99a6e', '#a97c55'],
    road: '#e9e1d6',
    lane: 'rgba(255,255,255,.9)',
    tuft: '#7cc46f',
    flower: '#fff',
    flowers: 0.15,
  },
  autumn: {
    grass: ['#f0c27e', '#e8b56c'],
    turf: ['#d99a52', '#c88943'],
    cliff: ['#c99a6e', '#a97c55'],
    road: '#efe3d0',
    lane: 'rgba(255,255,255,.85)',
    tuft: '#c97f3a',
    flower: '#e0603c',
    flowers: 0.3,
  },
  snow: {
    grass: ['#f6f9fd', '#eaf1f8'],
    turf: ['#dbe7f2', '#c8d8e8'],
    cliff: ['#b9a28c', '#9c8572'],
    road: '#d7dce6',
    lane: 'rgba(255,255,255,.95)',
    tuft: '#c9d6e3',
    flower: '#a9d4ff',
    flowers: 0.1,
  },
  sakura: {
    grass: ['#f8dde7', '#f2d0dd'],
    turf: ['#e9b6c9', '#dba4b9'],
    cliff: ['#c99a6e', '#a97c55'],
    road: '#fff3f6',
    lane: 'rgba(240,150,180,.55)',
    tuft: '#a5d48f',
    flower: '#ff8fb3',
    flowers: 0.45,
  },
  desert: {
    grass: ['#f3d9a0', '#ebcf90'],
    turf: ['#dcb877', '#cca765'],
    cliff: ['#d39a63', '#b5804f'],
    road: '#e7d3b4',
    lane: 'rgba(255,255,255,.8)',
    tuft: '#86b765',
    flower: '#f08a5d',
    flowers: 0.12,
  },
};

/** The look of the town on screen: a friend's while visiting, otherwise your own. */
export function shownLook() {
  if (G.visit) return { ...DEFAULT_LOOK, ...(G.visit.look || {}) };
  return lookOf(G.state);
}

export const groundColors = () => GROUNDS[shownLook().ground] || GROUNDS.meadow;

/** Time of day as the chosen sky shows it, plus its extras. */
export function skyState() {
  const sky = shownLook().sky;
  const real = timeOfDay();
  if (sky === 'sunset') return { night: false, dusk: true, sky };
  if (sky === 'starry') return { night: true, dusk: false, sky };
  if (sky === 'aurora') return { night: true, dusk: false, sky };
  return { ...real, sky };
}

/** Which buildings of the town on screen are damaged, whether it rains, whether a shield is up. */
export function shownTrouble() {
  if (G.visit) {
    const d = G.visit.damage || {};
    return { plots: new Set(d.plots || []), rain: !!d.rain, shield: (G.visit.shieldUntil || 0) > Date.now() };
  }
  if (G.preview || G.replayMin != null) return { plots: new Set(), rain: false, shield: false };
  return {
    plots: new Set(damagedPlots(G.state)),
    rain: !!(G.state.damage && G.state.damage.rain),
    shield: (G.state.shieldUntil || 0) > Date.now(),
  };
}
