// The town plan: which plot gets built at how many total study minutes.
// Pure data and functions, no drawing and no DOM.
export const TW = 64, TH = 32, MAXR = 10;

export function hash(x, y, s = 0) {
  let h = Math.imul(x + 1013, 374761393) ^ Math.imul(y + 7919, 668265263) ^ Math.imul(s + 31, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export const isRoad = (x, y) => ((x % 4) + 4) % 4 === 2 || ((y % 4) + 4) % 4 === 2;
export const ring = (x, y) => Math.max(Math.abs(x), Math.abs(y));

const COLORS = ['#ffb3c6', '#a0d8ff', '#ffe08a', '#b8e6b0', '#d7c0ff', '#ffc9a0', '#9fe3d6', '#ffa8a8'];
const ROOFS = ['#ff7f7f', '#7fa8ff', '#ff9f5a', '#7dc97d', '#b08cff', '#e8739a'];

export const plots = [];
for (let x = -9; x <= 9; x++) for (let y = -9; y <= 9; y++) if (!isRoad(x, y)) plots.push({ x, y });
const order = (p) => (p.x || p.y ? ring(p.x, p.y) + hash(p.x, p.y, 3) * 1.6 : -1);
plots.sort((a, b) => order(a) - order(b));
plots.forEach((p, i) => {
  p.i = i;
  p.t = 3 + i * 4 + Math.floor(i * i * 0.08); // total minutes needed to unlock
  const r = hash(p.x, p.y, 7);
  if (i === 0) p.kind = 'hall';
  else if (r < 0.2) p.kind = 'trees';
  else if (r < 0.27) p.kind = 'garden';
  else if (r < 0.36) p.kind = 'shop';
  else if (r < 0.40) p.kind = 'pond';
  else p.kind = 'house';
  p.color = COLORS[Math.floor(hash(p.x, p.y, 11) * COLORS.length)];
  p.roof = ROOFS[Math.floor(hash(p.x, p.y, 13) * ROOFS.length)];
  p.cap = p.kind === 'hall' ? 3
    : p.kind === 'house' ? Math.max(1, 3 - Math.floor((ring(p.x, p.y) - 1) / 3))
    : p.kind === 'pond' ? 0 : 2;
});
export const plotAt = {};
plots.forEach((p) => { plotAt[p.x + ',' + p.y] = p; });

const TIER_AGE = [0, 45, 180, 480]; // minutes after being built before each upgrade
export function tierOf(p, minutes) {
  const age = minutes - p.t;
  let tier = 0;
  for (let k = 1; k < 4; k++) if (age >= TIER_AGE[k]) tier = k;
  return Math.min(tier, p.cap);
}

const RANK_AT = [0, 1, 4, 11, 26, 51, 91, 141]; // buildings needed for each rank
export function cityAt(minutes) {
  let n = 0;
  while (n < plots.length && plots[n].t <= minutes) n++;
  let maxRing = 0;
  for (let i = 0; i < n; i++) maxRing = Math.max(maxRing, ring(plots[i].x, plots[i].y));
  const R = n === 0 ? 1 : Math.min(MAXR, maxRing + 1);
  let rank = 0;
  RANK_AT.forEach((k, i) => { if (n >= k) rank = i; });
  return { n, R, rank, pop: Math.min(36, 1 + Math.floor(n * 0.55)) };
}
