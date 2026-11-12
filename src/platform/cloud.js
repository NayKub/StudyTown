// Firebase backend: accounts, cloud backup and friends.
// Everything Firebase-specific lives in this file; the UI talks to it through the exported functions.
// src/cloud-mock.js implements the same functions in memory for UI tests (npm run dev:mock).
//
// Firestore layout (see firestore.rules for who can read and write what):
//   profiles/{uid}            name, code, totalMin, todayMin, dayKey, weekMin, streak, updatedAt  (owner + friends)
//   codes/{CODE}              uid, name        exact lookup only, no listing
//   emails/{email}            uid, name        exact lookup only, no listing
//   backups/{uid}             state (JSON string), updatedAt                                    (owner only)
//   attacks/{from}_{to}_{day} from, to, item, fromName, fromAvatar, day, at  (one per friend per UTC day)
//   requests/{from}_{to}      from, to, fromName, fromCode, toName, toCode, createdAt            (sender + receiver)
//   friends/{uid}/list/{fid}  name, since                                                        (owner reads, either side deletes)
import { Capacitor } from '@capacitor/core';
import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  connectAuthEmulator,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore';
import { firebaseConfig } from './firebase-config.js';

export const isConfigured = !!firebaseConfig.apiKey;

let app, auth, db;
function boot() {
  if (app) return;
  app = initializeApp(firebaseConfig);
  // The default getAuth() can hang inside the iOS WebView, so native builds pick the persistence explicitly.
  auth = Capacitor.isNativePlatform()
    ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
    : (() => {
        try {
          return initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
        } catch {
          return getAuth(app);
        }
      })();
  db = getFirestore(app);
  if (import.meta.env.VITE_FIREBASE_EMULATOR) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I
const newCode = () =>
  Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
export const normCode = (s) =>
  String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
export const fmtCode = (c) => (c ? c.slice(0, 3) + '-' + c.slice(3) : '');
const normEmail = (s) =>
  String(s || '')
    .trim()
    .toLowerCase();

const me = () => auth && auth.currentUser;
let authCb = null;
let pendingName = ''; // display name typed at sign-up, before Firebase has stored it
const profileJobs = {}; // uid -> promise, so the profile is only created once
const userInfo = (u, extra = {}) =>
  u
    ? {
        uid: u.uid,
        email: u.email,
        name: u.displayName || pendingName || (u.email || '').split('@')[0],
        verified: u.emailVerified,
        ...extra,
      }
    : null;

/** Call once. cb(user|null) runs now and on every sign-in / sign-out. */
export function init(cb, lang) {
  authCb = cb;
  if (!isConfigured) {
    cb(null);
    return;
  }
  boot();
  if (lang) auth.languageCode = lang;
  onAuthStateChanged(auth, async (u) => {
    if (!u) {
      cb(null);
      return;
    }
    let code = '';
    try {
      code = await ensureProfile(u);
    } catch {
      /* offline: try again next launch */
    }
    cb(userInfo(u, { code }));
  });
}
export function setLanguage(lang) {
  if (auth) auth.languageCode = lang;
}

/** Makes sure profile, friend code and email lookup exist (repairs a half-finished sign-up). Returns the code. */
function ensureProfile(u) {
  if (!profileJobs[u.uid])
    profileJobs[u.uid] = createProfile(u).catch((e) => {
      delete profileJobs[u.uid];
      throw e;
    });
  return profileJobs[u.uid];
}
async function createProfile(u) {
  const pref = doc(db, 'profiles', u.uid);
  const snap = await getDoc(pref);
  if (snap.exists() && snap.data().code) return snap.data().code;
  const name = pendingName || u.displayName || (u.email || '').split('@')[0];
  let code = '';
  for (let i = 0; i < 8 && !code; i++) {
    const c = newCode();
    try {
      await setDoc(doc(db, 'codes', c), { uid: u.uid, name });
      code = c;
    } catch {
      /* taken, try another */
    }
  }
  if (!code) throw new Error('code');
  await setDoc(
    pref,
    { name, code, totalMin: 0, todayMin: 0, dayKey: '', weekMin: 0, streak: 0, updatedAt: serverTimestamp() },
    { merge: true },
  );
  if (u.email) await setDoc(doc(db, 'emails', normEmail(u.email)), { uid: u.uid, name }).catch(() => {});
  return code;
}

// ---------- auth ----------
export async function signUp(name, email, password) {
  boot();
  pendingName = name.trim();
  try {
    const cred = await createUserWithEmailAndPassword(auth, normEmail(email), password); // throws auth/email-already-in-use
    await updateProfile(cred.user, { displayName: pendingName });
    sendEmailVerification(cred.user).catch(() => {});
    const code = await ensureProfile(cred.user);
    const info = userInfo(cred.user, { code });
    if (authCb) authCb(info); // the first auth event fired before the name was stored
    return info;
  } finally {
    pendingName = '';
  }
}
export async function logIn(email, password) {
  boot();
  await signInWithEmailAndPassword(auth, normEmail(email), password);
}
export function logOut() {
  return signOut(auth);
}
export function resetPassword(email) {
  boot();
  return sendPasswordResetEmail(auth, normEmail(email));
}
export function resendVerification() {
  return sendEmailVerification(me());
}
export async function refreshUser() {
  const u = me();
  if (!u) return null;
  await u.reload();
  return userInfo(u);
}

export async function deleteAccount(password, code) {
  const u = me();
  await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, password)); // deleting needs a recent login
  const uid = u.uid;
  const batch = writeBatch(db);
  const mine = await getDocs(collection(db, 'friends', uid, 'list'));
  mine.forEach((d) => {
    batch.delete(d.ref);
    batch.delete(doc(db, 'friends', d.id, 'list', uid));
  });
  const [inc, out] = await Promise.all([
    getDocs(query(collection(db, 'requests'), where('to', '==', uid))),
    getDocs(query(collection(db, 'requests'), where('from', '==', uid))),
  ]);
  inc.forEach((d) => batch.delete(d.ref));
  out.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, 'backups', uid));
  batch.delete(doc(db, 'profiles', uid));
  if (code) batch.delete(doc(db, 'codes', code));
  await batch.commit();
  if (u.email) await deleteDoc(doc(db, 'emails', normEmail(u.email))).catch(() => {}); // may never have been created
  await deleteUser(u);
}

