// In-memory stand-in for src/cloud.js, used by `npm run dev:mock` to try the account and friends
// screens without a Firebase project. Data is kept in localStorage under "mockcloud".
// It ships two demo users: Mint (friend code MNT-234) and Ploy, who sends you a friend request.
export const isConfigured = true;
export const normCode = (s) =>
  String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
export const fmtCode = (c) => (c ? c.slice(0, 3) + '-' + c.slice(3) : '');
const normEmail = (s) =>
  String(s || '')
    .trim()
    .toLowerCase();
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const err = (code) => Object.assign(new Error(code), { code });

const KEY = 'mockcloud';
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s) return s;
  } catch {
    /* fresh */
  }
  return {
    session: null,
    users: {
      mint: { uid: 'mint', email: 'mint@example.com', pw: 'password', name: 'Mint', verified: true },
      ploy: { uid: 'ploy', email: 'ploy@example.com', pw: 'password', name: 'Ploy', verified: true },
    },
    profiles: {
      mint: { name: 'Mint', code: 'MNT234', totalMin: 1260, todayMin: 45, dayKey: '', weekMin: 310, streak: 4 },
      ploy: { name: 'Ploy', code: 'PLY567', totalMin: 95, todayMin: 0, dayKey: '', weekMin: 95, streak: 0 },
    },
    backups: {},
    requests: {},
    friends: {},
    seededRequest: false,
  };
}
const S = load();
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch {
    /* ignore */
  }
  emitAll();
};
const user = () => (S.session ? S.users[S.session] : null);
const info = (u) =>
  u
    ? {
        uid: u.uid,
        email: u.email,
        name: u.name,
        verified: u.verified,
        code: S.profiles[u.uid] && S.profiles[u.uid].code,
      }
    : null;

let authCb = null;
export function init(cb) {
  authCb = cb;
  setTimeout(() => cb(info(user())), 50);
}
export function setLanguage() {}
const fireAuth = () => authCb && authCb(info(user()));

export async function signUp(name, email, password) {
  await wait();
  email = normEmail(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw err('auth/invalid-email');
  if (Object.values(S.users).some((u) => u.email === email)) throw err('auth/email-already-in-use');
  if (password.length < 6) throw err('auth/weak-password');
  const uid = 'me' + Object.keys(S.users).length; // predictable, so UI snapshots are repeatable
  S.users[uid] = { uid, email, pw: password, name: name.trim(), verified: false };
  S.profiles[uid] = {
    name: name.trim(),
    code: 'ME' + String(Object.keys(S.users).length).padStart(4, '2'),
    totalMin: 0,
    todayMin: 0,
    dayKey: '',
    weekMin: 0,
    streak: 0,
  };
  S.session = uid;
  seedRequest(uid);
  save();
  fireAuth();
  return info(S.users[uid]);
}
export async function logIn(email, password) {
  await wait();
  email = normEmail(email);
  const u = Object.values(S.users).find((x) => x.email === email);
  if (!u || u.pw !== password) throw err('auth/invalid-credential');
  S.session = u.uid;
  seedRequest(u.uid);
  save();
  fireAuth();
}
function seedRequest(uid) {
  if (S.seededRequest || uid === 'ploy') return;
  S.requests[`ploy_${uid}`] = {
    from: 'ploy',
    to: uid,
    fromName: 'Ploy',
    fromCode: 'PLY567',
    toName: S.users[uid].name,
    toCode: '',
  };
  S.seededRequest = true;
}
export async function logOut() {
  S.session = null;
  save();
  fireAuth();
}
export async function resetPassword() {
  await wait();
}
export async function resendVerification() {
  await wait();
}
export async function refreshUser() {
  const u = user();
  if (u) u.verified = true;
  save();
  return info(u);
}
export async function deleteAccount(password) {
  await wait();
  const u = user();
  if (u.pw !== password) throw err('auth/invalid-credential');
  const uid = u.uid;
  delete S.users[uid];
  delete S.profiles[uid];
  delete S.backups[uid];
  delete S.friends[uid];
  Object.keys(S.friends).forEach((k) => {
    if (S.friends[k]) delete S.friends[k][uid];
  });
  Object.keys(S.requests).forEach((k) => {
    const r = S.requests[k];
    if (r.from === uid || r.to === uid) delete S.requests[k];
  });
  S.session = null;
  save();
  fireAuth();
}
export async function pullBackup() {
  await wait(100);
  const b = S.backups[S.session];
  return b ? JSON.parse(b) : null;
}
export async function pushBackup(state) {
  const { timer, ...rest } = state;
  S.backups[S.session] = JSON.stringify(rest);
  save();
}
export function watchBackup() {
  return () => {};
}
export async function pushStats(stats) {
  if (!S.session) return;
  Object.assign(S.profiles[S.session], stats);
  save();
}
export async function renameMe(name) {
  const u = user();
  u.name = name;
  S.profiles[u.uid].name = name;
  save();
  fireAuth();
}

export async function findUser(input) {
  await wait();
  const s = String(input || '').trim();
  let uid;
  if (s.includes('@')) {
    const u = Object.values(S.users).find((x) => x.email === normEmail(s));
    uid = u && u.uid;
  } else {
    const c = normCode(s);
    uid = Object.keys(S.profiles).find((k) => S.profiles[k].code === c) || null;
  }
  return uid ? { uid, name: S.profiles[uid].name, code: S.profiles[uid].code } : null;
}
export async function sendRequest(target, myName, myCode) {
  await wait();
  const uid = S.session;
  S.requests[`${uid}_${target.uid}`] = {
    from: uid,
    to: target.uid,
    fromName: myName,
    fromCode: myCode,
    toName: target.name,
    toCode: target.code || '',
  };
  save();
  if (target.uid === 'mint')
    setTimeout(() => {
      // Mint accepts after a moment so the flow can be seen end to end
      if (!S.requests[`${uid}_mint`]) return;
      delete S.requests[`${uid}_mint`];
      (S.friends[uid] = S.friends[uid] || {}).mint = { name: 'Mint' };
      (S.friends.mint = S.friends.mint || {})[uid] = { name: myName };
      save();
    }, 2500);
  return 'sent';
}
export async function acceptRequest(r) {
  await wait();
  const uid = S.session;
  (S.friends[uid] = S.friends[uid] || {})[r.from] = { name: r.fromName };
  (S.friends[r.from] = S.friends[r.from] || {})[uid] = { name: r.toName };
  delete S.requests[`${r.from}_${uid}`];
  delete S.requests[`${uid}_${r.from}`];
  save();
}
export async function declineRequest(r) {
  await wait();
  delete S.requests[`${r.from}_${r.to}`];
  save();
}
export async function removeFriend(fid) {
  await wait();
  const uid = S.session;
  if (S.friends[uid]) delete S.friends[uid][fid];
  if (S.friends[fid]) delete S.friends[fid][uid];
  save();
}

const watchers = new Set();
function snapshot() {
  const uid = S.session;
  const reqs = Object.values(S.requests);
  return {
    incoming: reqs.filter((r) => r.to === uid),
    outgoing: reqs.filter((r) => r.from === uid),
    friends: Object.entries(S.friends[uid] || {}).map(([id, f]) => ({
      uid: id,
      name: f.name,
      profile: S.profiles[id] || null,
    })),
  };
}
function emitAll() {
  if (S.session) watchers.forEach((cb) => cb(snapshot()));
}
export function watchSocial(cb) {
  watchers.add(cb);
  setTimeout(() => cb(snapshot()), 30);
  return () => watchers.delete(cb);
}