// ---------- backup and public stats ----------
export async function pullBackup() {
  const snap = await getDoc(doc(db, 'backups', me().uid));
  if (!snap.exists()) return null;
  try {
    return JSON.parse(snap.data().state);
  } catch {
    return null;
  }
}
export function pushBackup(state) {
  const u = me();
  if (!u) return Promise.resolve();
  const { timer, ...rest } = state; // a half-finished session stays on the device
  return setDoc(doc(db, 'backups', u.uid), { state: JSON.stringify(rest), updatedAt: serverTimestamp() });
}
/** Live copy of the cloud backup, so two devices on the same account stay in step. Returns stop(). */
export function watchBackup(cb, onError) {
  return onSnapshot(
    doc(db, 'backups', me().uid),
    (snap) => {
      if (!snap.exists() || snap.metadata.hasPendingWrites) return; // ignore our own upload
      try {
        cb(JSON.parse(snap.data().state));
      } catch {
        /* unreadable backup */
      }
    },
    (e) => {
      if (onError) onError(e);
    },
  );
}
export function pushStats(stats) {
  const u = me();
  if (!u) return Promise.resolve();
  return setDoc(doc(db, 'profiles', u.uid), { ...stats, updatedAt: serverTimestamp() }, { merge: true });
}
export async function renameMe(name) {
  const u = me();
  await updateProfile(u, { displayName: name });
  const p = await getDoc(doc(db, 'profiles', u.uid));
  const code = p.exists() ? p.data().code : '';
  const batch = writeBatch(db);
  batch.set(doc(db, 'profiles', u.uid), { name }, { merge: true });
  if (code) batch.set(doc(db, 'codes', code), { uid: u.uid, name });
  if (u.email) batch.set(doc(db, 'emails', normEmail(u.email)), { uid: u.uid, name });
  await batch.commit();
}

// ---------- friends ----------
/** Find someone by friend code or exact email. Returns { uid, name, code } or null. */
export async function findUser(input) {
  const s = String(input || '').trim();
  if (s.includes('@')) {
    const snap = await getDoc(doc(db, 'emails', normEmail(s)));
    return snap.exists() ? { uid: snap.data().uid, name: snap.data().name, code: '' } : null;
  }
  const c = normCode(s);
  if (c.length !== 6) return null;
  const snap = await getDoc(doc(db, 'codes', c));
  return snap.exists() ? { uid: snap.data().uid, name: snap.data().name, code: c } : null;
}

/** myAvatar = the sender's preset animal (never their photo), shown to the receiver. */
export async function sendRequest(target, myName, myCode, myAvatar = '') {
  const uid = me().uid;
  await setDoc(doc(db, 'requests', `${uid}_${target.uid}`), {
    from: uid,
    to: target.uid,
    fromName: myName,
    fromCode: myCode,
    fromAvatar: myAvatar,
    toName: target.name,
    toCode: target.code || '',
    createdAt: serverTimestamp(),
  });
  return 'sent';
}
export async function acceptRequest(r) {
  const uid = me().uid;
  const now = serverTimestamp();
  const batch = writeBatch(db);
  batch.set(doc(db, 'friends', uid, 'list', r.from), { name: r.fromName, since: now });
  batch.set(doc(db, 'friends', r.from, 'list', uid), { name: r.toName || me().displayName || '', since: now });
  batch.delete(doc(db, 'requests', `${r.from}_${uid}`));
  await batch.commit();
  await deleteDoc(doc(db, 'requests', `${uid}_${r.from}`)).catch(() => {}); // if we had both asked each other
}
export function declineRequest(r) {
  return deleteDoc(doc(db, 'requests', `${r.from}_${r.to}`));
}
export async function removeFriend(fid) {
  const uid = me().uid;
  const batch = writeBatch(db);
  batch.delete(doc(db, 'friends', uid, 'list', fid));
  batch.delete(doc(db, 'friends', fid, 'list', uid));
  await batch.commit();
}

/** Live view of requests and friends (with their stats). cb({ incoming, outgoing, friends }). Returns stop(). */
export function watchSocial(cb) {
  const uid = me().uid;
  const st = { incoming: [], outgoing: [], friends: [] };
  const profiles = {};
  const profSubs = {};
  const emit = () => cb({ ...st, friends: st.friends.map((f) => ({ ...f, profile: profiles[f.uid] || null })) });
  const subs = [
    onSnapshot(
      query(collection(db, 'requests'), where('to', '==', uid)),
      (s) => {
        st.incoming = s.docs.map((d) => d.data());
        emit();
      },
      () => {},
    ),
    onSnapshot(
      query(collection(db, 'requests'), where('from', '==', uid)),
      (s) => {
        st.outgoing = s.docs.map((d) => d.data());
        emit();
      },
      () => {},
    ),
    onSnapshot(
      collection(db, 'friends', uid, 'list'),
      (s) => {
        st.friends = s.docs.map((d) => ({ uid: d.id, name: d.data().name }));
        const ids = new Set(st.friends.map((f) => f.uid));
        Object.keys(profSubs).forEach((id) => {
          if (!ids.has(id)) {
            profSubs[id]();
            delete profSubs[id];
            delete profiles[id];
          }
        });
        ids.forEach((id) => {
          if (profSubs[id]) return;
          profSubs[id] = onSnapshot(
            doc(db, 'profiles', id),
            (p) => {
              profiles[id] = p.exists() ? p.data() : null;
              emit();
            },
            () => {},
          );
        });
        emit();
      },
      () => {},
    ),
  ];
  return () => {
    subs.forEach((f) => f());
    Object.values(profSubs).forEach((f) => f());
  };
}

// ---------- attacks ----------

/** Throw a bomb at a friend. Refused (permission-denied) if one was already thrown at them today. */
export async function sendAttack(target, item, myName, myAvatar, day) {
  const uid = me().uid;
  const id = `${uid}_${target}_${day}`;
  await setDoc(doc(db, 'attacks', id), {
    from: uid,
    to: target,
    item,
    fromName: myName || '',
    fromAvatar: myAvatar || '',
    day,
    at: serverTimestamp(),
  });
  return id;
}

/** Live list of bombs thrown at you that this account hasn't cleared yet. cb([{ id, ... }]). */
export function watchAttacks(cb) {
  return onSnapshot(
    query(collection(db, 'attacks'), where('to', '==', me().uid)),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => {},
  );
}

/** Remove an attack once it has been applied to the town. */
export function clearAttack(id) {
  return deleteDoc(doc(db, 'attacks', id)).catch(() => {});
}
